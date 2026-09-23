"use client";

import { useActionState, useId } from "react";
import type { FormAction } from "../_lib/action-state";

export function AnswerForm({ action }: { action: FormAction }) {
  const [state, formAction, pending] = useActionState(action, null);
  const id = useId();
  const values = state && !state.ok ? state.values : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-2 pt-2">
      <label htmlFor={`${id}-body`} className="label">
        Votre réponse
      </label>
      <textarea
        id={`${id}-body`}
        name="body"
        required
        rows={3}
        maxLength={5000}
        defaultValue={values?.body}
        className="input py-2"
      />
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Envoi…" : "Répondre"}
        </button>
        <p role="status" aria-live="polite" className={state && !state.ok ? "form-error" : "text-sm text-ok"}>
          {state ? (state.ok ? "Réponse publiée." : state.error) : ""}
        </p>
      </div>
    </form>
  );
}
