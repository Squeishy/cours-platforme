import "server-only";
import { db } from "@/lib/db";
import { canViewCourse } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/session";

// generateMetadata s'exécute avant les contrôles de la page : on ne révèle un titre (onglet du
// navigateur) qu'à quelqu'un qui peut voir le cours — pas de fuite de titres de brouillons.

const courseAccess = { title: true, ownerId: true, published: true, editors: { select: { id: true } } } as const;

export async function visibleCourseForMetadata(where: { slug: string }) {
  const user = await getCurrentUser();
  if (!user) return null;
  const course = await db.course.findUnique({ where, select: courseAccess });
  return course && canViewCourse(user, course) ? course : null;
}

export async function visiblePageForMetadata(pageId: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  const page = await db.page.findUnique({ where: { id: pageId }, select: { title: true, course: { select: courseAccess } } });
  return page && canViewCourse(user, page.course) ? page : null;
}
