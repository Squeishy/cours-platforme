"use client";

import { startTransition, useActionState, useEffect, useRef, type FormEvent } from "react";
import type { ActionResult } from "@/app/assessments/_lib/shared";

type Props = {
  action: (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  milestones: { id: string; title: string }[];
};

export function DepositForm({ action, milestones }: Props) {
  const [state, dispatch, pending] = useActionState(action, null);
  const formRef = useRef<HTMLFormElement>(null);

  // Vider le formulaire uniquement après un ajout réussi (les saisies restent en cas d'erreur)
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => dispatch(formData));
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="card flex flex-col gap-4" aria-describedby="deposit-help">
      <h3 className="text-base font-semibold">Ajouter une URL de dépôt</h3>
      <p id="deposit-help" className="text-sm text-muted">
        Aucun fichier n&apos;est hébergé ici : collez le lien vers votre dépôt (GitHub, GitLab, Google Drive, OneDrive,
        Figma…). Vérifiez que l&apos;équipe pédagogique y a accès.
      </p>

      <div>
        <label htmlFor="deposit-url" className="label">
          URL <span className="text-danger">*</span>
        </label>
        <input
          id="deposit-url"
          name="url"
          type="url"
          inputMode="url"
          required
          maxLength={2048}
          autoComplete="off"
          spellCheck={false}
          className="input"
        />
      </div>

      <div>
        <label htmlFor="deposit-milestone" className="label">
          Jalon concerné
        </label>
        <select id="deposit-milestone" name="milestoneId" defaultValue="" className="input">
          <option value="">Général (aucun jalon précis)</option>
          {milestones.map((m) => (
            <option key={m.id} value={m.id}>
              {m.title}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="deposit-label" className="label">
          Libellé <span className="font-normal text-muted">(facultatif)</span>
        </label>
        <input id="deposit-label" name="label" type="text" maxLength={191} className="input" />
      </div>

      <div className="flex flex-col items-start gap-2">
        <button type="submit" className="btn btn-primary w-full sm:w-auto" disabled={pending}>
          {pending ? "Ajout en cours…" : "Ajouter l'URL"}
        </button>
        <p role="status" aria-live="polite" className={state && !state.ok ? "form-error" : "text-sm text-ok"}>
          {state ? (state.ok ? (state.message ?? "Enregistré") : state.error) : ""}
        </p>
      </div>
    </form>
  );
}
