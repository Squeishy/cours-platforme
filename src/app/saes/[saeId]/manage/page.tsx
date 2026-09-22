import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { assertAllowed, requireUser } from "@/lib/session";
import { canDeleteSae, canManageSae } from "@/lib/permissions";
import {
  addGroupMember,
  addSaeTeacher,
  createCriterion,
  createGroup,
  createMilestone,
  deleteCriterion,
  deleteGroup,
  deleteMilestone,
  deleteSae,
  moveCriterion,
  moveMilestone,
  removeGroupMember,
  removeSaeTeacher,
  renameGroup,
  setSaePublished,
  updateCriterion,
  updateMilestone,
  updateSaeSettings,
} from "../../actions";
import { ActionForm, SubmitButton } from "../../_components/action-form";
import { SaeFields, type CourseOption } from "../../_components/sae-fields";
import { findCohortOptions, findEditableCourses, loadAcGroups } from "../../_lib/queries";
import { formatDateTime } from "../../_lib/dates";
import { criterionCode, learningHint, levelForSemester } from "../../_lib/criteria";
import { Checkbox, EditDisclosure, MilestoneFields, MoveButtons } from "./fields";
import { AcOptionsProvider, CriterionFields } from "./criterion-fields";
import { AnnouncementsSection } from "./announcements";
import { AutoGroupsCard, BulkMembersForm } from "./group-formation";
import { DuplicateSection } from "./duplicate-form";

export const metadata: Metadata = { title: "Gérer la SAÉ" };

const plural = (n: number, singular: string, pluralForm = `${singular}s`) => `${n} ${n > 1 ? pluralForm : singular}`;

const SECTIONS = [
  ["reglages", "Réglages"],
  ["equipe", "Équipe"],
  ["annonces", "Annonces"],
  ["jalons", "Jalons"],
  ["groupes", "Groupes"],
  ["reconduire", "Reconduire"],
] as const;

