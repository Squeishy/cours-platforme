// Logique pure des promos (testée dans cohorts.test.ts).
// Imports relatifs : ce module est testé par vitest sans alias « @/ ».
import { z } from "zod";
import { MMI_PARCOURS } from "../../../../data/referentiel-mmi";

export const PARCOURS_CODES = MMI_PARCOURS.map((p) => p.code);

export const PARCOURS_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Tronc commun (aucun parcours)" },
  ...MMI_PARCOURS.map((p) => ({ value: p.code, label: `${p.code} — ${p.name}` })),
];

export function parcoursLabel(code: string | null) {
  if (!code) return "Tronc commun";
  return MMI_PARCOURS.find((p) => p.code === code)?.name ?? code;
}

/** « 2026-2027 » : deux années consécutives */
export function isValidAcademicYear(value: string) {
  const m = /^(\d{4})-(\d{4})$/.exec(value);
  if (!m) return false;
  const start = Number(m[1]);
  return start >= 2000 && start <= 2100 && Number(m[2]) === start + 1;
}

/** Année universitaire en cours à Paris (bascule au 1er août) */
export function currentAcademicYear(now = new Date()) {
  const [y, m] = now.toLocaleDateString("en-CA", { timeZone: "Europe/Paris" }).split("-").map(Number);
  const start = m >= 8 ? y : y - 1;
  return `${start}-${start + 1}`;
}

export const cohortSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Le nom doit faire au moins 2 caractères.")
    .max(120, "Le nom doit faire au plus 120 caractères."),
  year: z.coerce
    .number({ error: "Année de BUT invalide." })
    .int("Année de BUT invalide.")
    .min(1, "L'année de BUT va de 1 à 3.")
    .max(3, "L'année de BUT va de 1 à 3."),
  parcours: z
    .enum(["", ...PARCOURS_CODES] as [string, ...string[]], { error: "Parcours invalide." })
    .transform((v) => (v === "" ? null : v)),
  academicYear: z.string().trim().refine(isValidAcademicYear, "Année universitaire attendue au format 2026-2027."),
});

export type CohortInput = z.infer<typeof cohortSchema>;

const emailSchema = z.email();

/** Nombre maximal d'adresses traitées par collage */
export const MAX_EMAILS_PER_PASTE = 500;

/**
 * Découpe une liste collée (retours à la ligne, virgules, points-virgules, espaces ; « Nom <mail> » toléré),
 * normalise en minuscules, dédoublonne et sépare les adresses invalides.
 */
export function parseEmailList(text: string, max = MAX_EMAILS_PER_PASTE) {
  const emails: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  for (const raw of text.split(/[\s,;]+/)) {
    const token = raw.replace(/^[<("']+|[>)"']+$/g, "").trim().toLowerCase();
    // Sans « @ » : un nom (« Jean Dupont <jean@…> »), ignoré
    if (!token.includes("@") || seen.has(token)) continue;
    seen.add(token);
    if (emailSchema.safeParse(token).success) emails.push(token);
    else invalid.push(token);
  }
  return { emails: emails.slice(0, max), invalid, truncated: emails.length > max };
}
