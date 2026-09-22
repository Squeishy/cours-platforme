import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { assertAllowed, requireUser } from "@/lib/session";
import {
  canCommentAssessment,
  canEditAssessment,
  canManageSae,
  canReopenAssessment,
  canViewAssessment,
} from "@/lib/permissions";
import { formatDateTime } from "@/app/assessments/_lib/shared";
import { StatusBadge, LevelMeter } from "@/app/assessments/_lib/ui";
import { ConfirmActionButton } from "@/app/assessments/_lib/confirm-action-button";
import { addComment, deleteComment, reopenAssessment } from "./actions";
import { CommentForm } from "./comment-form";

export const metadata: Metadata = { title: "Auto-évaluation" };

export default async function AssessmentPage({ params }: PageProps<"/assessments/[assessmentId]">) {
  const { assessmentId } = await params;
  const user = await requireUser();

  const assessment = await db.selfAssessment.findUnique({
    where: { id: assessmentId },
    include: {
      user: { select: { id: true, name: true } },
      group: {
        select: {
          id: true,
          name: true,
          members: { select: { userId: true } },
        },
      },
      milestone: {
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
      },
      items: true,
      comments: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, name: true, role: true } } },
      },
    },
  });
  if (!assessment) notFound();

  const { milestone } = assessment;
  const { sae } = milestone;
  assertAllowed(canViewAssessment(user, assessment, sae));

  const isManager = canManageSae(user, sae);
  const canEdit = canEditAssessment(user, assessment);
  const canReopen = assessment.status === "SUBMITTED" && canReopenAssessment(user, sae);
  const canComment = canCommentAssessment(user, assessment, sae);
  const isOwn = assessment.userId === user.id;
  const itemByCriterion = new Map(assessment.items.map((item) => [item.criterionId, item]));

  const milestoneHref = `/saes/${sae.id}/milestones/${milestone.id}`;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <nav aria-label="Fil d'Ariane" className="text-sm">
          <ol className="flex flex-wrap items-center gap-x-1 text-muted">
            <li>
              <Link href={`/saes/${sae.id}`} className="inline-flex min-h-11 items-center hover:text-ink hover:underline">
                {sae.code ? `${sae.code} — ` : ""}
                {sae.title}
              </Link>
            </li>
            <li aria-hidden="true">›</li>
            <li>
              <Link href={milestoneHref} className="inline-flex min-h-11 items-center hover:text-ink hover:underline">
                {milestone.title}
              </Link>
            </li>
          </ol>
        </nav>

        <h1 className="text-2xl font-semibold text-balance break-words">
          Auto-évaluation {isOwn ? "(la vôtre)" : `de ${assessment.user.name}`}
        </h1>

        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-muted">Étudiant·e</dt>
          <dd className="break-words">{assessment.user.name}</dd>
          <dt className="text-muted">Groupe</dt>
          <dd className="break-words">
            {assessment.group ? (
              <Link href={`/saes/${sae.id}/groups/${assessment.group.id}`} className="text-accent underline">
                {assessment.group.name}
              </Link>
            ) : (
              "—"
            )}
          </dd>
          <dt className="text-muted">Statut</dt>
          <dd>
            <StatusBadge status={assessment.status} />
          </dd>
          <dt className="text-muted">Soumise le</dt>
          <dd>{assessment.submittedAt ? formatDateTime(assessment.submittedAt) : "—"}</dd>
        </dl>

        {(canEdit || canReopen) && (
          <div className="flex flex-wrap gap-2">
            {canEdit && (
              <Link href={`${milestoneHref}/assess`} className="btn btn-primary w-full sm:w-auto">
                Modifier
              </Link>
            )}
            {canReopen && (
              <ConfirmActionButton
                action={reopenAssessment.bind(null, assessment.id)}
                label="Rouvrir"
                pendingLabel="Réouverture…"
                confirmMessage="Rouvrir cette auto-évaluation ? L'étudiant·e pourra la modifier puis la soumettre à nouveau."
              />
            )}
          </div>
        )}
      </header>

      <section aria-labelledby="criteria-title" className="flex flex-col gap-3">
        <h2 id="criteria-title" className="text-lg font-semibold">
          Positionnement par critère
        </h2>
        {milestone.criteria.length === 0 ? (
          <p className="text-muted">Aucun critère défini pour ce jalon.</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {milestone.criteria.map((criterion) => {
              const item = itemByCriterion.get(criterion.id);
              return (
                <li key={criterion.id} className="card flex flex-col gap-2">
                  <div className="flex flex-wrap items-baseline gap-2">
                    {criterion.acCode && <span className="badge font-mono text-ink">{criterion.acCode}</span>}
                    <h3 className="font-semibold break-words">{criterion.label}</h3>
                  </div>
                  {item ? (
                    <>
                      <LevelMeter level={item.level} />
                      {item.justification ? (
                        <p className="max-w-prose whitespace-pre-wrap break-words">{item.justification}</p>
                      ) : (
                        <p className="text-sm text-muted">Pas de justification.</p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-muted">Niveau non renseigné.</p>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section aria-labelledby="reflection-title" className="flex flex-col gap-2">
        <h2 id="reflection-title" className="text-lg font-semibold">
          Réflexion globale
        </h2>
        {assessment.reflection ? (
          <p className="card max-w-prose whitespace-pre-wrap break-words">{assessment.reflection}</p>
        ) : (
          <p className="text-muted">Aucune réflexion rédigée.</p>
        )}
      </section>

      <section aria-labelledby="comments-title" className="flex flex-col gap-4">
        <h2 id="comments-title" className="text-lg font-semibold">
          Commentaires ({assessment.comments.length})
        </h2>
        {assessment.comments.length === 0 ? (
          <p className="text-muted">Aucun commentaire pour l&apos;instant.</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {assessment.comments.map((comment) => {
              const authorIsTeacher = canManageSae(comment.author, sae);
              const canDelete = comment.author.id === user.id || isManager;
              return (
                <li key={comment.id} className="card flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium break-words">{comment.author.name}</span>
                    <span className={`badge ${authorIsTeacher ? "border-accent text-accent" : ""}`}>
                      {authorIsTeacher ? "Enseignant" : "Étudiant"}
                    </span>
                    <time dateTime={comment.createdAt.toISOString()} className="text-sm text-muted">
                      {formatDateTime(comment.createdAt)}
                    </time>
                  </div>
                  <p className="whitespace-pre-wrap break-words">{comment.body}</p>
                  {canDelete && (
                    <div>
                      <ConfirmActionButton
                        action={deleteComment.bind(null, comment.id)}
                        label="Supprimer"
                        pendingLabel="Suppression…"
                        confirmMessage="Supprimer ce commentaire ?"
                        ariaLabel={`Supprimer le commentaire de ${comment.author.name}`}
                        variant="danger"
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
        {canComment && <CommentForm action={addComment.bind(null, assessment.id)} />}
      </section>
    </div>
  );
}
