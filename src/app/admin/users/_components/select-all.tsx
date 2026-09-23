"use client";

import { useId } from "react";

type Props = { formId: string; name: string };

/** Coche / décoche toutes les cases de la page reliées au formulaire groupé */
export function SelectAll({ formId, name }: Props) {
  const id = useId();
  return (
    <label htmlFor={id} className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm">
      <input
        id={id}
        type="checkbox"
        className="size-5"
        onChange={(event) => {
          const checked = event.currentTarget.checked;
          document
            .querySelectorAll<HTMLInputElement>(`input[type="checkbox"][name="${name}"][form="${formId}"]`)
            .forEach((box) => {
              box.checked = checked;
            });
        }}
      />
      Tout sélectionner sur cette page
    </label>
  );
}
