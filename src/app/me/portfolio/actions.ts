"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { canViewPortfolio } from "@/lib/permissions";
import { depositUrlSchema } from "@/lib/deposit";
import { isValidLevel } from "@/lib/assessment";
import { randomToken } from "@/lib/tokens";
import { firstIssue, idSchema, type ActionResult } from "./_lib/shared";

const MAX_EVIDENCES_PER_USER = 300;

function revalidatePortfolio(userId: string) {
  revalidatePath("/me/portfolio");
  revalidatePath("/me/competences");
  revalidatePath("/me");
  revalidatePath(`/students/${userId}`);
  revalidatePath("/p/portfolio/[token]", "page");
}

const evidenceSchema = z.object({
  id: z
    .string()
    .trim()
    .max(64)
    .transform((v) => (v === "" ? null : v)),
  learningId: z.string().trim().min(1, "Choisissez un apprentissage critique").max(64),
  title: z
    .string()
    .trim()
    .min(3, "Titre trop court (3 caractères minimum)")
    .max(191, "Titre trop long (191 caractères maximum)"),
  url: z
    .string()
    .trim()
    .max(2048)
    .transform((v) => (v === "" ? null : v))
    .pipe(z.union([z.null(), depositUrlSchema])),
  reflection: z
    .string()
    .trim()
    .max(5000, "Réflexion trop longue (5 000 caractères maximum)")
    .transform((v) => (v === "" ? null : v)),
  level: z.coerce
    .number({ message: "Choisissez un niveau" })
    .int()
    .refine((v) => isValidLevel(v), "Choisissez un niveau entre 1 et 4"),
});

/** Crée ou met à jour une trace du portfolio (uniquement les siennes) */
export async function saveEvidence(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = evidenceSchema.safeParse({
    id: formData.get("id") ?? "",
    learningId: formData.get("learningId") ?? "",
    title: formData.get("title") ?? "",
    url: formData.get("url") ?? "",
    reflection: formData.get("reflection") ?? "",
    level: formData.get("level") ?? "",
  });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error.issues) };
  const { id, learningId, title, url, reflection, level } = parsed.data;

  const learning = await db.criticalLearning.findUnique({ where: { id: learningId }, select: { id: true } });
  if (!learning) return { ok: false, error: "Apprentissage critique introuvable" };

  if (id) {
    const evidence = await db.portfolioEvidence.findUnique({ where: { id }, select: { id: true, userId: true } });
    if (!evidence) return { ok: false, error: "Trace introuvable (supprimée ?)" };
    if (evidence.userId !== user.id) return { ok: false, error: "Vous ne pouvez modifier que vos propres traces" };
    await db.portfolioEvidence.update({
      where: { id: evidence.id },
      data: { learningId, title, url, reflection, level },
    });
    revalidatePortfolio(user.id);
    return { ok: true, message: "Trace mise à jour." };
  }

  if (!canViewPortfolio(user, user.id)) return { ok: false, error: "Action non autorisée" };
  const count = await db.portfolioEvidence.count({ where: { userId: user.id } });
  if (count >= MAX_EVIDENCES_PER_USER) {
    return { ok: false, error: `Limite de ${MAX_EVIDENCES_PER_USER} traces atteinte : regroupez ou supprimez des traces.` };
  }
  await db.portfolioEvidence.create({ data: { userId: user.id, learningId, title, url, reflection, level } });
  revalidatePortfolio(user.id);
  return { ok: true, message: "Trace ajoutée au portfolio." };
}

export async function deleteEvidence(evidenceId: string): Promise<ActionResult> {
  const user = await requireUser();
  const id = idSchema.safeParse(evidenceId);
  if (!id.success) return { ok: false, error: "Trace invalide" };

  const evidence = await db.portfolioEvidence.findUnique({ where: { id: id.data }, select: { id: true, userId: true } });
  if (!evidence) return { ok: false, error: "Trace introuvable (déjà supprimée ?)" };
  if (evidence.userId !== user.id) return { ok: false, error: "Vous ne pouvez supprimer que vos propres traces" };

  await db.portfolioEvidence.delete({ where: { id: evidence.id } });
  revalidatePortfolio(user.id);
  return { ok: true, message: "Trace supprimée." };
}

/** Active (ou renouvelle) le lien public en lecture seule : l'ancien lien cesse aussitôt de fonctionner */
export async function enablePortfolioShare(): Promise<ActionResult> {
  const user = await requireUser();
  if (!canViewPortfolio(user, user.id)) return { ok: false, error: "Action non autorisée" };
  await db.user.update({ where: { id: user.id }, data: { portfolioToken: randomToken() } });
  revalidatePortfolio(user.id);
  return { ok: true, message: "Lien public créé." };
}

export async function disablePortfolioShare(): Promise<ActionResult> {
  const user = await requireUser();
  await db.user.update({ where: { id: user.id }, data: { portfolioToken: null } });
  revalidatePortfolio(user.id);
  return { ok: true, message: "Lien public désactivé : le portfolio est de nouveau privé." };
}
