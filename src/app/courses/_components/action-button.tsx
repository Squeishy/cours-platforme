"use client";

import { useActionState } from "react";
import type { FormAction } from "../_lib/action-state";

type Props = {
  action: FormAction;
  label: string;
  pendingLabel?: string;
  /** Demande une confirmation avant d'envoyer (actions destructrices) */
  confirmMessage?: string;
  /** Libellé accessible si le texte visible est ambigu (ex. « ↑ ») */
  ariaLabel?: string;
  variant?: "default" | "primary" | "danger";
  className?: string;
};

const VARIANT: Record<NonNullable<Props["variant"]>, string> = {
  default: "btn",
  primary: "btn btn-primary",
  danger: "btn btn-danger",
};

/** Bouton isolé qui déclenche une Server Action et affiche son erreur éventuelle */
export function ActionButton({ action, label, pendingLabel, confirmMessage, ariaLabel, variant = "default", className }: Props) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirmMessage && !window.confirm(confirmMessage)) e.preventDefault();
      }}
    >
      <button type="submit" className={VARIANT[variant]} disabled={pending} aria-label={ariaLabel}>
        {pending ? (pendingLabel ?? label) : label}
      </button>
      {state && !state.ok && (
        <p role="alert" className="form-error mt-1">
          {state.error}
        </p>
      )}
    </form>
  );
}
