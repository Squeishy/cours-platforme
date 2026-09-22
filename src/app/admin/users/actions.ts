"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { isAdmin } from "@/lib/permissions";
import type { ActionState } from "@/app/courses/_lib/action-state";

const changeRoleSchema = z.object({
  userId: z.string().min(1).max(64),
  role: z.enum(["ADMIN", "TEACHER", "STUDENT"], { error: "Rôle invalide." }),
});

/** Changement de rôle (admin uniquement) — un admin ne peut pas se retirer lui-même le rôle ADMIN */
export async function changeRole(userId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (!isAdmin(user)) return { ok: false, error: "Action réservée aux administrateurs." };

  const parsed = changeRoleSchema.safeParse({ userId, role: formData.get("role") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Données invalides." };

  if (parsed.data.userId === user.id && parsed.data.role !== "ADMIN") {
    return { ok: false, error: "Vous ne pouvez pas retirer votre propre rôle d'administrateur." };
  }

  const target = await db.user.findUnique({ where: { id: parsed.data.userId }, select: { id: true } });
  if (!target) return { ok: false, error: "Utilisateur introuvable." };

  await db.user.update({ where: { id: target.id }, data: { role: parsed.data.role } });
  revalidatePath("/admin/users");
  return { ok: true };
}
