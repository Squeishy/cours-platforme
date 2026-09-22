import { z } from "zod";

/** Validation minimale du contenu envoyé par l'éditeur avant écriture en base */
export const editorContentSchema = z.object({
  content: z.array(z.unknown()).max(5000),
  markdown: z.string().max(2_000_000),
});

export function slugify(input: string) {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
