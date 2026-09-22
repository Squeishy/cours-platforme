"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { canViewCourse, canViewSae } from "@/lib/permissions";

const schema = z.object({
  kind: z.enum(["COURSE", "PAGE", "SAE"]),
  targetId: z.string().min(1).max(64),
});

/** Ajoute ou retire un favori ; renvoie le nouvel état. Vérifie que la cible est visible. */
export async function toggleFavorite(kind: string, targetId: string): Promise<{ ok: true; favorite: boolean } | { ok: false; error: string }> {
  const user = await requireUser();
  const parsed = schema.safeParse({ kind, targetId });
  if (!parsed.success) return { ok: false, error: "Données invalides." };
  const input = parsed.data;

  const existing = await db.favorite.findUnique({
    where: { userId_kind_targetId: { userId: user.id, kind: input.kind, targetId: input.targetId } },
  });
  if (existing) {
    await db.favorite.delete({ where: { id: existing.id } });
    revalidatePath("/", "layout");
    return { ok: true, favorite: false };
  }

  let visible = false;
  if (input.kind === "COURSE") {
    const c = await db.course.findUnique({ where: { id: input.targetId }, include: { editors: { select: { id: true } } } });
    visible = !!c && canViewCourse(user, c);
  } else if (input.kind === "PAGE") {
    const p = await db.page.findUnique({
      where: { id: input.targetId },
      include: { course: { include: { editors: { select: { id: true } } } } },
    });
    visible = !!p && canViewCourse(user, p.course);
  } else {
    const s = await db.sae.findUnique({ where: { id: input.targetId }, include: { teachers: { select: { id: true } } } });
    visible = !!s && canViewSae(user, s);
  }
  if (!visible) return { ok: false, error: "Ressource introuvable." };

  await db.favorite.create({ data: { userId: user.id, kind: input.kind, targetId: input.targetId } });
  revalidatePath("/", "layout");
  return { ok: true, favorite: true };
}
