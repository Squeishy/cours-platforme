"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { canCommentAssessment, canManageSae, canReopenAssessment } from "@/lib/permissions";
import { firstIssue, type ActionResult } from "@/app/assessments/_lib/shared";

const idSchema = z.string().min(1).max(64);

const commentSchema = z.object({
  body: z
    .string({ error: "Commentaire vide" })
    .trim()
    .min(1, "Le commentaire est vide")
    .max(5000, "Commentaire trop long (5000 caractères maximum)"),
});

/** Auto-évaluation + ce qu'il faut pour les règles d'accès */
function loadAssessment(assessmentId: string) {
  return db.selfAssessment.findUnique({
    where: { id: assessmentId },
    select: {
      id: true,
      userId: true,
      status: true,
      groupId: true,
      milestoneId: true,
      group: { select: { members: { select: { userId: true } } } },
      milestone: {
        select: {
          saeId: true,
          sae: { select: { ownerId: true, published: true, teachers: { select: { id: true } } } },
        },
      },
    },
  });
}

function revalidateAssessment(a: { id: string; groupId: string | null; milestoneId: string; milestone: { saeId: string } }) {
  revalidatePath(`/assessments/${a.id}`);
  revalidatePath(`/saes/${a.milestone.saeId}/milestones/${a.milestoneId}`);
  if (a.groupId) revalidatePath(`/saes/${a.milestone.saeId}/groups/${a.groupId}`);
  revalidatePath("/");
}

export async function addComment(
  assessmentId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const id = idSchema.safeParse(assessmentId);
  if (!id.success) return { ok: false, error: "Auto-évaluation invalide" };

  const parsed = commentSchema.safeParse({ body: formData.get("body") });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error.issues) };

  const assessment = await loadAssessment(id.data);
  if (!assessment) return { ok: false, error: "Auto-évaluation introuvable" };
  if (!canCommentAssessment(user, assessment, assessment.milestone.sae)) {
    return { ok: false, error: "Vous ne pouvez pas commenter cette auto-évaluation" };
  }

  await db.comment.create({
    data: { assessmentId: assessment.id, authorId: user.id, body: parsed.data.body },
  });
  revalidateAssessment(assessment);
  return { ok: true, message: "Commentaire publié" };
}

export async function deleteComment(commentId: string): Promise<ActionResult> {
  const user = await requireUser();
  const id = idSchema.safeParse(commentId);
  if (!id.success) return { ok: false, error: "Commentaire invalide" };

  const comment = await db.comment.findUnique({
    where: { id: id.data },
    select: { id: true, authorId: true, assessmentId: true },
  });
  if (!comment) return { ok: false, error: "Commentaire introuvable (déjà supprimé ?)" };

  const assessment = await loadAssessment(comment.assessmentId);
  if (!assessment) return { ok: false, error: "Auto-évaluation introuvable" };

  const allowed = comment.authorId === user.id || canManageSae(user, assessment.milestone.sae);
  if (!allowed) return { ok: false, error: "Vous ne pouvez supprimer que vos propres commentaires" };

  await db.comment.delete({ where: { id: comment.id } });
  revalidateAssessment(assessment);
  return { ok: true };
}

export async function reopenAssessment(assessmentId: string): Promise<ActionResult> {
  const user = await requireUser();
  const id = idSchema.safeParse(assessmentId);
  if (!id.success) return { ok: false, error: "Auto-évaluation invalide" };

  const assessment = await loadAssessment(id.data);
  if (!assessment) return { ok: false, error: "Auto-évaluation introuvable" };
  if (!canReopenAssessment(user, assessment.milestone.sae)) {
    return { ok: false, error: "Seule l'équipe pédagogique peut rouvrir une auto-évaluation" };
  }
  if (assessment.status !== "SUBMITTED") return { ok: false, error: "Cette auto-évaluation est déjà un brouillon" };

  await db.selfAssessment.update({
    where: { id: assessment.id },
    data: { status: "DRAFT", submittedAt: null },
  });
  revalidateAssessment(assessment);
  revalidatePath(`/saes/${assessment.milestone.saeId}/milestones/${assessment.milestoneId}/assess`);
  return { ok: true };
}
