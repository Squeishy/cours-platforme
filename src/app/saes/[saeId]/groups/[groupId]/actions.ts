"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { requireUser } from "@/lib/session";
import { canContributeToGroup, canManageSae, canViewSae } from "@/lib/permissions";
import { editorContentSchema } from "@/lib/content";
import { depositUrlSchema, detectProvider } from "@/lib/deposit";
import { firstIssue, type ActionResult } from "@/app/assessments/_lib/shared";

const idSchema = z.string().min(1).max(64);

/** Groupe + ce qu'il faut pour les règles d'accès */
function loadGroup(groupId: string) {
  return db.group.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      saeId: true,
      members: { select: { userId: true } },
      sae: { select: { ownerId: true, published: true, teachers: { select: { id: true } } } },
    },
  });
}

function revalidateGroup(saeId: string, groupId: string, milestoneId?: string | null) {
  revalidatePath(`/saes/${saeId}/groups/${groupId}`);
  revalidatePath(`/saes/${saeId}`);
  if (milestoneId) revalidatePath(`/saes/${saeId}/milestones/${milestoneId}`);
}

/** Enregistrement automatique de l'espace de travail partagé (éditeur) */
export async function saveGroupContent(groupId: string, content: unknown, markdown: string): Promise<ActionResult> {
  const user = await requireUser();
  const id = idSchema.safeParse(groupId);
  const parsed = editorContentSchema.safeParse({ content, markdown });
  if (!id.success || !parsed.success) return { ok: false, error: "Contenu invalide" };

  const group = await loadGroup(id.data);
  if (!group) return { ok: false, error: "Groupe introuvable" };
  if (!canViewSae(user, group.sae) || !canContributeToGroup(user, group, group.sae)) {
    return { ok: false, error: "Vous ne pouvez pas modifier cet espace de travail" };
  }

  await db.group.update({
    where: { id: group.id },
    data: { content: parsed.data.content as Prisma.InputJsonValue, markdown: parsed.data.markdown },
  });
  revalidatePath(`/saes/${group.saeId}/groups/${group.id}`);
  return { ok: true };
}

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((v) => (v === "" ? null : v));

const depositSchema = z.object({
  milestoneId: z
    .string()
    .max(64)
    .transform((v) => (v === "" ? null : v)),
  url: depositUrlSchema,
  label: optionalText(191, "Libellé trop long (191 caractères maximum)"),
});

export async function addDepositLink(
  groupId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const id = idSchema.safeParse(groupId);
  if (!id.success) return { ok: false, error: "Groupe invalide" };

  const parsed = depositSchema.safeParse({
    milestoneId: formData.get("milestoneId") ?? "",
    url: formData.get("url") ?? "",
    label: formData.get("label") ?? "",
  });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error.issues) };

  const group = await loadGroup(id.data);
  if (!group) return { ok: false, error: "Groupe introuvable" };
  if (!canViewSae(user, group.sae) || !canContributeToGroup(user, group, group.sae)) {
    return { ok: false, error: "Vous ne pouvez pas ajouter d'URL de dépôt à ce groupe" };
  }

  const { milestoneId, url, label } = parsed.data;
  if (milestoneId) {
    const milestone = await db.milestone.findFirst({
      where: { id: milestoneId, saeId: group.saeId },
      select: { id: true },
    });
    if (!milestone) return { ok: false, error: "Jalon introuvable pour cette SAÉ" };
  }

  await db.depositLink.create({
    data: {
      groupId: group.id,
      milestoneId,
      url,
      label,
      provider: detectProvider(url),
      addedById: user.id,
    },
  });
  revalidateGroup(group.saeId, group.id, milestoneId);
  return { ok: true, message: "URL de dépôt ajoutée" };
}

export async function deleteDepositLink(linkId: string): Promise<ActionResult> {
  const user = await requireUser();
  const id = idSchema.safeParse(linkId);
  if (!id.success) return { ok: false, error: "Lien invalide" };

  const link = await db.depositLink.findUnique({
    where: { id: id.data },
    select: { id: true, addedById: true, milestoneId: true, groupId: true },
  });
  if (!link) return { ok: false, error: "Lien introuvable (déjà supprimé ?)" };

  const group = await loadGroup(link.groupId);
  if (!group) return { ok: false, error: "Groupe introuvable" };

  const isManager = canManageSae(user, group.sae);
  const isOwnLink = link.addedById === user.id && canContributeToGroup(user, group, group.sae);
  if (!isManager && !isOwnLink) {
    return { ok: false, error: "Vous ne pouvez supprimer que les liens que vous avez ajoutés" };
  }

  await db.depositLink.delete({ where: { id: link.id } });
  revalidateGroup(group.saeId, group.id, link.milestoneId);
  return { ok: true };
}
