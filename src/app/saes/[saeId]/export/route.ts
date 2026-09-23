import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { canManageSae } from "@/lib/permissions";
import { slugify } from "@/lib/content";
import { formatAverage, toCsv, type CsvValue } from "../../_lib/csv";
import { criterionCode } from "../../_lib/criteria";

// Export du suivi (équipe pédagogique uniquement) : une ligne par étudiant × jalon.
// Les niveaux enseignant sont exportés même non publiés : le fichier est destiné à l'équipe.

const STATUS_LABELS = { DRAFT: "Brouillon", SUBMITTED: "Soumise" } as const;
const NO_GROUP = "Sans groupe";

const stamp = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function text(body: string, status: number) {
  return new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}

type Student = { id: string; name: string; email: string; group: string };

export async function GET(_request: Request, ctx: RouteContext<"/saes/[saeId]/export">) {
  const { saeId } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return text("Connexion requise.", 401);

  const sae = await db.sae.findUnique({
    where: { id: saeId },
    select: {
      id: true,
      code: true,
      title: true,
      ownerId: true,
      published: true,
      cohortId: true,
      teachers: { select: { id: true } },
      milestones: {
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        take: 200,
        select: {
          id: true,
          title: true,
          criteria: {
            orderBy: [{ position: "asc" }, { id: "asc" }],
            take: 200,
            select: { id: true, label: true, acCode: true, learning: { select: { code: true, label: true } } },
          },
        },
      },
      groups: {
        orderBy: { name: "asc" },
        take: 1000,
        select: {
          name: true,
          members: { select: { user: { select: { id: true, name: true, email: true, role: true } } } },
        },
      },
    },
  });
  if (!sae) return text("SAÉ introuvable.", 404);
  if (!canManageSae(user, sae)) return text("Accès réservé à l'équipe pédagogique de la SAÉ.", 403);

  const [assessments, cohortMembers] = await Promise.all([
    db.selfAssessment.findMany({
      where: { milestone: { saeId: sae.id } },
      take: 50_000,
      select: {
        milestoneId: true,
        userId: true,
        status: true,
        submittedAt: true,
        user: { select: { id: true, name: true, email: true } },
        items: { select: { criterionId: true, level: true, teacherLevel: true } },
      },
    }),
    sae.cohortId
      ? db.cohortMember.findMany({
          where: { cohortId: sae.cohortId, user: { role: "STUDENT" } },
          take: 3000,
          select: { user: { select: { id: true, name: true, email: true } } },
        })
      : Promise.resolve([]),
  ]);

  // Étudiants : membres des groupes, puis (sans groupe) ceux de la promo liée et ceux qui ont une auto-évaluation
  const students = new Map<string, Student>();
  for (const g of sae.groups) {
    for (const { user: u } of [...g.members].sort((a, b) => a.user.name.localeCompare(b.user.name, "fr"))) {
      if (u.role === "STUDENT" && !students.has(u.id)) students.set(u.id, { id: u.id, name: u.name, email: u.email, group: g.name });
    }
  }
  const loose = [...cohortMembers.map((m) => m.user), ...assessments.map((a) => a.user)]
    .filter((u) => !students.has(u.id))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
  for (const u of loose) {
    if (!students.has(u.id)) students.set(u.id, { id: u.id, name: u.name, email: u.email, group: NO_GROUP });
  }

  // Colonnes de critères : une par code (AC rattaché, code libre, sinon intitulé), dans l'ordre des jalons
  const columnKeys: string[] = [];
  const criterionColumn = new Map<string, string>();
  for (const m of sae.milestones) {
    const usedInMilestone = new Set<string>();
    for (const c of m.criteria) {
      const base = criterionCode(c) ?? c.label.slice(0, 60);
      let key = base;
      for (let n = 2; usedInMilestone.has(key); n++) key = `${base} (${n})`;
      usedInMilestone.add(key);
      criterionColumn.set(c.id, key);
      if (!columnKeys.includes(key)) columnKeys.push(key);
    }
  }

  const byStudentMilestone = new Map(assessments.map((a) => [`${a.userId}:${a.milestoneId}`, a]));

  const header: CsvValue[] = [
    "Groupe",
    "Nom",
    "E-mail",
    "Jalon",
    "Statut",
    "Soumise le",
    "Moyenne auto",
    "Moyenne enseignant",
    ...columnKeys.flatMap((k) => [`${k} (auto)`, `${k} (enseignant)`]),
  ];
  const rows: CsvValue[][] = [header];

  for (const s of students.values()) {
    for (const m of sae.milestones) {
      const a = byStudentMilestone.get(`${s.id}:${m.id}`);
      const levels = new Map<string, { self: number; teacher: number | null }>();
      for (const item of a?.items ?? []) {
        const key = criterionColumn.get(item.criterionId);
        if (key) levels.set(key, { self: item.level, teacher: item.teacherLevel });
      }
      const selfValues = (a?.items ?? []).map((i) => i.level);
      const teacherValues = (a?.items ?? []).flatMap((i) => (i.teacherLevel === null ? [] : [i.teacherLevel]));
      rows.push([
        s.group,
        s.name,
        s.email,
        m.title,
        a ? STATUS_LABELS[a.status] : "Non commencée",
        a?.submittedAt ? stamp.format(a.submittedAt) : "",
        formatAverage(selfValues),
        formatAverage(teacherValues),
        ...columnKeys.flatMap((k) => {
          const l = levels.get(k);
          return [l ? String(l.self) : "", l?.teacher != null ? String(l.teacher) : ""];
        }),
      ]);
    }
  }

  const filename = `suivi-${slugify(sae.code ?? "") || slugify(sae.title) || "sae"}.csv`;
  return new Response(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
