"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { safeInternalPath } from "./_lib/notifications";

type Result = { ok: true } | { ok: false; error: string };

const idSchema = z.string().min(1).max(64);

/**
 * Ouvre une notification : la marque comme lue puis redirige vers son lien interne
 * (chemin « /… » uniquement, jamais « // »), ou revient à /notifications.
 */
export async function openNotification(notificationId: string): Promise<void> {
  const user = await requireUser();
  const id = idSchema.safeParse(notificationId);
  if (!id.success) redirect("/notifications");

  // Permission : uniquement ses propres notifications
  const notification = await db.notification.findFirst({
    where: { id: id.data, userId: user.id },
    select: { id: true, link: true, readAt: true },
  });
  if (!notification) redirect("/notifications");

  if (!notification.readAt) {
    await db.notification.update({ where: { id: notification.id }, data: { readAt: new Date() } });
    // Rafraîchit aussi le compteur de la cloche (mise en page)
    revalidatePath("/", "layout");
  }
  redirect(safeInternalPath(notification.link) ?? "/notifications");
}

export async function markAllRead(): Promise<Result> {
  const user = await requireUser();
  await db.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/", "layout");
  return { ok: true };
}
