"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { canAnnounce, isAdmin } from "@/lib/permissions";
import { notify } from "@/lib/notify";
import { firstIssue, type FormResult } from "@/app/admin/users/_lib/form-result";

const NOTIFY_CHUNK = 500;

const createSchema = z
  .object({
    scope: z.enum(["GLOBAL", "COHORT"], { error: "Choisissez la portée de l'annonce." }),
    cohortId: z.string().max(64),
    title: z
      .string()
      .trim()
      .min(3, "Le titre doit faire au moins 3 caractères.")
      .max(190, "Le titre doit faire au plus 190 caractères."),
    body: z.string().trim().min(1, "Le message est vide.").max(5000, "Le message doit faire au plus 5 000 caractères."),
    pinned: z.boolean(),
  })
  .refine((v) => v.scope !== "COHORT" || v.cohortId.length > 0, { message: "Choisissez une promo.", path: ["cohortId"] });

function preview(body: string) {
  const flat = body.replace(/\s+/g, " ").trim();
  return flat.length <= 280 ? flat : `${flat.slice(0, 279).trimEnd()}…`;
}

/** Tous les utilisateurs, par lots de 500 (curseur sur l'id) */
async function notifyEveryone(payload: Parameters<typeof notify>[1], authorId: string) {
  let cursor: string | undefined;
  for (;;) {
    const batch = await db.user.findMany({
      select: { id: true },
      orderBy: { id: "asc" },
      take: NOTIFY_CHUNK,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    if (batch.length === 0) break;
    await notify(
      batch.map((u) => u.id),
      payload,
      authorId,
    );
    if (batch.length < NOTIFY_CHUNK) break;
    cursor = batch[batch.length - 1].id;
  }
}

/** Membres d'une promo, par lots de 500 */
async function notifyCohort(cohortId: string, payload: Parameters<typeof notify>[1], authorId: string) {
  let cursor: string | undefined;
  for (;;) {
    const batch = await db.cohortMember.findMany({
      where: { cohortId },
      select: { userId: true },
      orderBy: { userId: "asc" },
      take: NOTIFY_CHUNK,
      ...(cursor ? { skip: 1, cursor: { cohortId_userId: { cohortId, userId: cursor } } } : {}),
    });
    if (batch.length === 0) break;
    await notify(
      batch.map((m) => m.userId),
      payload,
      authorId,
    );
    if (batch.length < NOTIFY_CHUNK) break;
    cursor = batch[batch.length - 1].userId;
  }
}

export async function createAnnouncement(_prev: FormResult, formData: FormData): Promise<FormResult> {
  const user = await requireUser();
  const parsed = createSchema.safeParse({
    scope: formData.get("scope"),
    cohortId: String(formData.get("cohortId") ?? ""),
    title: formData.get("title") ?? "",
    body: formData.get("body") ?? "",
    pinned: formData.get("pinned") === "on",
  });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error.issues) };
  const input = parsed.data;

  let cohort: { id: string; name: string } | null = null;
  if (input.scope === "COHORT") {
    cohort = await db.cohort.findUnique({ where: { id: input.cohortId }, select: { id: true, name: true } });
    if (!cohort) return { ok: false, error: "Promo introuvable." };
  }

  if (!canAnnounce(user, { scope: input.scope })) {
    return {
      ok: false,
      error: input.scope === "GLOBAL" ? "Seuls les administrateurs publient une annonce globale." : "Action réservée à l'équipe pédagogique.",
    };
  }

  await db.announcement.create({
    data: {
      scope: input.scope,
      cohortId: cohort?.id ?? null,
      title: input.title,
      body: input.body,
      pinned: input.pinned,
      authorId: user.id,
    },
  });

  const payload = { type: "announcement" as const, title: input.title, body: preview(input.body), link: "/" };
  if (cohort) await notifyCohort(cohort.id, payload, user.id);
  else await notifyEveryone(payload, user.id);

  revalidatePath("/admin/announcements");
  revalidatePath("/");
  return {
    ok: true,
    message: cohort ? `Annonce publiée pour « ${cohort.name} ».` : "Annonce publiée pour tout le monde.",
  };
}

/** Suppression : l'auteur ou un administrateur */
export async function deleteAnnouncement(announcementId: string): Promise<FormResult> {
  const user = await requireUser();
  const id = z.string().min(1).max(64).safeParse(announcementId);
  if (!id.success) return { ok: false, error: "Annonce invalide." };

  const announcement = await db.announcement.findUnique({ where: { id: id.data }, select: { id: true, authorId: true } });
  if (!announcement) return { ok: false, error: "Cette annonce a déjà été supprimée." };
  if (announcement.authorId !== user.id && !isAdmin(user)) {
    return { ok: false, error: "Vous ne pouvez supprimer que vos propres annonces." };
  }

  await db.announcement.delete({ where: { id: announcement.id } });
  revalidatePath("/admin/announcements");
  revalidatePath("/");
  return { ok: true };
}
