"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "./shared";

type Props = {
  /** Server Action déjà liée à sa ressource (`action.bind(null, id)`) */
  action: () => Promise<ActionResult>;
  label: string;
  pendingLabel: string;
  confirmMessage: string;
  variant?: "danger" | "default";
  /** Nom accessible plus précis que le libellé visible (ex. « Supprimer le lien GitHub ») */
  ariaLabel?: string;
};

/** Bouton d'action ponctuelle (supprimer, rouvrir…) avec confirmation, état en cours et erreur */
export function ConfirmActionButton({
  action,
  label,
  pendingLabel,
  confirmMessage,
  variant = "default",
  ariaLabel,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    if (!window.confirm(confirmMessage)) return;
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        aria-label={ariaLabel}
        className={`btn ${variant === "danger" ? "btn-danger" : ""}`}
      >
        {pending ? pendingLabel : label}
      </button>
      {error && (
        <span role="alert" className="form-error">
          {error}
        </span>
      )}
    </span>
  );
}
