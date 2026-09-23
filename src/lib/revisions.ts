import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

const SNAPSHOT_EVERY_MS = 10 * 60 * 1000;
const MAX_REVISIONS_PER_PAGE = 100;

/**
 * À appeler AVANT d'écrire un nouveau contenu de page : enregistre l'état actuel
 * comme révision si la dernière révision date de plus de 10 min ou vient d'un autre auteur.
 * (L'autosave écrit toutes les secondes : on ne garde pas chaque frappe.)
 */
export async function snapshotPageBeforeWrite(pageId: string, editorId: string) {
  const [page, last] = await Promise.all([
    db.page.findUnique({
      where: { id: pageId },
      select: { title: true, content: true, markdown: true, updatedById: true, updatedAt: true },
    }),
    db.pageRevision.findFirst({ where: { pageId }, orderBy: { createdAt: "desc" }, select: { createdAt: true, authorId: true } }),
  ]);
  if (!page || (page.content == null && !page.markdown)) return;

  const recent = last && Date.now() - last.createdAt.getTime() < SNAPSHOT_EVERY_MS;
  const sameAuthor = (page.updatedById ?? null) === editorId && (!last || last.authorId === page.updatedById);
  if (recent && sameAuthor) return;

  await db.pageRevision.create({
    data: {
      pageId,
      title: page.title,
      content: (page.content ?? undefined) as Prisma.InputJsonValue | undefined,
      markdown: page.markdown,
      authorId: page.updatedById,
      createdAt: page.updatedAt,
    },
  });

  // Rétention bornée
  const extra = await db.pageRevision.findMany({
    where: { pageId },
    orderBy: { createdAt: "desc" },
    skip: MAX_REVISIONS_PER_PAGE,
    select: { id: true },
  });
  if (extra.length) await db.pageRevision.deleteMany({ where: { id: { in: extra.map((r) => r.id) } } });
}
