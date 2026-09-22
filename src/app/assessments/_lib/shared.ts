// Utilitaires partagés par les routes du slice « auto-évaluations » (groupes, jalons, évaluations).
import { levelLabel } from "@/lib/assessment";

/** Résultat standard des Server Actions */
export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

export type AssessmentStatusValue = "DRAFT" | "SUBMITTED";

/** Statut d'une auto-évaluation, y compris « pas encore créée » */
export const STATUS_LABELS: Record<AssessmentStatusValue | "NONE", string> = {
  NONE: "Pas commencée",
  DRAFT: "Brouillon",
  SUBMITTED: "Soumise",
};

const TIME_ZONE = "Europe/Paris";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: TIME_ZONE });
const dateTimeFormatter = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: TIME_ZONE,
});
const averageFormatter = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

export function formatDate(date: Date) {
  return dateFormatter.format(date);
}

export function formatDateTime(date: Date) {
  return dateTimeFormatter.format(date);
}

/** Moyenne des niveaux (1..4), ou null si aucun niveau */
export function averageLevel(levels: number[]): number | null {
  if (levels.length === 0) return null;
  return levels.reduce((sum, l) => sum + l, 0) / levels.length;
}

export function formatAverage(avg: number | null) {
  return avg === null ? "—" : `${averageFormatter.format(avg)} / 4`;
}

export function describeLevel(level: number) {
  return `${level}/4 · ${levelLabel(level)}`;
}

/** Premier message d'erreur lisible d'un résultat zod */
export function firstIssue(issues: { message: string }[], fallback = "Données invalides") {
  return issues[0]?.message ?? fallback;
}
