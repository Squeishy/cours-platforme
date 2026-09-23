"use client";

import { createContext, startTransition, useActionState, useContext, useEffect, useRef, type ReactNode } from "react";
import type { FormAction, FormResult } from "../_lib/form-result";

const PendingContext = createContext(false);

type Props = {
  action: FormAction;
  children: ReactNode;
  id?: string;
  className?: string;
  /** Confirmation avant l'envoi (suppression, régénération…) */
  confirmMessage?: string;
  /** Vide les champs après un succès (formulaires d'ajout) */
  resetOnSuccess?: boolean;
  "aria-label"?: string;
};

/**
 * Formulaire relié à une Server Action (useActionState).
 * L'envoi passe par onSubmit + startTransition pour conserver la saisie en cas d'erreur.
 */
export function ActionForm({ action, children, id, className, confirmMessage, resetOnSuccess = false, "aria-label": ariaLabel }: Props) {
  const [state, formAction, pending] = useActionState<FormResult, FormData>(action, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (resetOnSuccess && state?.ok) formRef.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form
      ref={formRef}
      id={id}
      className={className}
      aria-label={ariaLabel}
      aria-busy={pending}
      onSubmit={(event) => {
        event.preventDefault();
        if (pending) return;
        if (confirmMessage && !window.confirm(confirmMessage)) return;
        const formData = new FormData(event.currentTarget);
        startTransition(() => formAction(formData));
      }}
    >
      <PendingContext.Provider value={pending}>{children}</PendingContext.Provider>
      <p
        role="status"
        aria-live="polite"
        className={`basis-full whitespace-pre-line ${state && !state.ok ? "form-error" : "text-sm text-ok"} ${state && (state.ok ? state.message : true) ? "mt-2" : "sr-only"}`}
      >
        {state ? (state.ok ? (state.message ?? "") : state.error) : ""}
      </p>
    </form>
  );
}

type SubmitProps = {
  children: ReactNode;
  pendingLabel?: string;
  className?: string;
  disabled?: boolean;
  "aria-label"?: string;
};

export function SubmitButton({ children, pendingLabel, className = "btn btn-primary", disabled = false, "aria-label": ariaLabel }: SubmitProps) {
  const pending = useContext(PendingContext);
  return (
    <button type="submit" className={className} disabled={disabled || pending} aria-label={ariaLabel}>
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
