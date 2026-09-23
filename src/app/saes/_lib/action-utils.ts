import "server-only";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { parisLocalToDate } from "./dates";
import type { FormState } from "./form-state";

// Briques communes des Server Actions SAÉ (validation zod, erreurs, chargement des droits).

export const FORBIDDEN = { ok: false, error: "Vous n'avez pas les droits pour cette action." } as const;
export const NOT_FOUND_SAE = { ok: false, error: "SAÉ introuvable." } as const;
export const GENERIC_ERROR = { ok: false, error: "Une erreur est survenue. Réessayez." } as const;

/** Lit les champs demandés ; un champ absent devient undefined (pas null) pour zod */
export function read(formData: FormData, keys: readonly string[]): Record<string, FormDataEntryValue | undefined> {
  return Object.fromEntries(keys.map((k) => [k, formData.get(k) ?? undefined]));
}

export function firstIssue(error: z.ZodError): FormState {
  return { ok: false, error: error.issues[0]?.message ?? "Données invalides." };
}

export const id = z.string().trim().min(1, "Identifiant manquant").max(64);

/** Identifiant optionnel : vide → null */
export const optionalId = z
  .string()
  .trim()
  .max(64)
  .optional()
  .transform((v) => (v ? v : null));

export const requiredText = (label: string, max: number) =>
  z
    .string({ error: `${label} requis` })
    .trim()
    .min(1, `${label} requis`)
    .max(max, `${label} : ${max} caractères maximum`);

/** Texte optionnel : vide → null */
export const optionalText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .max(max, `${label} : ${max} caractères maximum`)
    .optional()
    .transform((v) => (v ? v : null));

/** `<input type="date|datetime-local">` en heure de Paris, vide → undefined */
export const optionalDate = z.preprocess((v) => {
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  if (s === "") return undefined;
  return parisLocalToDate(s) ?? s;
}, z.coerce.date({ error: "Date invalide" }).optional());

export const checkbox = z.preprocess((v) => v === "on" || v === "true", z.boolean());

/** Entier borné saisi dans un `<input type="number">` */
export const intInRange = (label: string, min: number, max: number) =>
  z.coerce
    .number({ error: `${label} invalide` })
    .int(`${label} : nombre entier attendu`)
    .min(min, `${label} : minimum ${min}`)
    .max(max, `${label} : maximum ${max}`);

export const email = z
  .string({ error: "Adresse e-mail requise" })
  .trim()
  .toLowerCase()
  .max(254, "Adresse e-mail trop longue")
  .pipe(z.email("Adresse e-mail invalide"));

export const saeAccessSelect = {
  id: true,
  ownerId: true,
  published: true,
  courseId: true,
  cohortId: true,
  code: true,
  title: true,
  teachers: { select: { id: true } },
} satisfies Prisma.SaeSelect;

export function loadSae(saeId: string) {
  return db.sae.findUnique({ where: { id: saeId }, select: saeAccessSelect });
}

export function isUniqueViolation(e: unknown) {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

export function revalidateSae(saeId: string) {
  // Page SAÉ + toutes ses sous-routes (gestion, groupes, jalons, soutenances)
  revalidatePath(`/saes/${saeId}`, "layout");
  revalidatePath("/saes");
  revalidatePath("/");
}

/** Libellé court d'une SAÉ pour les notifications : « SAÉ 2.03 » ou le titre */
export function saeShortName(sae: { code: string | null; title: string }) {
  return sae.code ?? sae.title;
}

/** Membres des groupes de la SAÉ (+ de sa promo si liée), bornés */
export async function saeAudienceIds(sae: { id: string; cohortId: string | null }): Promise<string[]> {
  const [members, cohort] = await Promise.all([
    db.groupMember.findMany({ where: { group: { saeId: sae.id } }, select: { userId: true }, take: 3000 }),
    sae.cohortId
      ? db.cohortMember.findMany({ where: { cohortId: sae.cohortId }, select: { userId: true }, take: 3000 })
      : Promise.resolve([]),
  ]);
  return [...new Set([...members, ...cohort].map((m) => m.userId))];
}
