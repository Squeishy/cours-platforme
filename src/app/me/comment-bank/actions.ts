"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { isStaff } from "@/lib/permissions";
import { firstIssue, MAX_BODY, type ActionResult } from "@/app/assessments/_lib/shared";
import { idSchema } from "@/app/assessments/_lib/validation";
import { MAX_SNIPPETS } from "@/app/assessments/_lib/snippets";

const snippetSchema = z.object({
  tag: z
    .string()
    .trim()
    .max(60, "Étiquette trop longue (60 caractères maximum)")
    .transform((v) => (v === "" ? null : v)),
  body: z
    .string({ error: "Le commentaire est vide" })
    .trim()
    .min(1, "Le commentaire est vide")
    .max(MAX_BODY, `Commentaire trop long (${MAX_BODY} caractères maximum)`),
});

function readSnippet(formData: FormData) {
  const tag = formData.get("tag");
  return snippetSchema.safeParse({ tag: typeof tag === "string" ? tag : "", body: formData.get("body") });
}

const STAFF_ONLY = "La banque de commentaires est réservée à l'équipe pédagogique";

export async function createSnippet(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!isStaff(user)) return { ok: false, error: STAFF_ONLY };

  const parsed = readSnippet(formData);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error.issues) };

  const count = await db.commentSnippet.count({ where: { authorId: user.id } });
  if (count >= MAX_SNIPPETS) {
    return { ok: false, error: `Limite atteinte (${MAX_SNIPPETS} commentaires types) : supprimez-en avant d'en ajouter` };
  }

  await db.commentSnippet.create({ data: { authorId: user.id, tag: parsed.data.tag, body: parsed.data.body } });
  revalidatePath("/me/comment-bank");
  return { ok: true, message: "Commentaire type ajouté" };
}

export async function updateSnippet(
  snippetId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!isStaff(user)) return { ok: false, error: STAFF_ONLY };
  const id = idSchema.safeParse(snippetId);
  if (!id.success) return { ok: false, error: "Commentaire type invalide" };

  const parsed = readSnippet(formData);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error.issues) };

  const snippet = await db.commentSnippet.findUnique({ where: { id: id.data }, select: { authorId: true } });
  if (!snippet) return { ok: false, error: "Commentaire type introuvable (supprimé ?)" };
  if (snippet.authorId !== user.id) return { ok: false, error: "Vous ne pouvez modifier que vos commentaires types" };

  await db.commentSnippet.update({ where: { id: id.data }, data: { tag: parsed.data.tag, body: parsed.data.body } });
  revalidatePath("/me/comment-bank");
  return { ok: true, message: "Commentaire type modifié" };
}

export async function deleteSnippet(snippetId: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!isStaff(user)) return { ok: false, error: STAFF_ONLY };
  const id = idSchema.safeParse(snippetId);
  if (!id.success) return { ok: false, error: "Commentaire type invalide" };

  const snippet = await db.commentSnippet.findUnique({ where: { id: id.data }, select: { authorId: true } });
  if (!snippet) return { ok: false, error: "Commentaire type introuvable (déjà supprimé ?)" };
  if (snippet.authorId !== user.id) return { ok: false, error: "Vous ne pouvez supprimer que vos commentaires types" };

  await db.commentSnippet.delete({ where: { id: id.data } });
  revalidatePath("/me/comment-bank");
  return { ok: true };
}