export default async function ManageSaePage({ params }: PageProps<"/saes/[saeId]/manage">) {
  const { saeId } = await params;
  const user = await requireUser();

  const sae = await db.sae.findUnique({
    where: { id: saeId },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      teachers: { select: { id: true, name: true, email: true }, orderBy: { name: "asc" } },
      course: { select: { id: true, title: true } },
      cohort: { select: { id: true, name: true, academicYear: true } },
      milestones: {
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        take: 200,
        include: {
          criteria: {
            orderBy: [{ position: "asc" }, { id: "asc" }],
            take: 200,
            include: {
              learning: { select: { code: true, label: true } },
              _count: { select: { items: true } },
            },
          },
          _count: { select: { assessments: true } },
        },
      },
      groups: {
        orderBy: { name: "asc" },
        take: 500,
        include: {
          members: {
            orderBy: { joinedAt: "asc" },
            select: { userId: true, user: { select: { name: true, email: true } } },
          },
          _count: { select: { depositLinks: true } },
        },
      },
      announcements: {
        orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
        take: 20,
        select: { id: true, title: true, body: true, pinned: true, createdAt: true, author: { select: { name: true } } },
      },
      _count: { select: { defenseSlots: true } },
    },
  });
  if (!sae) notFound();
  assertAllowed(canManageSae(user, sae));

  const [editableCourses, cohorts, acGroups, unassigned] = await Promise.all([
    findEditableCourses(user),
    findCohortOptions(),
    loadAcGroups(),
    sae.cohortId
      ? db.cohortMember.count({
          where: {
            cohortId: sae.cohortId,
            user: { role: "STUDENT", memberships: { none: { group: { saeId: sae.id } } } },
          },
        })
      : Promise.resolve(0),
  ]);
  // Le cours actuellement lié reste sélectionnable même si je ne peux pas l'éditer
  const courses: CourseOption[] =
    sae.course && !editableCourses.some((c) => c.id === sae.course?.id)
      ? [sae.course, ...editableCourses]
      : editableCourses;
  const canDelete = canDeleteSae(user, sae);
  const defaultLevel = levelForSemester(sae.semester);

  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <Link href={`/saes/${sae.id}`} className="inline-flex min-h-11 items-center text-sm text-muted hover:underline">
          ← Retour à la SAÉ
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow font-mono">
              Gestion{sae.code ? ` · ${sae.code}` : ""}
              {sae.semester ? ` · S${sae.semester}` : ""}
            </p>
            <h1 className="text-2xl font-semibold text-balance break-words">{sae.title}</h1>
            <p className="mt-1 flex flex-wrap gap-2">
              <span className={`badge ${sae.published ? "badge-ok" : "badge-warn"}`}>
                {sae.published ? "Publiée" : "Brouillon"}
              </span>
              {sae.cohort && <span className="badge">Promo {sae.cohort.name}</span>}
            </p>
          </div>
          <ActionForm action={setSaePublished} className="max-w-full">
            <input type="hidden" name="saeId" value={sae.id} />
            <input type="hidden" name="published" value={sae.published ? "false" : "true"} />
            <SubmitButton
              className={sae.published ? "btn" : "btn btn-primary"}
              pendingLabel={sae.published ? "Dépublication…" : "Publication…"}
            >
              {sae.published ? "Repasser en brouillon" : "Publier"}
            </SubmitButton>
          </ActionForm>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/saes/${sae.id}/defenses`} className="btn">
            Soutenances
            <span className="font-mono text-xs text-muted">{sae._count.defenseSlots}</span>
          </Link>
          {/* Route handler (téléchargement) : lien natif, pas de navigation client */}
          <a href={`/saes/${sae.id}/export`} className="btn" download>
            Exporter le suivi (CSV)
          </a>
        </div>
        <nav aria-label="Sections" className="flex flex-wrap gap-x-4 text-sm">
          {SECTIONS.map(([anchor, label]) => (
            <a key={anchor} href={`#${anchor}`} className="flex min-h-11 items-center underline">
              {label}
            </a>
          ))}
        </nav>
      </header>

      {/* ── Réglages ─────────────────────────────────────────── */}
      <section aria-labelledby="reglages" className="scroll-mt-4 space-y-3">
        <h2 id="reglages" className="text-xl font-semibold">
          Réglages
        </h2>
        <ActionForm action={updateSaeSettings} className="card space-y-4" aria-label="Réglages de la SAÉ">
          <input type="hidden" name="saeId" value={sae.id} />
          <SaeFields
            idPrefix="settings"
            courses={courses}
            cohorts={cohorts}
            defaults={{
              code: sae.code,
              title: sae.title,
              semester: sae.semester,
              competences: sae.competences,
              startsAt: sae.startsAt,
              endsAt: sae.endsAt,
              courseId: sae.courseId,
              cohortId: sae.cohortId,
            }}
          />
          <Checkbox id="settings-published" name="published" defaultChecked={sae.published}>
            Publiée (visible par les étudiants)
          </Checkbox>
          <SubmitButton pendingLabel="Enregistrement…">Enregistrer les réglages</SubmitButton>
        </ActionForm>
      </section>

      {/* ── Équipe pédagogique ───────────────────────────────── */}
      <section aria-labelledby="equipe" className="scroll-mt-4 space-y-3">
        <h2 id="equipe" className="text-xl font-semibold">
          Équipe pédagogique
        </h2>
        <div className="card space-y-4">
          <ul className="divide-y divide-line">
            <li className="flex min-h-11 flex-wrap items-center justify-between gap-2 py-2">
              <span className="min-w-0 break-words">
                {sae.owner.name} <span className="text-sm text-muted">· {sae.owner.email}</span>
              </span>
              <span className="badge">Responsable</span>
            </li>
            {sae.teachers.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="min-w-0 break-words">
                  {t.name} <span className="text-sm text-muted">· {t.email}</span>
                </span>
                <ActionForm
                  action={removeSaeTeacher}
                  quiet
                  confirmMessage={`Retirer ${t.name} de l'équipe pédagogique ?`}
                >
                  <input type="hidden" name="saeId" value={sae.id} />
                  <input type="hidden" name="userId" value={t.id} />
                  <SubmitButton className="btn btn-danger" pendingLabel="Retrait…">
                    Retirer
                  </SubmitButton>
                </ActionForm>
              </li>
            ))}
          </ul>
          {sae.teachers.length === 0 && <p className="text-sm text-muted">Aucun co-enseignant pour l&apos;instant.</p>}
          <ActionForm action={addSaeTeacher} resetOnSuccess aria-label="Ajouter un co-enseignant">
            <input type="hidden" name="saeId" value={sae.id} />
            <label htmlFor="teacher-email" className="label">
              Ajouter un co-enseignant (e-mail d&apos;un compte enseignant)
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="teacher-email"
                name="email"
                type="email"
                required
                maxLength={254}
                autoComplete="off"
                className="input"
                placeholder="prenom.nom@univ.fr"
              />
              <SubmitButton pendingLabel="Ajout…">Ajouter</SubmitButton>
            </div>
          </ActionForm>
        </div>
      </section>

      {/* ── Annonces ─────────────────────────────────────────── */}
      <AnnouncementsSection
        saeId={sae.id}
        published={sae.published}
        cohortLinked={!!sae.cohortId}
        announcements={sae.announcements}
      />

      {/* ── Jalons & critères ────────────────────────────────── */}
      <section aria-labelledby="jalons" className="scroll-mt-4 space-y-3">
        <h2 id="jalons" className="text-xl font-semibold">
          Jalons
        </h2>
        <AcOptionsProvider groups={acGroups}>
          {sae.milestones.length === 0 ? (
            <p className="card text-muted">
              Aucun jalon. Ajoutez le premier pour que les étudiants voient l&apos;échéance.
            </p>
          ) : (
            <ol className="space-y-4">
              {sae.milestones.map((m, mIndex) => {
                const itemCount = m.criteria.reduce((sum, c) => sum + c._count.items, 0);
                const deleteWarning =
                  `Supprimer le jalon « ${m.title} » ?` +
                  (m.criteria.length > 0 || m._count.assessments > 0
                    ? ` Ses ${plural(m.criteria.length, "critère")} et ${plural(
                        m._count.assessments,
                        "auto-évaluation",
                      )} d'étudiants seront définitivement supprimés.`
                    : "");
                return (
                  <li key={m.id} className="card space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold break-words">
                          <span className="font-mono text-muted">{mIndex + 1}. </span>
                          {m.title}
                        </h3>
                        <p className="text-sm text-muted">
                          {m.dueAt ? `Échéance : ${formatDateTime(m.dueAt)}` : "Sans échéance"}
                          {m._count.assessments > 0 && ` · ${plural(m._count.assessments, "auto-évaluation")}`}
                        </p>
                        {(m.requiresDepositUrl || m.peerReviewEnabled) && (
                          <p className="mt-1 flex flex-wrap gap-2">
                            {m.requiresDepositUrl && <span className="badge">Dépôt d&apos;URL requis</span>}
                            {m.peerReviewEnabled && <span className="badge">Contribution entre pairs</span>}
                          </p>
                        )}
                      </div>
                      <MoveButtons
                        action={moveMilestone}
                        idName="milestoneId"
                        idValue={m.id}
                        label={`le jalon ${m.title}`}
                        isFirst={mIndex === 0}
                        isLast={mIndex === sae.milestones.length - 1}
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Link href={`/saes/${sae.id}/milestones/${m.id}`} className="btn">
                        Suivi du jalon
                      </Link>
                    </div>

                    <EditDisclosure summary="Modifier le jalon">
                      <ActionForm action={updateMilestone} className="space-y-3" aria-label={`Modifier ${m.title}`}>
                        <input type="hidden" name="milestoneId" value={m.id} />
                        <MilestoneFields
                          idPrefix={`milestone-${m.id}`}
                          defaults={{
                            title: m.title,
                            description: m.description,
                            dueAt: m.dueAt,
                            requiresDepositUrl: m.requiresDepositUrl,
                            peerReviewEnabled: m.peerReviewEnabled,
                          }}
                        />
                        <SubmitButton pendingLabel="Enregistrement…">Enregistrer le jalon</SubmitButton>
                      </ActionForm>
                    </EditDisclosure>

                    {/* Critères */}
                    <div className="space-y-3 border-t border-line pt-4">
                      <h4 className="font-medium">
                        Critères <span className="text-sm font-normal text-muted">({m.criteria.length})</span>
                      </h4>
                      {m.criteria.length === 0 ? (
                        <p className="text-sm text-muted">
                          Aucun critère. Rattachez-les aux apprentissages critiques pour alimenter le portfolio.
                        </p>
                      ) : (
                        <ol className="divide-y divide-line">
                          {m.criteria.map((c, cIndex) => {
                            const code = criterionCode(c);
                            const hint = learningHint(c);
                            return (
                              <li key={c.id} className="space-y-3 py-3">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div className="min-w-0 flex-1">
                                    <p className="break-words">
                                      {code && (
                                        <span
                                          className={`badge mr-2 font-mono ${c.learning ? "badge-accent" : ""}`}
                                          title={c.learning ? "Rattaché au référentiel" : "Code libre (non rattaché)"}
                                        >
                                          {code}
                                        </span>
                                      )}
                                      {c.label}
                                    </p>
                                    {hint && (
                                      <p className="mt-1 text-xs text-muted break-words">
                                        {c.learning?.code} — {hint}
                                      </p>
                                    )}
                                    {c.description && (
                                      <p className="mt-1 text-sm text-muted break-words whitespace-pre-line">
                                        {c.description}
                                      </p>
                                    )}
                                    {c._count.items > 0 && (
                                      <p className="mt-1 text-xs text-muted">
                                        {plural(c._count.items, "positionnement")} d&apos;étudiants
                                      </p>
                                    )}
                                  </div>
                                  <MoveButtons
                                    action={moveCriterion}
                                    idName="criterionId"
                                    idValue={c.id}
                                    label={`le critère ${c.label}`}
                                    isFirst={cIndex === 0}
                                    isLast={cIndex === m.criteria.length - 1}
                                  />
                                </div>
                                <div className="flex flex-wrap items-start gap-2">
                                  <EditDisclosure summary="Modifier">
                                    <ActionForm
                                      action={updateCriterion}
                                      className="space-y-3"
                                      aria-label={`Modifier le critère ${c.label}`}
                                    >
                                      <input type="hidden" name="criterionId" value={c.id} />
                                      <CriterionFields
                                        idPrefix={`criterion-${c.id}`}
                                        defaultLevel={defaultLevel}
                                        defaults={{
                                          label: c.label,
                                          description: c.description,
                                          acCode: c.acCode,
                                          learningId: c.learningId,
                                        }}
                                      />
                                      <SubmitButton pendingLabel="Enregistrement…">Enregistrer le critère</SubmitButton>
                                    </ActionForm>
                                  </EditDisclosure>
                                  <ActionForm
                                    action={deleteCriterion}
                                    quiet
                                    confirmMessage={
                                      c._count.items > 0
                                        ? `Attention : ${plural(c._count.items, "positionnement")} d'étudiants sur « ${c.label} » seront définitivement supprimés avec ce critère. Continuer ?`
                                        : `Supprimer le critère « ${c.label} » ?`
                                    }
                                  >
                                    <input type="hidden" name="criterionId" value={c.id} />
                                    <SubmitButton className="btn btn-danger" pendingLabel="Suppression…">
                                      Supprimer
                                    </SubmitButton>
                                  </ActionForm>
                                </div>
                              </li>
                            );
                          })}
                        </ol>
                      )}
                      <EditDisclosure summary="Ajouter un critère">
                        <ActionForm
                          action={createCriterion}
                          resetOnSuccess
                          className="space-y-3"
                          aria-label={`Ajouter un critère à ${m.title}`}
                        >
                          <input type="hidden" name="milestoneId" value={m.id} />
                          <CriterionFields idPrefix={`new-criterion-${m.id}`} defaultLevel={defaultLevel} />
                          <SubmitButton pendingLabel="Ajout…">Ajouter le critère</SubmitButton>
                        </ActionForm>
                      </EditDisclosure>
                    </div>

                    <div className="border-t border-line pt-4">
                      <ActionForm action={deleteMilestone} quiet confirmMessage={deleteWarning}>
                        <input type="hidden" name="milestoneId" value={m.id} />
                        <SubmitButton className="btn btn-danger" pendingLabel="Suppression…">
                          Supprimer le jalon
                        </SubmitButton>
                      </ActionForm>
                      {itemCount > 0 && (
                        <p className="mt-1 text-xs text-muted">Des étudiants se sont déjà positionnés sur ce jalon.</p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </AcOptionsProvider>

        <div className="card space-y-3">
          <h3 className="font-semibold">Nouveau jalon</h3>
          <ActionForm action={createMilestone} resetOnSuccess className="space-y-3" aria-label="Ajouter un jalon">
            <input type="hidden" name="saeId" value={sae.id} />
            <MilestoneFields idPrefix="new-milestone" />
            <SubmitButton pendingLabel="Ajout…">Ajouter le jalon</SubmitButton>
          </ActionForm>
        </div>
      </section>

      {/* ── Groupes ──────────────────────────────────────────── */}
      <section aria-labelledby="groupes" className="scroll-mt-4 space-y-3">
        <h2 id="groupes" className="text-xl font-semibold">
          Groupes
        </h2>
        <p className="text-sm text-muted">Un étudiant ne peut appartenir qu&apos;à un seul groupe par SAÉ.</p>

        <AutoGroupsCard saeId={sae.id} cohort={sae.cohort} unassigned={unassigned} />

        {sae.groups.length === 0 ? (
          <p className="card text-muted">Aucun groupe pour l&apos;instant.</p>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {sae.groups.map((g) => (
              <li key={g.id} className="card space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="min-w-0 font-semibold break-words">
                    {g.name}{" "}
                    <span className="font-mono text-xs font-normal text-muted">{plural(g.members.length, "membre")}</span>
                  </h3>
                  <Link href={`/saes/${sae.id}/groups/${g.id}`} className="btn">
                    Espace du groupe
                  </Link>
                </div>

                {g.members.length === 0 ? (
                  <p className="text-sm text-muted">Aucun membre pour l&apos;instant.</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {g.members.map((member) => (
                      <li key={member.userId} className="flex flex-wrap items-center justify-between gap-2 py-2">
                        <span className="min-w-0 break-words">
                          {member.user.name}
                          <span className="block text-xs text-muted break-all">{member.user.email}</span>
                        </span>
                        <ActionForm
                          action={removeGroupMember}
                          quiet
                          confirmMessage={`Retirer ${member.user.name} du groupe « ${g.name} » ?`}
                        >
                          <input type="hidden" name="groupId" value={g.id} />
                          <input type="hidden" name="userId" value={member.userId} />
                          <SubmitButton className="btn btn-danger" pendingLabel="Retrait…">
                            Retirer
                          </SubmitButton>
                        </ActionForm>
                      </li>
                    ))}
                  </ul>
                )}

                <ActionForm action={addGroupMember} resetOnSuccess aria-label={`Ajouter un membre à ${g.name}`}>
                  <input type="hidden" name="groupId" value={g.id} />
                  <label htmlFor={`member-email-${g.id}`} className="label">
                    Ajouter un étudiant (e-mail)
                  </label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      id={`member-email-${g.id}`}
                      name="email"
                      type="email"
                      required
                      maxLength={254}
                      autoComplete="off"
                      className="input"
                      placeholder="etudiant@univ.fr"
                    />
                    <SubmitButton pendingLabel="Ajout…">Ajouter</SubmitButton>
                  </div>
                </ActionForm>

                <div className="flex flex-wrap items-start gap-2 border-t border-line pt-3">
                  <BulkMembersForm groupId={g.id} groupName={g.name} />
                  <EditDisclosure summary="Renommer">
                    <ActionForm action={renameGroup} aria-label={`Renommer ${g.name}`}>
                      <input type="hidden" name="groupId" value={g.id} />
                      <label htmlFor={`group-name-${g.id}`} className="label">
                        Nom du groupe
                      </label>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <input
                          id={`group-name-${g.id}`}
                          name="name"
                          required
                          maxLength={100}
                          className="input"
                          defaultValue={g.name}
                        />
                        <SubmitButton pendingLabel="Enregistrement…">Renommer</SubmitButton>
                      </div>
                    </ActionForm>
                  </EditDisclosure>
                  <ActionForm
                    action={deleteGroup}
                    quiet
                    confirmMessage={
                      `Supprimer le groupe « ${g.name} » ?` +
                      (g._count.depositLinks > 0
                        ? ` Ses ${plural(g._count.depositLinks, "URL de dépôt", "URL de dépôt")} seront supprimées.`
                        : "") +
                      " Les auto-évaluations des membres sont conservées."
                    }
                  >
                    <input type="hidden" name="groupId" value={g.id} />
                    <SubmitButton className="btn btn-danger" pendingLabel="Suppression…">
                      Supprimer le groupe
                    </SubmitButton>
                  </ActionForm>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="card">
          <ActionForm action={createGroup} resetOnSuccess aria-label="Créer un groupe">
            <input type="hidden" name="saeId" value={sae.id} />
            <label htmlFor="new-group-name" className="label">
              Nouveau groupe
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="new-group-name"
                name="name"
                required
                maxLength={100}
                className="input"
                placeholder="Groupe A"
              />
              <SubmitButton pendingLabel="Création…">Créer le groupe</SubmitButton>
            </div>
          </ActionForm>
        </div>
      </section>

      {/* ── Reconduction ─────────────────────────────────────── */}
      <DuplicateSection saeId={sae.id} milestones={sae.milestones.length} />

      {/* ── Zone de danger ───────────────────────────────────── */}
      {canDelete && (
        <section aria-labelledby="danger" className="space-y-3">
          <h2 id="danger" className="text-xl font-semibold text-danger">
            Supprimer la SAÉ
          </h2>
          <div className="card space-y-3 border-danger">
            <p className="text-sm">
              Supprime définitivement la SAÉ, son sujet, ses {plural(sae.milestones.length, "jalon")}, leurs critères,
              ses {plural(sae.groups.length, "groupe")} et toutes les auto-évaluations associées.
            </p>
            <ActionForm
              action={deleteSae}
              confirmMessage={`Supprimer définitivement « ${sae.title} » et toutes ses données ? Cette action est irréversible.`}
            >
              <input type="hidden" name="saeId" value={sae.id} />
              <SubmitButton className="btn btn-danger" pendingLabel="Suppression…">
                Supprimer définitivement
              </SubmitButton>
            </ActionForm>
          </div>
        </section>
      )}
    </div>
  );
}
