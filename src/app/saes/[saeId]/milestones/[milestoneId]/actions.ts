"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { notify } from "@/lib/notify";
import { canEvaluateAssessment, canReviewPeer, canViewSae } from "@/lib/permissions";
import { CONTRIBUTION_LEVELS } from "@/lib/assessment";
import {
  firstIssue,
  formatDateTime,
  isFeedbackReady,
  isPeerReviewOpen,
  peerReviewClosesAt,
  type ActionResult,
} from "@/app/assessments/_lib/shared";
import { idSchema, optionalBodySchema, readKeyedFields } from "@/app/assessments/_lib/validation";

const saeAccess = { ownerId: true, published: true, teachers: { select: { id: true } } } as const;

function revalidateMilestone(saeId: string, milestoneId: string) {
  revalidatePath(`/saes/${saeId}/milestones/${milestoneId}`);
  revalidatePath(`/saes/${saeId}/review`);
}

// ── Publication groupée des retours prêts ─────────────────────

/** Publie les retours dont chaque critère positionné a un niveau enseignant, et notifie chaque étudiant·e */
export async function publishReadyFeedback(milestoneId: string): Promise<ActionResult> {
  const user = await requireUser();
  const id = idSchema.safeParse(milestoneId);
  if (!id.success) return { ok: false, error: "Jalon invalide" };

  const milestone = await db.milestone.findUnique({
    where: { id: id.data },
    select: { id: true, title: true, saeId: true, sae: { select: saeAccess } },
  });
  if (!milestone) return { ok: false, error: "Jalon introuvable" };
  if (!canEvaluateAssessment(user, milestone.sae)) {
    return { ok: false, error: "Seule l'équipe pédagogique de la SAÉ peut publier les retours" };
  }

  const candidates = await db.selfAssessment.findMany({
    where: { milestoneId: milestone.id, status: "SUBMITTED", feedbackPublishedAt: null },
    select: { id: true, userId: true, groupId: true, items: { select: { teacherLevel: true } } },
    take: 1000,
  });
  const ready = candidates.filter((a) => isFeedbackReady(a.items));
  if (ready.length === 0) return { ok: false, error: "Aucun retour prêt à publier" };

  const now = new Date();
  const published = await db.$transaction(async (tx) => {
    const result = await tx.selfAssessment.updateMany({
      // Garde-fous : toujours soumise et toujours non publiée au moment de l'écriture
      where: { id: { in: ready.map((a) => a.id) }, status: "SUBMITTED", feedbackPublishedAt: null },
      data: { feedbackPublishedAt: now, feedbackById: user.id },
    });
    return result.count;
  });

  for (const a of ready) {
    await notify(
      [a.userId],
      {
        type: "feedback",
        title: `Retour publié sur ${milestone.title}`,
        body: `${user.name} a publié son positionnement sur votre auto-évaluation.`,
        link: `/assessments/${a.id}`,
      },
      user.id,
    );
    revalidatePath(`/assessments/${a.id}`);
    if (a.groupId) revalidatePath(`/saes/${milestone.saeId}/groups/${a.groupId}`);
  }

  revalidateMilestone(milestone.saeId, milestone.id);
  revalidatePath("/me/competences");
  return { ok: true, message: `${published} retour${published > 1 ? "s" : ""} publié${published > 1 ? "s" : ""}` };
}

// ── Contribution entre pairs ──────────────────────────────────

const contributionValues = CONTRIBUTION_LEVELS.map((l) => String(l.value));

const peerSchema = z
  .array(
    z.object({
      revieweeId: idSchema,
      contribution: z
        .string()
        .refine((v) => v === "" || contributionValues.includes(v), "Niveau de contribution invalide")
        .transform((v) => (v === "" ? null : Number(v))),
      comment: optionalBodySchema,
    }),
  )
  .max(50);

/**
 * Évaluation de la contribution des coéquipiers (un membre note chaque AUTRE membre).
 * Champs : `contribution:<userId>` (1..4) et `peerComment:<userId>`. Modifiable jusqu'à échéance + 7 jours.
 */
export async function savePeerReviews(
  milestoneId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const id = idSchema.safeParse(milestoneId);
  if (!id.success) return { ok: false, error: "Jalon invalide" };

  const fields = readKeyedFields(formData, ["contribution", "peerComment"] as const);
  const parsed = peerSchema.safeParse(
    [...fields.entries()].map(([revieweeId, f]) => ({
      revieweeId,
      contribution: f.contribution ?? "",
      comment: f.peerComment ?? "",
    })),
  );
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error.issues) };

  const milestone = await db.milestone.findUnique({
    where: { id: id.data },
    select: { id: true, saeId: true, dueAt: true, peerReviewEnabled: true, sae: { select: saeAccess } },
  });
  if (!milestone) return { ok: false, error: "Jalon introuvable" };
  if (!canViewSae(user, milestone.sae)) return { ok: false, error: "Accès refusé à cette SAÉ" };
  if (!milestone.peerReviewEnabled) {
    return { ok: false, error: "L'évaluation entre pairs n'est pas activée pour ce jalon" };
  }
  if (!isPeerReviewOpen(milestone.dueAt)) {
    const closesAt = peerReviewClosesAt(milestone.dueAt);
    return {
      ok: false,
      error: `La période d'évaluation est close${closesAt ? ` depuis le ${formatDateTime(closesAt)}` : ""}`,
    };
  }

  const group = await db.group.findFirst({
    where: { saeId: milestone.saeId, members: { some: { userId: user.id } } },
    select: { id: true, members: { select: { userId: true } } },
  });
  if (!group) return { ok: false, error: "Vous n'êtes membre d'aucun groupe de cette SAÉ" };

  const entries = parsed.data;
  if (entries.some((e) => !canReviewPeer(user, group, e.revieweeId))) {
    return { ok: false, error: "Vous ne pouvez évaluer que les autres membres de votre groupe — rechargez la page" };
  }
  if (entries.some((e) => e.contribution === null && e.comment !== null)) {
    return { ok: false, error: "Choisissez un niveau de contribution pour chaque coéquipier commenté" };
  }
  const rated = entries.filter((e): e is typeof e & { contribution: number } => e.contribution !== null);
  if (rated.length === 0) return { ok: false, error: "Évaluez au moins un coéquipier" };

  try {
    await db.$transaction(async (tx) => {
      for (const e of rated) {
        await tx.peerReview.upsert({
          where: {
            milestoneId_reviewerId_revieweeId: {
              milestoneId: milestone.id,
              reviewerId: user.id,
              revieweeId: e.revieweeId,
            },
          },
          create: {
            milestoneId: milestone.id,
            groupId: group.id,
            reviewerId: user.id,
            revieweeId: e.revieweeId,
            contribution: e.contribution,
            comment: e.comment,
          },
          update: { groupId: group.id, contribution: e.contribution, comment: e.comment },
        });
      }
    });
  } catch (error) {
    console.error("savePeerReviews", error);
    return { ok: false, error: "Enregistrement impossible, réessayez dans un instant" };
  }

  revalidateMilestone(milestone.saeId, milestone.id);
  const others = group.members.length - 1;
  return {
    ok: true,
    message:
      rated.length < others
        ? `Évaluations enregistrées (${rated.length}/${others}) — pensez à évaluer tous vos coéquipiers`
        : "Évaluations enregistrées",
  };
}
