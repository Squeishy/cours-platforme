import "server-only";
import { db } from "@/lib/db";
import { CLEANUP_BATCH, READ_RETENTION_DAYS } from "./notifications";

/** Supprime (par lot borné) les notifications lues de plus de 90 jours d'un utilisateur. Ne lève jamais. */
export async function cleanupReadNotifications(userId: string) {
  try {
    await db.notification.deleteMany({
      where: {
        userId,
        readAt: { not: null },
        createdAt: { lt: new Date(Date.now() - READ_RETENTION_DAYS * 86_400_000) },
      },
      limit: CLEANUP_BATCH,
    });
  } catch (e) {
    console.error("Nettoyage des notifications impossible", e);
  }
}
