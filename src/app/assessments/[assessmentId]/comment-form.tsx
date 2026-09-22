"use client";

import { startTransition, useActionState, useEffect, useRef, type FormEvent } from "react";
import type { ActionResult } from "@/app/assessments/_lib/shared";

type Props = {
  action: (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;
};

export function CommentForm({ action }: Props) {
  const [state, dispatch, pending] = useActionState(action, null);
  const formRef = useRef<HTMLFormElement>(null);

  // Vider le champ uniquement après publication (le texte reste en cas d'erreur)
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => dispatch(formData));
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div>
        <label htmlFor="comment-body" className="label">
          Ajouter un commentaire
        </label>
        <textarea
          id="comment-body"
          name="body"
          required
          minLength={1}
          maxLength={5000}
          rows={4}
          className="input py-2"
        />
      </div>
      <div className="flex flex-col items-start gap-2">
        <button type="submit" className="btn btn-primary w-full sm:w-auto" disabled={pending}>
          {pending ? "Publication…" : "Publier le commentaire"}
        </button>
        <p role="status" aria-live="polite" className={state && !state.ok ? "form-error" : "text-sm text-ok"}>
          {state ? (state.ok ? (state.message ?? "Publié") : state.error) : ""}
        </p>
      </div>
    </form>
  );
}
