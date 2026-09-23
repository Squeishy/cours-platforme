import type { ReactNode } from "react";
import { cx } from "./cx";

/**
 * StatusBadge — pilule mono 12 px : fond teinté + texte foncé + libellé.
 * La couleur n'est jamais seule porteuse du sens (le libellé est obligatoire).
 * L'accent n'est pas un statut : `accent` sert uniquement à « actif / sélectionné / nouveau ».
 *
 *   <StatusBadge tone="ok">Soumise</StatusBadge>
 *   <AssessmentStatusBadge status={assessment?.status ?? "NONE"} />
 */
export type StatusTone = "neutral" | "accent" | "ok" | "warn" | "danger";

const TONE_CLASS: Record<StatusTone, string> = {
  neutral: "",
  accent: "badge-accent",
  ok: "badge-ok",
  warn: "badge-warn",
  danger: "badge-danger",
};

type StatusBadgeProps = { tone?: StatusTone; children: ReactNode; className?: string; dot?: boolean };

export function StatusBadge({ tone = "neutral", children, className, dot = false }: StatusBadgeProps) {
  return (
    <span className={cx("badge", TONE_CLASS[tone], className)}>
      {dot && <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export type AssessmentStatusValue = "NONE" | "DRAFT" | "SUBMITTED";

export const ASSESSMENT_STATUS: Record<AssessmentStatusValue, { tone: StatusTone; label: string }> = {
  NONE: { tone: "neutral", label: "Non commencée" },
  DRAFT: { tone: "warn", label: "Brouillon" },
  SUBMITTED: { tone: "ok", label: "Soumise" },
};

/** Statut d'une auto-évaluation ; « NONE » = aucune auto-évaluation créée */
export function AssessmentStatusBadge({ status, className }: { status: AssessmentStatusValue; className?: string }) {
  const s = ASSESSMENT_STATUS[status];
  return (
    <StatusBadge tone={s.tone} dot className={className}>
      <span className="sr-only">Auto-évaluation : </span>
      {s.label}
    </StatusBadge>
  );
}
