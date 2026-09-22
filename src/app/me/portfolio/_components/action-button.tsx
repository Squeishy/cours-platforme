"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "../_lib/shared";

type Props = {
  /** Server Action déjà liée à sa ressource (`action.bind(null, id)`) */
  action: () => Promise<ActionResult>;
  label: string;
  pendingLabel: string;
  /** Demande une confirmation avant d'agir (actions destructrices) */
  confirmMessage?: string;
  variant?: "primary" | "danger" | "default" | "ghost";
  /** Nom accessible plus précis que le libellé visible */
  ariaLabel?: string;
  /** Afficher le message de succès renvoyé par l'action */
  showSuccess?: boolean;
  className?: string;
};

const VARIANTS = {
  primary: "btn btn-primary",
  danger: "btn btn-danger",
  default: "btn",
  ghost: "btn btn-ghost",
} as const;

/** Bouton d'action ponctuelle : état en cours, confirmation facultative, retour annoncé (aria-live) */
export function ActionButton({
  action,
  label,
  pendingLabel,
  confirmMessage,
  variant = "default",
  ariaLabel,
  showSuccess = false,
  className = "",
}: Props) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  function handleClick() {
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    setResult(null);
    startTransition(async () => {
      try {
        setResult(await action());
      } catch {
        setResult({ ok: false, error: "Action impossible pour le moment. Réessayez." });
      }
    });
  }

  const message = result ? (result.ok ? (showSuccess ? (result.message ?? "") : "") : result.error) : "";

  return (
    <span className={`inline-flex flex-col items-start gap-1 print:hidden ${className}`}>
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        aria-label={ariaLabel}
        aria-busy={pending || undefined}
        className={VARIANTS[variant]}
      >
        {pending ? pendingLabel : label}
      </button>
      <span role="status" aria-live="polite" className={result && !result.ok ? "form-error" : "text-sm text-ok"}>
        {message}
      </span>
    </span>
  );
}
