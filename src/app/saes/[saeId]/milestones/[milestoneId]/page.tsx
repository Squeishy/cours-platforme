import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { assertAllowed, requireUser } from "@/lib/session";
import { canManageSae, canViewSae } from "@/lib/permissions";
import {
  averageLevel,
  formatAverage,
  formatDate,
  formatDateTime,
} from "@/app/assessments/_lib/shared";
import { BackLink, StatusBadge } from "@/app/assessments/_lib/ui";

export const metadata: Metadata = { title: "Jalon" };

export default async function MilestonePage({ params }: PageProps<"/saes/[saeId]/milestones/[milestoneId]">) {
  const { saeId, milestoneId } = await params;
  const user = await requireUser();

  const milestone = await db.milestone.findUnique({
    where: { id: milestoneId },
    include: {
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
      criteria: { orderBy: { position: "asc" } },
    },
  });
  if (!milestone || milestone.saeId !== saeId) notFound();

  const { sae } = milestone;
  assertAllowed(canViewSae(user, sae));
  const isManager = canManageSae(user, sae);

  // Côté étudiant : mon groupe dans cette SAÉ et mon auto-évaluation
  const myGroup = await db.group.findFirst({
    where: { saeId: sae.id, members: { some: { userId: user.id } } },
    select: {
      id: true,
      name: true,
      _count: { select: { depositLinks: { where: { milestoneId: milestone.id } } } },
    },
  });
  const myAssessment = myGroup
    ? await db.selfAssessment.findUnique({
        where: { milestoneId_userId: { milestoneId: milestone.id, userId: user.id } },
        select: { id: true, status: true, submittedAt: true },
      })
    : null;

  // Côté équipe pédagogique : suivi groupes × étudiants
  const followUp = isManager
    ? await db.group.findMany({
        where: { saeId: sae.id },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          _count: { select: { depositLinks: { where: { milestoneId: milestone.id } } } },
          members: {
            orderBy: { joinedAt: "asc" },
            select: { userId: true, user: { select: { name: true } } },
          },
        },
      })
    : [];
  const followUpAssessments = isManager
    ? await db.selfAssessment.findMany({
        where: { milestoneId: milestone.id },
        select: {
          id: true,
          userId: true,
          status: true,
          submittedAt: true,
          items: { select: { level: true } },
          _count: { select: { comments: true } },
        },
      })
    : [];
  const assessmentByUser = new Map(followUpAssessments.map((a) => [a.userId, a]));
  const totalStudents = followUp.reduce((n, g) => n + g.members.length, 0);
  const submittedCount = followUp.reduce(
    (n, g) => n + g.members.filter((m) => assessmentByUser.get(m.userId)?.status === "SUBMITTED").length,
    0,
  );

  const assessHref = `/saes/${sae.id}/milestones/${milestone.id}/assess`;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <BackLink href={`/saes/${sae.id}`}>
          {sae.code ? `${sae.code} — ` : ""}
          {sae.title}
        </BackLink>
        <p className="text-sm text-muted">Jalon</p>
        <h1 className="text-2xl font-semibold text-balance break-words">{milestone.title}</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">
            {milestone.dueAt ? `Échéance : ${formatDateTime(milestone.dueAt)}` : "Pas d'échéance fixée"}
          </span>
          {milestone.requiresDepositUrl && <span className="badge">Dépôt d&apos;URL requis</span>}
        </div>
      </header>

      {milestone.description && (
        <section aria-label="Description du jalon">
          <p className="max-w-prose whitespace-pre-line break-words">{milestone.description}</p>
        </section>
      )}

      {milestone.requiresDepositUrl && (
        <p className="max-w-prose text-sm text-muted">
          Pour ce jalon, chaque groupe doit fournir au moins une URL de dépôt (dépôt Git, dossier partagé, maquette…)
          depuis son espace de groupe.
        </p>
      )}

      {myGroup && (
        <section aria-labelledby="my-assessment-title" className="card flex flex-col gap-3">
          <h2 id="my-assessment-title" className="text-lg font-semibold">
            Mon auto-évaluation
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={myAssessment?.status ?? null} />
            {myAssessment?.submittedAt && (
              <span className="text-sm text-muted">soumise le {formatDateTime(myAssessment.submittedAt)}</span>
            )}
          </div>
          <p className="text-sm text-muted">
            Groupe :{" "}
            <Link href={`/saes/${sae.id}/groups/${myGroup.id}`} className="text-accent underline">
              {myGroup.name}
            </Link>
          </p>

          {milestone.requiresDepositUrl && myGroup._count.depositLinks === 0 && (
            <p role="note" className="rounded-md border border-danger/40 bg-danger/5 p-3 text-sm">
              Votre groupe n&apos;a encore déposé aucune URL pour ce jalon.{" "}
              <Link href={`/saes/${sae.id}/groups/${myGroup.id}#depots`} className="font-medium underline">
                Ajouter une URL de dépôt
              </Link>
            </p>
          )}

          <div>
            {myAssessment?.status === "SUBMITTED" ? (
              <Link href={`/assessments/${myAssessment.id}`} className="btn btn-primary w-full sm:w-auto">
                Voir mon auto-évaluation
              </Link>
            ) : (
              <Link href={assessHref} className="btn btn-primary w-full sm:w-auto">
                {myAssessment ? "Continuer mon auto-évaluation" : "Commencer mon auto-évaluation"}
              </Link>
            )}
          </div>
        </section>
      )}

      <section aria-labelledby="criteria-title" className="flex flex-col gap-3">
        <h2 id="criteria-title" className="text-lg font-semibold">
          Critères d&apos;évaluation
        </h2>
        {milestone.criteria.length === 0 ? (
          <p className="text-muted">Aucun critère défini pour ce jalon.</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {milestone.criteria.map((criterion) => (
              <li key={criterion.id} className="card flex flex-col gap-1">
                <div className="flex flex-wrap items-baseline gap-2">
                  {criterion.acCode && <span className="badge font-mono text-ink">{criterion.acCode}</span>}
                  <span className="font-medium break-words">{criterion.label}</span>
                </div>
                {criterion.description && (
                  <p className="max-w-prose text-sm whitespace-pre-line break-words text-muted">
                    {criterion.description}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      {isManager && (
        <section aria-labelledby="followup-title" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="followup-title" className="text-lg font-semibold">
              Suivi des auto-évaluations
            </h2>
            <p className="text-sm">
              <strong>
                {submittedCount}/{totalStudents}
              </strong>{" "}
              soumises
            </p>
          </div>

          {followUp.length === 0 ? (
            <p className="text-muted">Aucun groupe dans cette SAÉ pour l&apos;instant.</p>
          ) : (
            followUp.map((group) => (
              <div key={group.id} className="flex flex-col gap-2">
                <h3 className="flex flex-wrap items-center gap-2 text-base font-semibold">
                  <Link href={`/saes/${sae.id}/groups/${group.id}`} className="break-words hover:underline">
                    {group.name}
                  </Link>
                  {milestone.requiresDepositUrl && (
                    <span className={`badge ${group._count.depositLinks > 0 ? "border-ok text-ok" : "text-danger"}`}>
                      {group._count.depositLinks > 0
                        ? `${group._count.depositLinks} URL déposée${group._count.depositLinks > 1 ? "s" : ""}`
                        : "Aucune URL déposée"}
                    </span>
                  )}
                </h3>

                {group.members.length === 0 ? (
                  <p className="text-sm text-muted">Aucun membre.</p>
                ) : (
                  <>
                    {/* Mobile : cartes */}
                    <ul className="flex flex-col gap-2 md:hidden">
                      {group.members.map((member) => {
                        const a = assessmentByUser.get(member.userId);
                        return (
                          <li key={member.userId} className="card flex flex-col gap-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-medium break-words">{member.user.name}</span>
                              <StatusBadge status={a?.status ?? null} />
                            </div>
                            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                              <dt className="text-muted">Soumise le</dt>
                              <dd>{a?.submittedAt ? formatDate(a.submittedAt) : "—"}</dd>
                              <dt className="text-muted">Niveau moyen</dt>
                              <dd>{formatAverage(averageLevel(a?.items.map((i) => i.level) ?? []))}</dd>
                              <dt className="text-muted">Commentaires</dt>
                              <dd>{a?._count.comments ?? 0}</dd>
                            </dl>
                            {a && (
                              <Link href={`/assessments/${a.id}`} className="btn w-full">
                                Ouvrir l&apos;auto-évaluation
                              </Link>
                            )}
                          </li>
                        );
                      })}
                    </ul>

                    {/* Tablette et plus : tableau */}
                    <div className="hidden md:block">
                      <table className="w-full border-collapse text-left text-sm">
                        <caption className="sr-only">Auto-évaluations du groupe {group.name}</caption>
                        <thead>
                          <tr className="border-b border-line text-muted">
                            <th scope="col" className="py-2 pr-3 font-medium">Étudiant·e</th>
                            <th scope="col" className="py-2 pr-3 font-medium">Statut</th>
                            <th scope="col" className="py-2 pr-3 font-medium">Soumise le</th>
                            <th scope="col" className="py-2 pr-3 font-medium">Niveau moyen</th>
                            <th scope="col" className="py-2 pr-3 font-medium">Commentaires</th>
                            <th scope="col" className="py-2 font-medium">
                              <span className="sr-only">Action</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.members.map((member) => {
                            const a = assessmentByUser.get(member.userId);
                            return (
                              <tr key={member.userId} className="border-b border-line">
                                <th scope="row" className="py-2 pr-3 font-medium">
                                  {member.user.name}
                                </th>
                                <td className="py-2 pr-3">
                                  <StatusBadge status={a?.status ?? null} />
                                </td>
                                <td className="py-2 pr-3">{a?.submittedAt ? formatDate(a.submittedAt) : "—"}</td>
                                <td className="py-2 pr-3">
                                  {formatAverage(averageLevel(a?.items.map((i) => i.level) ?? []))}
                                </td>
                                <td className="py-2 pr-3">{a?._count.comments ?? 0}</td>
                                <td className="py-2">
                                  {a ? (
                                    <Link
                                      href={`/assessments/${a.id}`}
                                      className="inline-flex min-h-11 items-center text-accent underline"
                                      aria-label={`Ouvrir l'auto-évaluation de ${member.user.name}`}
                                    >
                                      Ouvrir
                                    </Link>
                                  ) : (
                                    <span className="text-muted">—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </section>
      )}
    </div>
  );
}
