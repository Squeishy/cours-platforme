import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { assertAllowed, requireUser } from "@/lib/session";
import {
  canEvaluateAssessment,
  canManageSae,
  canSeePeerReviews,
  canSeeTeacherFeedback,
  canViewSae,
} from "@/lib/permissions";
import { isSignificantGap } from "@/lib/competences";
import {
  averageLevel,
  countSignificantGaps,
  criterionSelect,
  feedbackStatus,
  formatAverage,
  formatDateTime,
  isFeedbackReady,
  isPeerReviewOpen,
  peerReviewClosesAt,
  toCriterionView,
} from "@/app/assessments/_lib/shared";
import { BackLink, CriterionHeading, GapFlag, LevelMeter, StatusBadge } from "@/app/assessments/_lib/ui";
import { ConfirmActionButton } from "@/app/assessments/_lib/confirm-action-button";
import { publishReadyFeedback, savePeerReviews } from "./actions";
import { FollowUp } from "./_components/follow-up";
import { PeerReviewForm } from "./_components/peer-review-form";
import { PeerReviewOverview } from "./_components/peer-review-overview";

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
      criteria: { orderBy: { position: "asc" }, select: criterionSelect },
    },
  });
  if (!milestone || milestone.saeId !== saeId) notFound();

  const { sae } = milestone;
  assertAllowed(canViewSae(user, sae));
  const isManager = canManageSae(user, sae);
  const canEvaluate = canEvaluateAssessment(user, sae);
  const criteria = milestone.criteria.map(toCriterionView);

  // ── Côté étudiant : mon groupe, mon auto-évaluation, mes évaluations de pairs ──
  const myGroup = await db.group.findFirst({
    where: { saeId: sae.id, members: { some: { userId: user.id } } },
    select: {
      id: true,
      name: true,
      members: { orderBy: { joinedAt: "asc" }, select: { userId: true, user: { select: { name: true } } } },
      _count: { select: { depositLinks: { where: { milestoneId: milestone.id } } } },
    },
  });
  const myAssessment = myGroup
    ? await db.selfAssessment.findUnique({
        where: { milestoneId_userId: { milestoneId: milestone.id, userId: user.id } },
        select: {
          id: true,
          userId: true,
          status: true,
          submittedAt: true,
          feedbackPublishedAt: true,
          items: { select: { criterionId: true, level: true, teacherLevel: true } },
        },
      })
    : null;
  const showMyFeedback = !!myAssessment?.feedbackPublishedAt && canSeeTeacherFeedback(user, myAssessment, sae);
  const myItems = myAssessment?.items ?? [];
  const mySelfAvg = averageLevel(myItems.map((i) => i.level));
  const myTeacherAvg = averageLevel(myItems.flatMap((i) => (i.teacherLevel != null ? [i.teacherLevel] : [])));
  const myGaps = countSignificantGaps(myItems);

  const peerEnabled = milestone.peerReviewEnabled;
  const peerOpen = isPeerReviewOpen(milestone.dueAt);
  const peerClosesAt = peerReviewClosesAt(milestone.dueAt);
  const teammates =
    myGroup?.members.filter((m) => m.userId !== user.id).map((m) => ({ id: m.userId, name: m.user.name })) ?? [];
  const myPeerReviews =
    peerEnabled && myGroup && teammates.length > 0
      ? await db.peerReview.findMany({
          where: { milestoneId: milestone.id, reviewerId: user.id, revieweeId: { in: teammates.map((t) => t.id) } },
          select: { revieweeId: true, contribution: true, comment: true, updatedAt: true },
        })
      : [];
  const lastPeerUpdate = myPeerReviews.reduce<Date | null>(
    (latest, r) => (!latest || r.updatedAt > latest ? r.updatedAt : latest),
    null,
  );

  // ── Côté équipe pédagogique : suivi groupes × étudiant·e·s ──
  const followUpGroups = isManager
    ? await db.group.findMany({
        where: { saeId: sae.id },
        orderBy: { name: "asc" },
        take: 200,
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
        take: 2000,
        select: {
          id: true,
          userId: true,
          status: true,
          submittedAt: true,
          feedbackPublishedAt: true,
          items: { select: { level: true, teacherLevel: true, teacherComment: true } },
          _count: { select: { comments: true } },
        },
      })
    : [];
  const peerReviews =
    isManager && peerEnabled
      ? await db.peerReview.findMany({
          where: { milestoneId: milestone.id },
          orderBy: { updatedAt: "desc" },
          take: 5000,
          select: { reviewerId: true, revieweeId: true, contribution: true, comment: true, updatedAt: true },
        })
      : [];

  const assessmentByUser = new Map(followUpAssessments.map((a) => [a.userId, a]));
  const groupsView = followUpGroups.map((g) => ({
    id: g.id,
    name: g.name,
    depositCount: g._count.depositLinks,
    members: g.members.map((m) => ({ userId: m.userId, name: m.user.name })),
  }));
  const totalStudents = groupsView.reduce((n, g) => n + g.members.length, 0);
  const submitted = followUpAssessments.filter((a) => a.status === "SUBMITTED");
  const publishedCount = submitted.filter((a) => a.feedbackPublishedAt).length;
  const readyCount = submitted.filter((a) => !a.feedbackPublishedAt && isFeedbackReady(a.items)).length;
  const draftCount = submitted.filter((a) => feedbackStatus(a) === "DRAFT").length;

  const assessHref = `/saes/${sae.id}/milestones/${milestone.id}/assess`;
  const reviewHref = `/saes/${sae.id}/review?milestone=${milestone.id}`;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <BackLink href={`/saes/${sae.id}`}>
          {sae.code ? `${sae.code} — ` : ""}
          {sae.title}
        </BackLink>
        <p className="eyebrow">Jalon</p>
        <h1 className="text-2xl font-semibold text-balance break-words">{milestone.title}</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">
            {milestone.dueAt ? `Échéance : ${formatDateTime(milestone.dueAt)}` : "Pas d'échéance fixée"}
          </span>
          {milestone.requiresDepositUrl && <span className="badge">Dépôt d&apos;URL requis</span>}
          {peerEnabled && <span className="badge">Évaluation entre pairs</span>}
        </div>
        {isManager && (
          <div className="flex flex-wrap gap-2 pt-2">
            <Link href={reviewHref} className="btn btn-primary w-full sm:w-auto">
              Corriger en file
            </Link>
          </div>
        )}
      </header>

      {milestone.description && (
        <section aria-label="Description du jalon">
          <p className="max-w-prose break-words whitespace-pre-line">{milestone.description}</p>
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
            <p role="note" className="rounded-md bg-danger-soft p-3 text-sm text-danger">
              Votre groupe n&apos;a encore déposé aucune URL pour ce jalon.{" "}
              <Link href={`/saes/${sae.id}/groups/${myGroup.id}#depots`} className="font-medium underline">
                Ajouter une URL de dépôt
              </Link>
            </p>
          )}

          {showMyFeedback && myAssessment?.feedbackPublishedAt && (
            <div className="flex flex-col gap-3 border-t border-line pt-3">
              <h3 className="font-semibold">Retour de l&apos;équipe pédagogique</h3>
              <p className="text-sm">
                Publié le {formatDateTime(myAssessment.feedbackPublishedAt)} · moyenne auto{" "}
                <strong>{formatAverage(mySelfAvg)}</strong> · enseignant <strong>{formatAverage(myTeacherAvg)}</strong>
                {myGaps > 0 && ` · ${myGaps} écart${myGaps > 1 ? "s" : ""} important${myGaps > 1 ? "s" : ""}`}
              </p>
              <ul className="flex flex-col gap-2">
                {criteria.map((c) => {
                  const item = myAssessment.items.find((i) => i.criterionId === c.id);
                  if (!item) return null;
                  return (
                    <li key={c.id} className="flex flex-col gap-1 rounded-md border border-line p-3">
                      <span className="flex flex-wrap items-baseline gap-2 text-sm">
                        {c.code && <span className="badge font-mono text-ink">{c.code}</span>}
                        <span className="font-medium break-words">{c.label}</span>
                      </span>
                      <span className="flex flex-col gap-1">
                        <LevelMeter level={item.level} prefix="Auto" />
                        {item.teacherLevel != null ? (
                          <LevelMeter level={item.teacherLevel} tone="teacher" prefix="Enseignant" />
                        ) : (
                          <span className="text-sm text-muted">Enseignant : pas de niveau</span>
                        )}
                      </span>
                      {isSignificantGap(item.level, item.teacherLevel) && item.teacherLevel != null && (
                        <span>
                          <GapFlag self={item.level} teacher={item.teacherLevel} />
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {myAssessment?.status === "SUBMITTED" ? (
              <Link href={`/assessments/${myAssessment.id}`} className="btn btn-primary w-full sm:w-auto">
                {showMyFeedback ? "Voir le détail du retour" : "Voir mon auto-évaluation"}
              </Link>
            ) : (
              <Link href={assessHref} className="btn btn-primary w-full sm:w-auto">
                {myAssessment ? "Continuer mon auto-évaluation" : "Commencer mon auto-évaluation"}
              </Link>
            )}
          </div>
        </section>
      )}

      {myGroup && peerEnabled && (
        <section aria-labelledby="peer-title" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="peer-title" className="text-lg font-semibold">
              Contribution de mes coéquipiers
            </h2>
            {teammates.length > 0 && (
              <span className={`badge ${myPeerReviews.length >= teammates.length ? "badge-ok" : "badge-warn"}`}>
                {myPeerReviews.length >= teammates.length
                  ? "Envoyée"
                  : `${myPeerReviews.length}/${teammates.length} évalué${myPeerReviews.length > 1 ? "s" : ""}`}
              </span>
            )}
          </div>
          <p className="max-w-prose text-sm text-muted">
            Situez l&apos;implication de chaque membre de votre groupe. Vos réponses sont confidentielles : seule
            l&apos;équipe pédagogique les consulte, vos coéquipiers ne voient ni vos niveaux ni vos commentaires — et
            vous ne voyez pas les leurs.{" "}
            {peerClosesAt
              ? peerOpen
                ? `Modifiable jusqu'au ${formatDateTime(peerClosesAt)}.`
                : `Période close depuis le ${formatDateTime(peerClosesAt)}.`
              : "Modifiable tant que le jalon n'a pas d'échéance."}
          </p>
          {teammates.length === 0 ? (
            <p className="card text-muted">Vous êtes seul·e dans votre groupe : aucune évaluation à faire.</p>
          ) : peerOpen ? (
            <PeerReviewForm
              action={savePeerReviews.bind(null, milestone.id)}
              teammates={teammates}
              existing={Object.fromEntries(
                myPeerReviews.map((r) => [r.revieweeId, { contribution: r.contribution, comment: r.comment }]),
              )}
            />
          ) : (
            <p className="card">
              {myPeerReviews.length > 0
                ? `Vous avez évalué ${myPeerReviews.length} coéquipier${myPeerReviews.length > 1 ? "s" : ""} sur ${teammates.length}${lastPeerUpdate ? ` (dernière modification le ${formatDateTime(lastPeerUpdate)})` : ""}.`
                : "Vous n'avez pas évalué vos coéquipiers pour ce jalon."}
            </p>
          )}
        </section>
      )}

      <section aria-labelledby="criteria-title" className="flex flex-col gap-3">
        <h2 id="criteria-title" className="text-lg font-semibold">
          Critères d&apos;évaluation
        </h2>
        {criteria.length === 0 ? (
          <p className="text-muted">Aucun critère défini pour ce jalon.</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {criteria.map((criterion) => (
              <li key={criterion.id} className="card flex flex-col gap-1">
                <CriterionHeading criterion={criterion} />
                {criterion.description && (
                  <p className="max-w-prose text-sm break-words whitespace-pre-line text-muted">
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
          <div className="flex flex-col gap-2">
            <h2 id="followup-title" className="text-lg font-semibold">
              Suivi des auto-évaluations
            </h2>
            <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <span>
                <strong className="font-mono tabular-nums">
                  {submitted.length}/{totalStudents}
                </strong>{" "}
                soumises
              </span>
              <span>
                <strong className="font-mono tabular-nums">{publishedCount}</strong> retour
                {publishedCount > 1 ? "s" : ""} publié{publishedCount > 1 ? "s" : ""}
              </span>
              <span>
                <strong className="font-mono tabular-nums">{draftCount}</strong> en brouillon
              </span>
            </p>
          </div>

          {canEvaluate && (
            <div className="card flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <p className="max-w-prose text-sm">
                {readyCount > 0 ? (
                  <>
                    <strong>{readyCount}</strong> retour{readyCount > 1 ? "s" : ""} prêt{readyCount > 1 ? "s" : ""} à
                    publier (chaque critère a un niveau enseignant).
                  </>
                ) : (
                  <span className="text-muted">
                    Aucun retour prêt : un retour est prêt quand chaque critère positionné par l&apos;étudiant·e a un
                    niveau enseignant.
                  </span>
                )}
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Link href={`${reviewHref}&filter=unpublished`} className="btn w-full sm:w-auto">
                  File « sans retour publié »
                </Link>
                <ConfirmActionButton
                  action={publishReadyFeedback.bind(null, milestone.id)}
                  label={`Publier tous les retours prêts${readyCount > 0 ? ` (${readyCount})` : ""}`}
                  pendingLabel="Publication…"
                  confirmMessage={`Publier ${readyCount} retour${readyCount > 1 ? "s" : ""} ? Chaque étudiant·e concerné·e sera notifié·e.`}
                  variant="primary"
                  disabled={readyCount === 0}
                  className="w-full sm:w-auto"
                />
              </div>
            </div>
          )}

          <FollowUp
            saeId={sae.id}
            requiresDepositUrl={milestone.requiresDepositUrl}
            groups={groupsView}
            assessmentByUser={assessmentByUser}
          />
        </section>
      )}

      {isManager && peerEnabled && (
        <PeerReviewOverview
          groups={groupsView}
          reviews={peerReviews}
          canSeeDetails={canSeePeerReviews(user, sae)}
          closesAt={peerClosesAt}
        />
      )}
    </div>
  );
}
