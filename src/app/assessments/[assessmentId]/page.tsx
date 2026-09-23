import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { assertAllowed, requireUser } from "@/lib/session";
import {
  canCommentAssessment,
  canEditAssessment,
  canEvaluateAssessment,
  canManageSae,
  canReopenAssessment,
  canSeeTeacherFeedback,
  canViewAssessment,
} from "@/lib/permissions";
import {
  averageLevel,
  countSignificantGaps,
  criterionSelect,
  feedbackStatus,
  formatAverage,
  formatDateTime,
  toCriterionView,
} from "@/app/assessments/_lib/shared";
import { FeedbackStatusBadge, StatusBadge } from "@/app/assessments/_lib/ui";
import { CriteriaComparison } from "@/app/assessments/_lib/comparison";
import { ConfirmActionButton } from "@/app/assessments/_lib/confirm-action-button";
import { TeacherFeedbackForm } from "@/app/assessments/_lib/teacher-feedback-form";
import { listMySnippets } from "@/app/assessments/_lib/snippets";
import { addComment, deleteComment, reopenAssessment, saveTeacherFeedback, unpublishFeedback } from "./actions";
import { CommentForm } from "./comment-form";

export const metadata: Metadata = { title: "Auto-évaluation" };

export default async function AssessmentPage({ params }: PageProps<"/assessments/[assessmentId]">) {
  const { assessmentId } = await params;
  const user = await requireUser();

  const assessment = await db.selfAssessment.findUnique({
    where: { id: assessmentId },
    include: {
      user: { select: { id: true, name: true } },
      feedbackBy: { select: { name: true } },
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
          criteria: { orderBy: { position: "asc" }, select: criterionSelect },
        },
      },
      items: true,
      comments: {
        orderBy: { createdAt: "asc" },
        take: 500,
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
  const canSeeTeacher = canSeeTeacherFeedback(user, assessment, sae);
  const canEvaluate = assessment.status === "SUBMITTED" && canEvaluateAssessment(user, sae);
  const isOwn = assessment.userId === user.id;
  const published = !!assessment.feedbackPublishedAt;
  const status = feedbackStatus(assessment);

  const snippets = isManager ? await listMySnippets(user) : [];
  const itemByCriterion = new Map(assessment.items.map((item) => [item.criterionId, item]));
  const criteria = milestone.criteria.map((c) => {
    const item = itemByCriterion.get(c.id);
    return {
      ...toCriterionView(c),
      self: item ? { level: item.level, justification: item.justification } : null,
      teacher: item ? { level: item.teacherLevel, comment: item.teacherComment } : null,
      teacherLevel: item?.teacherLevel ?? null,
      teacherComment: item?.teacherComment ?? null,
    };
  });

  const selfAvg = averageLevel(assessment.items.map((i) => i.level));
  const teacherAvg = averageLevel(assessment.items.flatMap((i) => (i.teacherLevel != null ? [i.teacherLevel] : [])));
  const gaps = countSignificantGaps(assessment.items);

  const milestoneHref = `/saes/${sae.id}/milestones/${milestone.id}`;
  const queueHref = `/saes/${sae.id}/review?milestone=${milestone.id}&a=${assessment.id}`;

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
          {isManager && (
            <>
              <dt className="text-muted">Retour enseignant</dt>
              <dd className="flex flex-wrap items-center gap-2">
                <FeedbackStatusBadge status={status} />
                {assessment.feedbackPublishedAt && (
                  <span className="text-muted">
                    le {formatDateTime(assessment.feedbackPublishedAt)}
                    {assessment.feedbackBy ? ` par ${assessment.feedbackBy.name}` : ""}
                  </span>
                )}
              </dd>
            </>
          )}
          {!isManager && isOwn && assessment.status === "SUBMITTED" && (
            <>
              <dt className="text-muted">Retour enseignant</dt>
              <dd>
                {assessment.feedbackPublishedAt
                  ? `Publié le ${formatDateTime(assessment.feedbackPublishedAt)}`
                  : "Pas encore publié"}
              </dd>
            </>
          )}
        </dl>

        {(canEdit || canReopen || canEvaluate) && (
          <div className="flex flex-wrap gap-2">
            {canEdit && (
              <Link href={`${milestoneHref}/assess`} className="btn btn-primary w-full sm:w-auto">
                Modifier
              </Link>
            )}
            {canEvaluate && (
              <Link href={queueHref} className="btn w-full sm:w-auto">
                Ouvrir dans la file de correction
              </Link>
            )}
            {canReopen && (
              <ConfirmActionButton
                action={reopenAssessment.bind(null, assessment.id)}
                label="Rouvrir"
                pendingLabel="Réouverture…"
                confirmMessage="Rouvrir cette auto-évaluation ? L'étudiant·e pourra la modifier puis la soumettre à nouveau, et sera notifié·e."
              />
            )}
          </div>
        )}
      </header>

      {canEvaluate ? (
        <section id="positionnement" aria-labelledby="feedback-title" className="flex scroll-mt-4 flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="feedback-title" className="text-lg font-semibold">
              Auto-positionnement et positionnement enseignant
            </h2>
            {published && (
              <ConfirmActionButton
                action={unpublishFeedback.bind(null, assessment.id)}
                label="Dépublier le retour"
                pendingLabel="Dépublication…"
                confirmMessage="Dépublier ce retour ? L'étudiant·e ne verra plus vos niveaux ni vos commentaires jusqu'à la prochaine publication."
              />
            )}
          </div>
          <p className="max-w-prose text-sm text-muted">
            Pour chaque critère, la justification de l&apos;étudiant·e est à gauche, votre positionnement à droite.
            Un écart de 2 niveaux ou plus est signalé « Écart important ».
          </p>
          <TeacherFeedbackForm
            action={saveTeacherFeedback.bind(null, assessment.id)}
            criteria={criteria}
            snippets={snippets}
            published={published}
            showJustifications
          />
        </section>
      ) : (
        <section aria-labelledby="criteria-title" className="flex flex-col gap-3">
          <h2 id="criteria-title" className="text-lg font-semibold">
            Positionnement par critère
          </h2>
          {canSeeTeacher && published && (
            <p className="text-sm">
              Moyenne auto : <strong>{formatAverage(selfAvg)}</strong> · enseignant :{" "}
              <strong>{formatAverage(teacherAvg)}</strong>
              {gaps > 0 && ` · ${gaps} écart${gaps > 1 ? "s" : ""} important${gaps > 1 ? "s" : ""}`}
            </p>
          )}
          {isOwn && !isManager && assessment.status === "SUBMITTED" && !published && (
            <p className="text-sm text-muted">Le retour de l&apos;équipe pédagogique n&apos;est pas encore publié.</p>
          )}
          {isManager && assessment.status === "DRAFT" && (
            <p className="text-sm text-muted">
              Le positionnement enseignant sera possible une fois l&apos;auto-évaluation soumise.
            </p>
          )}
          <CriteriaComparison criteria={criteria} showTeacher={canSeeTeacher} teacherDraft={!published} />
        </section>
      )}

      <section aria-labelledby="reflection-title" className="flex flex-col gap-2">
        <h2 id="reflection-title" className="text-lg font-semibold">
          Réflexion globale
        </h2>
        {assessment.reflection ? (
          <p className="card max-w-prose break-words whitespace-pre-line">{assessment.reflection}</p>
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
                    <span className={`badge ${authorIsTeacher ? "badge-accent" : ""}`}>
                      {authorIsTeacher ? "Enseignant" : "Étudiant"}
                    </span>
                    <time dateTime={comment.createdAt.toISOString()} className="text-sm text-muted">
                      {formatDateTime(comment.createdAt)}
                    </time>
                  </div>
                  <p className="break-words whitespace-pre-line">{comment.body}</p>
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
        {canComment && (
          <CommentForm action={addComment.bind(null, assessment.id)} snippets={isManager ? snippets : undefined} />
        )}
      </section>
    </div>
  );
}
