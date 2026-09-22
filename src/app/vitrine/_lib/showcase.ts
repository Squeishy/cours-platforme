// Vitrine des projets : catégories (inspirées du Festival MMI), validation des demandes.
import { z } from "zod";
import { depositUrlSchema } from "@/lib/deposit";

export const SHOWCASE_CATEGORIES = ["GRAPHISME", "AUDIOVISUEL", "ANIMATION", "UX", "WEB", "AUTRE"] as const;
export type ShowcaseCategory = (typeof SHOWCASE_CATEGORIES)[number];

export const SHOWCASE_CATEGORY_LABELS: Record<ShowcaseCategory, string> = {
  GRAPHISME: "Graphisme & design",
  AUDIOVISUEL: "Audiovisuel",
  ANIMATION: "Animation & motion",
  UX: "UX / UI",
  WEB: "Site & application web",
  AUTRE: "Autre",
};

export function isShowcaseCategory(value: unknown): value is ShowcaseCategory {
  return typeof value === "string" && (SHOWCASE_CATEGORIES as readonly string[]).includes(value);
}

export function categoryLabel(value: string | null | undefined) {
  return isShowcaseCategory(value) ? SHOWCASE_CATEGORY_LABELS[value] : SHOWCASE_CATEGORY_LABELS.AUTRE;
}

export const SHOWCASE_SUMMARY_MAX = 600;
export const SHOWCASE_TITLE_MAX = 120;

/** Image d'illustration : https uniquement (pas de contenu mixte, pas de data:) */
const imageUrlSchema = z
  .string()
  .trim()
  .max(2048, "URL d'image trop longue")
  .transform((v) => (v === "" ? null : v))
  .refine((v) => v === null || (URL.canParse(v) && /^https:\/\//i.test(v)), "L'image doit être une URL https://");

export const showcaseRequestSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Titre trop court (3 caractères minimum)")
    .max(SHOWCASE_TITLE_MAX, `Titre trop long (${SHOWCASE_TITLE_MAX} caractères maximum)`),
  summary: z
    .string()
    .trim()
    .min(20, "Résumé trop court (20 caractères minimum)")
    .max(SHOWCASE_SUMMARY_MAX, `Résumé trop long (${SHOWCASE_SUMMARY_MAX} caractères maximum)`),
  url: depositUrlSchema,
  imageUrl: imageUrlSchema,
  category: z.enum(SHOWCASE_CATEGORIES, { message: "Choisissez une catégorie" }),
  consent: z.literal("on", { message: "L'accord des membres est nécessaire pour publier leurs noms" }),
});

export const moderationSchema = z.object({
  decision: z.enum(["publish", "refuse", "unpublish"]),
  reason: z
    .string()
    .trim()
    .max(500, "Motif trop long (500 caractères maximum)")
    .optional()
    .transform((v) => (v ? v : null)),
});

export type ModerationDecision = z.input<typeof moderationSchema>["decision"];

/** Contenu d'une demande tel que l'enseignant l'a vu : la décision n'est appliquée que s'il n'a pas changé */
export type ShowcaseSnapshot = {
  showcaseTitle: string | null;
  showcaseSummary: string | null;
  showcaseUrl: string | null;
  showcaseImageUrl: string | null;
  showcaseCategory: string | null;
};

export function showcaseSnapshot(g: ShowcaseSnapshot): ShowcaseSnapshot {
  return {
    showcaseTitle: g.showcaseTitle,
    showcaseSummary: g.showcaseSummary,
    showcaseUrl: g.showcaseUrl,
    showcaseImageUrl: g.showcaseImageUrl,
    showcaseCategory: g.showcaseCategory,
  };
}

export function sameShowcase(a: ShowcaseSnapshot, b: ShowcaseSnapshot) {
  return (Object.keys(showcaseSnapshot(a)) as (keyof ShowcaseSnapshot)[]).every((k) => (a[k] ?? null) === (b[k] ?? null));
}
