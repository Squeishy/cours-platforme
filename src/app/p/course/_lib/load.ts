import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import { isTokenShape } from "@/lib/tokens";

/**
 * Cours partagé par lien public (/p/course/<jeton>) — null si le jeton est mal formé, révoqué ou inconnu.
 * Aucune adresse e-mail n'est chargée.
 */
export const loadSharedCourse = cache(async (token: string) => {
  if (!isTokenShape(token)) return null;
  return db.course.findUnique({
    where: { shareToken: token },
    select: {
      id: true,
      title: true,
      summary: true,
      owner: { select: { name: true } },
      pages: { select: { id: true, title: true, parentId: true, position: true } },
    },
  });
});
