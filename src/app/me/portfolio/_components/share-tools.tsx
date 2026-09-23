"use client";

import { useState } from "react";

/** Copie le lien public dans le presse-papiers (repli : sélection du champ) */
export function CopyLinkButton({
  value,
  inputId,
}: {
  value: string;
  inputId: string;
}) {
  const [status, setStatus] = useState("");
  const [failed, setFailed] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setFailed(false);
      setStatus("Lien copié.");
    } catch {
      const input = document.getElementById(inputId);
      if (input instanceof HTMLInputElement) input.select();
      setFailed(true);
      setStatus(
        "Copie automatique impossible : le lien est sélectionné, copiez-le (Ctrl+C).",
      );
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button type="button" className="btn" onClick={copy}>
        Copier le lien
      </button>
      <span
        role="status"
        aria-live="polite"
        className={failed ? "form-error" : "text-sm text-ok"}
      >
        {status}
      </span>
    </span>
  );
}

export function PrintButton({ label = "Imprimer / PDF" }: { label?: string }) {
  return (
    <button
      type="button"
      className="btn print:hidden"
      onClick={() => window.print()}
    >
      {label}
    </button>
  );
}
