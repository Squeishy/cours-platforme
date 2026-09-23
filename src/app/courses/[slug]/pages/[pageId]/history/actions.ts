"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { canEditCourse } from "@/lib/permissions";
import { snapshotPageBeforeWrite } from "@/lib/revisions";
import type { ActionState } from "../../../../_lib/action-state";

const idSchema = z.string().min(1).max(64);

/**
 * Restaure une version : l'état actuel est d'abord conservé dans l'historique
 * (la restauration est donc elle-même annulable), puis titre + contenu sont remplacés.
 */
export async function restorePageRevision(revisionId: string): Promise<ActionState> {
  const user = await requireUser();
  if (!idSchema.safeParse(revisionId).success) return { ok: false, error: "Version invalide." };

  const revision = await db.pageRevision.findUnique({
    where: { id: revisionId },
    select: {
      id: true,
      title: true,
      content: true,
      markdown: true,
      page: {
        select: {
          id: true,
          course: { select: { slug: true, ownerId: true, published: true, editors: { select: { id: true } } } },
        },
      },
    },
  });
  if (!revision) return { ok: false, error: "Version introuvable." };
  const { page } = revision;
  if (!canEditCourse(user, page.course)) return { ok: false, error: "Vous ne pouvez pas modifier ce cours." };

  await snapshotPageBeforeWrite(page.id, user.id);

  // snapshotPageBeforeWrite regroupe les écritures rapprochées d'un même auteur :
  // on force ici la sauvegarde de l'état courant s'il n'est pas déjà la dernière version.
  const [current, last] = await Promise.all([
    db.page.findUnique({
      where: { id: page.id },
      select: { title: true, content: true, markdown: true, updatedById: true, updatedAt: true },
    }),
    db.pageRevision.findFirst({ where: { pageId: page.id }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
  ]);
  if (!current) return { ok: false, error: "Page introuvable." };
  const hasContent = current.content !== null || !!current.markdown;
  if (hasContent && (!last || last.createdAt.getTime() !== current.updatedAt.getTime())) {
    await db.pageRevision.create({
      data: {
        pageId: page.id,
        title: current.title,
        content: current.content === null ? undefined : (current.content as Prisma.InputJsonValue),
        markdown: current.markdown,
        authorId: current.updatedById,
        createdAt: current.updatedAt,
      },
    });
  }

  await db.page.update({
    where: { id: page.id },
    data: {
      title: revision.title,
      content: revision.content === null ? Prisma.DbNull : (revision.content as Prisma.InputJsonValue),
      markdown: revision.markdown,
      updatedById: user.id,
    },
  });

  revalidatePath(`/courses/${page.course.slug}`, "layout");
  redirect(`/courses/${page.course.slug}/pages/${page.id}`);
}
