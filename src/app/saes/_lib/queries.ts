import "server-only";
import { db } from "@/lib/db";
import { isAdmin, isStaff, type Actor } from "@/lib/permissions";
import type { CourseOption } from "../_components/sae-fields";

/** Cours que l'utilisateur peut éditer (mêmes règles que canEditCourse), pour lier une SAÉ */
export function findEditableCourses(user: Actor): Promise<CourseOption[]> {
  const where = isAdmin(user)
    ? {}
    : isStaff(user)
      ? { OR: [{ ownerId: user.id }, { editors: { some: { id: user.id } } }] }
      : { ownerId: user.id };
  return db.course.findMany({ where, orderBy: { title: "asc" }, select: { id: true, title: true } });
}
