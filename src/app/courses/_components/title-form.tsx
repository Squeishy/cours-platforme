"use client";

import { useActionState, useId } from "react";
import type { FormAction } from "../_lib/action-state";

type Props = {
  action: FormAction;
  label: string;
  submitLabel: string;
  defaultValue?: string;
  placeholder?: string;
  successMessage?: string;
};

/** Formulaire à un champ « titre » (nouvelle page, sous-page, renommage) */
export function TitleForm({ action, label, submitLabel, defaultValue, placeholder, successMessage }: Props) {
  const [state, formAction, pending] = useActionState(action, null);
  const id = useId();

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <label htmlFor={id} className="label">
        {label}
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id={id}
          name="title"
          required
          maxLength={190}
          defaultValue={defaultValue}
          placeholder={placeholder}
          className="input"
        />
        <button type="submit" className="btn btn-primary shrink-0" disabled={pending}>
          {pending ? "Envoi…" : submitLabel}
        </button>
      </div>
      <p role="status" aria-live="polite" className={state && !state.ok ? "form-error" : "text-sm text-ok"}>
        {state && !state.ok ? state.error : state?.ok && successMessage ? successMessage : ""}
      </p>
    </form>
  );
}
