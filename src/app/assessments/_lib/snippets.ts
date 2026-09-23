import "server-only";
import { db } from "@/lib/db";
import { isStaff, type Actor } from "@/lib/permissions";
import type { SnippetView } from "./shared";

/** Nombre maximal de commentaires types par enseignant (liste bornée) */
export const MAX_SNIPPETS = 500;

/** Banque de commentaires personnelle (vide pour un étudiant) */
export async function listMySnippets(user: Actor): Promise<SnippetView[]> {
  if (!isStaff(user)) return [];
  return db.commentSnippet.findMany({
    where: { authorId: user.id },
    orderBy: [{ tag: "asc" }, { createdAt: "desc" }],
    select: { id: true, tag: true, body: true },
    take: MAX_SNIPPETS,
  });
}
