"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

/** Bouton d'ouverture d'une notification non lue (dans un <form action={openNotification}>) */
export function OpenNotificationButton({ children, className }: { children: ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={`${className ?? ""} ${pending ? "opacity-60" : ""}`}>
      {children}
      {pending && (
        <span role="status" className="sr-only">
          Ouverture…
        </span>
      )}
    </button>
  );
}

type Result = { ok: true } | { ok: false; error: string };

export function MarkAllReadButton({ action }: { action: () => Promise<Result> }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        className="btn"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await action();
            if (!result.ok) setError(result.error);
          });
        }}
      >
        {pending ? "Enregistrement…" : "Tout marquer comme lu"}
      </button>
      {error && (
        <span role="alert" className="form-error">
          {error}
        </span>
      )}
    </span>
  );
}
