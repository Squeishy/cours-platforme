import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { assertAllowed, requireUser } from "@/lib/session";
import { canEditAssessment, canViewSae } from "@/lib/permissions";
import { criterionSelect, formatDateTime, toCriterionView } from "@/app/assessments/_lib/shared";
import { BackLink, StatusBadge } from "@/app/assessments/_lib/ui";
import { saveAssessment } from "./actions";
import { AssessForm } from "./assess-form";

export const metadata: Metadata = { title: "Mon auto-évaluation" };

export default async function AssessPage({ params }: PageProps<"/saes/[saeId]/milestones/[milestoneId]/assess">) {
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
  assertAllowed(canViewSae(user, milestone.sae));

  // Réservé aux membres d'un groupe de cette SAÉ
  const group = await db.group.findFirst({
    where: { saeId: milestone.saeId, members: { some: { userId: user.id } } },
    select: { id: true, name: true },
  });
  assertAllowed(!!group);

  const assessment = await db.selfAssessment.findUnique({
    where: { milestoneId_userId: { milestoneId: milestone.id, userId: user.id } },
    select: {
      id: true,
      userId: true,
      status: true,
      reflection: true,
      updatedAt: true,
      items: { select: { criterionId: true, level: true, justification: true } },
    },
  });
  if (assessment?.status === "SUBMITTED") redirect(`/assessments/${assessment.id}`);
  if (assessment) assertAllowed(canEditAssessment(user, assessment));

  const existingItems = Object.fromEntries(
    (assessment?.items ?? []).map((item) => [item.criterionId, { level: item.level, justification: item.justification }]),
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <BackLink href={`/saes/${milestone.sae.id}/milestones/${milestone.id}`}>{milestone.title}</BackLink>
        <p className="text-sm text-muted">
          {milestone.sae.code ? `${milestone.sae.code} — ` : ""}
          {milestone.sae.title} · groupe {group.name}
        </p>
        <h1 className="text-2xl font-semibold text-balance">Mon auto-évaluation</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <StatusBadge status={assessment?.status ?? null} />
          {assessment && <span className="text-muted">dernier enregistrement le {formatDateTime(assessment.updatedAt)}</span>}
        </div>
        <p className="max-w-prose text-sm text-muted">
          Pour chaque critère, situez-vous sur l&apos;échelle de 1 à 4 et justifiez avec des éléments concrets. Votre
          auto-évaluation soumise sera visible par l&apos;équipe pédagogique et par les membres de votre groupe, qui
          pourront la commenter.
        </p>
      </header>

      <AssessForm
        action={saveAssessment.bind(null, milestone.id)}
        criteria={milestone.criteria.map(toCriterionView)}
        existingItems={existingItems}
        reflection={assessment?.reflection ?? ""}
      />
    </div>
  );
}
