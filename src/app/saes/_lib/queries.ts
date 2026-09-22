import "server-only";
import { db } from "@/lib/db";
import { isAdmin, isStaff, type Actor } from "@/lib/permissions";
import type { CohortOption, CourseOption } from "../_components/sae-fields";

/** Cours que l'utilisateur peut éditer (mêmes règles que canEditCourse), pour lier une SAÉ */
export function findEditableCourses(user: Actor): Promise<CourseOption[]> {
  const where = isAdmin(user)
    ? {}
    : isStaff(user)
      ? { OR: [{ ownerId: user.id }, { editors: { some: { id: user.id } } }] }
      : { ownerId: user.id };
  return db.course.findMany({ where, orderBy: { title: "asc" }, select: { id: true, title: true }, take: 500 });
}

/** Promos proposées pour lier une SAÉ (les plus récentes d'abord) */
export function findCohortOptions(): Promise<CohortOption[]> {
  return db.cohort.findMany({
    orderBy: [{ academicYear: "desc" }, { year: "asc" }, { name: "asc" }],
    select: { id: true, name: true, academicYear: true },
    take: 300,
  });
}

export type AcOption = { id: string; code: string; label: string; level: number };
export type AcGroup = { code: string; name: string; learnings: AcOption[] };

/** Apprentissages critiques du référentiel en base, regroupés par compétence */
export function loadAcGroups(): Promise<AcGroup[]> {
  return db.competence.findMany({
    orderBy: [{ position: "asc" }, { code: "asc" }],
    select: {
      code: true,
      name: true,
      learnings: { orderBy: { code: "asc" }, select: { id: true, code: true, label: true, level: true }, take: 300 },
    },
    take: 20,
  });
}
