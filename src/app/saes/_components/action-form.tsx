"use client";

import { createContext, startTransition, useActionState, useContext, useEffect, useRef, type ReactNode } from "react";
import type { FormAction, FormState } from "../_lib/form-state";

const PendingContext = createContext(false);

type Props = {
  action: FormAction;
  children: ReactNode;
  className?: string;
  /** Demande une confirmation avant l'envoi (suppression, etc.) */
  confirmMessage?: string;
  /** Vide les champs après un succès (formulaires d'ajout) */
  resetOnSuccess?: boolean;
  /** Masque le message de succès (actions discrètes : déplacer, retirer) */
  quiet?: boolean;
  "aria-label"?: string;
};

/**
 * Formulaire relié à une Server Action via useActionState.
 * L'envoi passe par onSubmit pour conserver la saisie en cas d'erreur
 * (le reset automatique de React 19 n'intervient que sur `action={...}`).
 */
export function ActionForm({
  action,
  children,
  className,
  confirmMessage,
  resetOnSuccess = false,
  quiet = false,
  "aria-label": ariaLabel,
}: Props) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (resetOnSuccess && state?.ok) formRef.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form
      ref={formRef}
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
      {state && !state.ok && (
        <p role="alert" className="form-error mt-2 basis-full whitespace-pre-line">
          {state.error}
        </p>
      )}
      {state?.ok && state.message && !quiet && (
        <p role="status" className="mt-2 basis-full text-sm whitespace-pre-line text-ok">
          {state.message}
        </p>
      )}
    </form>
  );
}

type SubmitProps = {
  children: ReactNode;
  pendingLabel?: string;
  className?: string;
  disabled?: boolean;
  "aria-label"?: string;
  title?: string;
};

export function SubmitButton({
  children,
  pendingLabel,
  className = "btn btn-primary",
  disabled = false,
  "aria-label": ariaLabel,
  title,
}: SubmitProps) {
  const pending = useContext(PendingContext);
  return (
    <button type="submit" className={className} disabled={disabled || pending} aria-label={ariaLabel} title={title}>
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
