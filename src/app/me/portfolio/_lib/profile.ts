import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import { computeCompetenceProfile, type CompetenceScore, type LevelObservation } from "@/lib/competences";
import type { DepositProvider } from "@/lib/deposit";
import type { LinkCheckStatus } from "@/lib/link-check-core";

// Chargement du portfolio d'un étudiant : référentiel, traces personnelles, traces issues des SAÉ
// (auto-évaluations soumises sur des critères rattachés à un AC) et profil de compétences (radar).

export type ReferentielLearning = {
  id: string;
  code: string;
  label: string;
  level: number;
  parcours: string | null;
};

export type ReferentielCompetence = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  color: string | null;
  levelLabels: string[];
  learnings: ReferentielLearning[];
};

export type EvidenceRow = {
  id: string;
  learningId: string;
  title: string;
  url: string | null;
  reflection: string | null;
  level: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export type TraceLink = {
  id: string;
  url: string;
  label: string | null;
  provider: DepositProvider;
  checkStatus: LinkCheckStatus | null;
};

export type SaeTrace = {
  key: string;
  assessmentId: string;
  learningId: string;
  criterionLabel: string;
  milestoneTitle: string;
  saeId: string;
  saeCode: string | null;
  saeTitle: string;
  /** Règles d'accès de la SAÉ (lien vers l'auto-évaluation uniquement si autorisé) */
  saeAccess: { ownerId: string; published: boolean; teachers: { id: string }[] };
  selfLevel: number;
  /** Niveau enseignant — uniquement s'il est publié ET demandé (includeTeacher) */
  teacherLevel: number | null;
  submittedAt: Date;
  links: TraceLink[];
};

export type LatestLevels = {
  self: { level: number; at: Date } | null;
  teacher: { level: number; at: Date } | null;
};

export type Portfolio = {
  referentiel: ReferentielCompetence[];
  scores: CompetenceScore[];
  evidences: EvidenceRow[];
  traces: SaeTrace[];
  evidencesByLearning: Map<string, EvidenceRow[]>;
  tracesByLearning: Map<string, SaeTrace[]>;
  latestByLearning: Map<string, LatestLevels>;
};

/** Référentiel complet (5 compétences, ~75 AC) — mémoïsé par requête */
export const loadReferentiel = cache(async (): Promise<ReferentielCompetence[]> => {
  const rows = await db.competence.findMany({
    orderBy: [{ position: "asc" }, { code: "asc" }],
    take: 20,
    select: {
      id: true,
      code: true,
      name: true,
      description: true,
      color: true,
      levelLabels: true,
      learnings: {
        orderBy: [{ level: "asc" }, { code: "asc" }],
        take: 300,
        select: { id: true, code: true, label: true, level: true, parcours: true },
      },
    },
  });
  return rows.map((r) => ({
    ...r,
    levelLabels: Array.isArray(r.levelLabels)
      ? r.levelLabels.filter((l): l is string => typeof l === "string")
      : [],
  }));
});

const MAX_ASSESSMENTS = 200;
const MAX_EVIDENCES = 300;

function pushTo<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

/**
 * Portfolio d'un utilisateur.
 * `includeTeacher` : ajoute les niveaux enseignant PUBLIÉS (jamais les brouillons ni les commentaires).
 * Le portfolio public passe `false` : seules les traces et auto-positionnements de l'étudiant y figurent.
 */
export async function loadPortfolio(
  userId: string,
  { includeTeacher, publicView = false }: { includeTeacher: boolean; publicView?: boolean },
): Promise<Portfolio> {
  const [referentiel, evidences, assessments] = await Promise.all([
    loadReferentiel(),
    db.portfolioEvidence.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: MAX_EVIDENCES,
      select: {
        id: true,
        learningId: true,
        title: true,
        url: true,
        reflection: true,
        level: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    db.selfAssessment.findMany({
      where: { userId, status: "SUBMITTED" },
      orderBy: { submittedAt: "desc" },
      take: MAX_ASSESSMENTS,
      select: {
        id: true,
        groupId: true,
        milestoneId: true,
        submittedAt: true,
        updatedAt: true,
        feedbackPublishedAt: true,
        milestone: {
          select: {
            title: true,
            sae: {
              select: {
                id: true,
                code: true,
                title: true,
                ownerId: true,
                published: true,
                teachers: { select: { id: true } },
              },
            },
          },
        },
        items: {
          where: { criterion: { learningId: { not: null } } },
          select: {
            level: true,
            teacherLevel: true,
            criterion: { select: { label: true, learningId: true } },
          },
        },
      },
    }),
  ]);

  // Liens de dépôt du groupe pour le jalon de chaque auto-évaluation
  // Sécurité : en vue publique, uniquement les liens déposés par l'étudiant lui-même (jamais ceux des
  // coéquipiers) ; en vue privée, ceux du groupe seulement s'il en est toujours membre.
  const memberOf = new Set(
    (await db.groupMember.findMany({ where: { userId }, select: { groupId: true } })).map((m) => m.groupId),
  );
  const pairs = assessments.flatMap((a) =>
    a.groupId
      ? [
          publicView || !memberOf.has(a.groupId)
            ? { groupId: a.groupId, milestoneId: a.milestoneId, addedById: userId }
            : { groupId: a.groupId, milestoneId: a.milestoneId },
        ]
      : [],
  );
  const links = pairs.length
    ? await db.depositLink.findMany({
        where: { OR: pairs },
        orderBy: { createdAt: "asc" },
        take: 500,
        select: { id: true, url: true, label: true, provider: true, checkStatus: true, groupId: true, milestoneId: true },
      })
    : [];
  const linksByPair = new Map<string, TraceLink[]>();
  for (const l of links) {
    pushTo(linksByPair, `${l.groupId}:${l.milestoneId}`, {
      id: l.id,
      url: l.url,
      label: l.label,
      provider: l.provider,
      checkStatus: l.checkStatus,
    });
  }

  const learningById = new Map<string, { code: string; competenceCode: string }>();
  for (const c of referentiel) {
    for (const l of c.learnings) learningById.set(l.id, { code: l.code, competenceCode: c.code });
  }

  const observations: LevelObservation[] = [];
  const latestByLearning = new Map<string, LatestLevels>();
  function observe(learningId: string, selfLevel: number | null, teacherLevel: number | null, at: Date) {
    const ref = learningById.get(learningId);
    if (!ref) return;
    observations.push({ competenceCode: ref.competenceCode, learningCode: ref.code, selfLevel, teacherLevel, at });
    const cur = latestByLearning.get(learningId) ?? { self: null, teacher: null };
    if (selfLevel != null && (!cur.self || at >= cur.self.at)) cur.self = { level: selfLevel, at };
    if (teacherLevel != null && (!cur.teacher || at >= cur.teacher.at)) cur.teacher = { level: teacherLevel, at };
    latestByLearning.set(learningId, cur);
  }

  const traces: SaeTrace[] = [];
  for (const a of assessments) {
    const at = a.submittedAt ?? a.updatedAt;
    const published = includeTeacher && !!a.feedbackPublishedAt;
    const traceLinks = a.groupId ? (linksByPair.get(`${a.groupId}:${a.milestoneId}`) ?? []) : [];
    for (const item of a.items) {
      const learningId = item.criterion.learningId;
      if (!learningId || !learningById.has(learningId)) continue;
      const teacherLevel = published ? item.teacherLevel : null;
      observe(learningId, item.level, teacherLevel, at);
      traces.push({
        key: `${a.id}:${learningId}:${traces.length}`,
        assessmentId: a.id,
        learningId,
        criterionLabel: item.criterion.label,
        milestoneTitle: a.milestone.title,
        saeId: a.milestone.sae.id,
        saeCode: a.milestone.sae.code,
        saeTitle: a.milestone.sae.title,
        saeAccess: {
          ownerId: a.milestone.sae.ownerId,
          published: a.milestone.sae.published,
          teachers: a.milestone.sae.teachers,
        },
        selfLevel: item.level,
        teacherLevel,
        submittedAt: at,
        links: traceLinks,
      });
    }
  }

  const evidencesByLearning = new Map<string, EvidenceRow[]>();
  for (const e of evidences) {
    pushTo(evidencesByLearning, e.learningId, e);
    if (e.level != null) observe(e.learningId, e.level, null, e.updatedAt);
  }

  const tracesByLearning = new Map<string, SaeTrace[]>();
  for (const t of traces) pushTo(tracesByLearning, t.learningId, t);

  const scores = computeCompetenceProfile(
    referentiel.map((c) => ({ code: c.code, name: c.name, color: c.color })),
    observations,
  );

  return { referentiel, scores, evidences, traces, evidencesByLearning, tracesByLearning, latestByLearning };
}

/** Parcours de l'étudiant d'après sa promo la plus récente (null = inconnu / tronc commun) */
export async function loadStudentParcours(userId: string) {
  const memberships = await db.cohortMember.findMany({
    where: { userId },
    take: 20,
    select: { cohort: { select: { id: true, name: true, year: true, parcours: true, academicYear: true } } },
  });
  const cohorts = memberships
    .map((m) => m.cohort)
    .sort((a, b) => b.academicYear.localeCompare(a.academicYear) || b.year - a.year);
  const withParcours = cohorts.find((c) => c.parcours);
  return { cohorts, parcours: withParcours?.parcours ?? null, year: cohorts[0]?.year ?? null };
}
