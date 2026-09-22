// Utilitaires isomorphes du périmètre « portfolio, vitrine, groupes » (serveur + client).
import { z } from "zod";

/** Résultat standard des Server Actions */
export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

/** Premier message d'erreur lisible d'un résultat zod */
export function firstIssue(issues: { message: string }[], fallback = "Données invalides") {
  return issues[0]?.message ?? fallback;
}

export const idSchema = z.string().trim().min(1).max(64);

const numberFormatter = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

/** « 2,5 » — niveau moyen arrondi à une décimale, « — » si absent */
export function formatScore(value: number | null | undefined) {
  return value == null ? "—" : numberFormatter.format(value);
}

/** Hex de couleur de compétence sûr pour un attribut SVG/style (sinon null) */
export function safeColor(color: string | null | undefined) {
  return color && /^#[0-9a-f]{3,8}$/i.test(color) ? color : null;
}

/**
 * Nom public « Léa B. » (prénom + initiale du nom) pour les pages publiques.
 * Gère « Léa Bernard », « Jean-Pierre De La Tour » et le format administratif « BERNARD Léa ».
 */
export function publicName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Membre";
  if (parts.length === 1) return parts[0];
  const isUpper = (p: string) => p.length > 1 && p === p.toLocaleUpperCase("fr-FR") && p !== p.toLocaleLowerCase("fr-FR");
  const upper = parts.filter(isUpper);
  const others = parts.filter((p) => !isUpper(p));
  if (upper.length > 0 && others.length > 0) {
    return `${others[0]} ${upper[0].charAt(0).toLocaleUpperCase("fr-FR")}.`;
  }
  return `${parts[0]} ${parts[1].charAt(0).toLocaleUpperCase("fr-FR")}.`;
}
