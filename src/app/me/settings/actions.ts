"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { randomToken } from "@/lib/tokens";
import { firstIssue, type FormResult } from "@/app/admin/users/_lib/form-result";

const nameSchema = z
  .string()
  .trim()
  .min(2, "Le nom doit faire au moins 2 caractères.")
  .max(80, "Le nom doit faire au plus 80 caractères.")
  .regex(/^[^\u0000-\u001f\u007f<>]+$/, "Le nom contient des caractères non autorisés.");

/** Modifier son nom affiché (l'e-mail et le rôle ne se modifient pas ici) */
export async function updateName(_prev: FormResult, formData: FormData): Promise<FormResult> {
  const user = await requireUser();
  const parsed = nameSchema.safeParse(formData.get("name") ?? "");
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error.issues) };

  // Permission : uniquement son propre compte (id issu de la session, jamais du formulaire)
  const me = await db.user.findUnique({ where: { id: user.id }, select: { id: true, name: true } });
  if (!me) return { ok: false, error: "Compte introuvable." };
  if (me.name === parsed.data) return { ok: true, message: "Aucun changement." };

  await db.user.update({ where: { id: me.id }, data: { name: parsed.data } });
  revalidatePath("/", "layout");
  return { ok: true, message: "Nom enregistré." };
}

function isUniqueViolation(e: unknown) {
  return typeof e === "object" && e !== null && (e as { code?: unknown }).code === "P2002";
}

/** Crée (ou remplace) le jeton du flux calendrier : l'ancien lien cesse aussitôt de fonctionner */
export async function regenerateCalendarToken(): Promise<FormResult> {
  const user = await requireUser();
  const me = await db.user.findUnique({ where: { id: user.id }, select: { id: true, calendarToken: true } });
  if (!me) return { ok: false, error: "Compte introuvable." };

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await db.user.update({ where: { id: me.id }, data: { calendarToken: randomToken() } });
      revalidatePath("/me/settings");
      return {
        ok: true,
        message: me.calendarToken ? "Nouveau lien créé : l'ancien ne fonctionne plus." : "Lien d'agenda créé.",
      };
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
    }
  }
  return { ok: false, error: "Impossible de créer le lien, réessayez." };
}

/** Désactive le flux calendrier (le lien actuel renvoie 404) */
export async function disableCalendarToken(): Promise<FormResult> {
  const user = await requireUser();
  const me = await db.user.findUnique({ where: { id: user.id }, select: { id: true, calendarToken: true } });
  if (!me) return { ok: false, error: "Compte introuvable." };
  if (!me.calendarToken) return { ok: true, message: "Le lien était déjà désactivé." };

  await db.user.update({ where: { id: me.id }, data: { calendarToken: null } });
  revalidatePath("/me/settings");
  return { ok: true, message: "Lien d'agenda désactivé." };
}
