"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "./shared";

type Props = {
  /** Server Action déjà liée à sa ressource (`action.bind(null, id)`) */
  action: () => Promise<ActionResult>;
  label: string;
  pendingLabel: string;
  confirmMessage: string;
  variant?: "danger" | "default" | "primary";
  /** Nom accessible plus précis que le libellé visible (ex. « Supprimer le lien GitHub ») */
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
};

/** Bouton d'action ponctuelle (supprimer, rouvrir, publier…) avec confirmation, état en cours, erreur et succès */
export function ConfirmActionButton({
  action,
  label,
  pendingLabel,
  confirmMessage,
  variant = "default",
  ariaLabel,
  disabled = false,
  className = "",
}: Props) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  function handleClick() {
    if (!window.confirm(confirmMessage)) return;
    setResult(null);
    startTransition(async () => {
      const next = await action();
      setResult(next);
    });
  }

  const tone = variant === "danger" ? "btn-danger" : variant === "primary" ? "btn-primary" : "";

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending || disabled}
        aria-label={ariaLabel}
        className={`btn ${tone} ${className}`}
      >
        {pending ? pendingLabel : label}
      </button>
      {result && !result.ok && (
        <span role="alert" className="form-error">
          {result.error}
        </span>
      )}
      {result?.ok && result.message && (
        <span role="status" className="text-sm text-ok">
          {result.message}
        </span>
      )}
    </span>
  );
}
