"use client";

import { useEffect, useRef, useState } from "react";

type Props = { id: string; label: string; value: string; hint?: string };

/** Champ en lecture seule + bouton « Copier » (repli : sélection du texte) */
export function CopyField({ id, label, value, hint }: Props) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state === "idle") return;
    const t = window.setTimeout(() => setState("idle"), 3000);
    return () => window.clearTimeout(t);
  }, [state]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setState("copied");
    } catch {
      inputRef.current?.select();
      setState("failed");
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="label mb-0">
        {label}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          ref={inputRef}
          id={id}
          readOnly
          value={value}
          spellCheck={false}
          aria-describedby={hint ? `${id}-hint` : undefined}
          onFocus={(e) => e.currentTarget.select()}
          className="input min-w-0 font-mono text-sm sm:flex-1"
        />
        <button type="button" className="btn shrink-0" onClick={copy} aria-label={`Copier : ${label}`}>
          {state === "copied" ? "Copié" : "Copier"}
        </button>
      </div>
      <p role="status" aria-live="polite" className={state === "failed" ? "form-error" : "text-xs text-ok"}>
        {state === "copied"
          ? "Lien copié dans le presse-papiers."
          : state === "failed"
            ? "Copie automatique impossible : le lien est sélectionné, copiez-le avec Ctrl+C (ou ⌘+C)."
            : ""}
      </p>
    </div>
  );
}
