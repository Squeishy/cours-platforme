"use client";

import Link from "next/link";
import { useState } from "react";
import { createSae } from "../actions";
import { ActionForm, SubmitButton } from "../_components/action-form";
import { SaeFields, type CohortOption, type CourseOption } from "../_components/sae-fields";

export type SaeTemplateOption = { code: string; title: string; semester: number; acs: readonly string[] };

type Props = { courses: CourseOption[]; cohorts: CohortOption[]; templates: readonly SaeTemplateOption[] };

/** Création d'une SAÉ, éventuellement pré-remplie depuis une SAÉ du programme national */
export function NewSaeForm({ courses, cohorts, templates }: Props) {
  const [templateCode, setTemplateCode] = useState("");
  const template = templates.find((t) => t.code === templateCode);

  return (
    <ActionForm action={createSae} className="card space-y-5" aria-label="Créer une SAÉ">
      <div>
        <label htmlFor="new-sae-template" className="label">
          Partir d&apos;une SAÉ du programme national <span className="font-normal text-muted">(optionnel)</span>
        </label>
        <select
          id="new-sae-template"
          name="templateCode"
          className="input"
          value={templateCode}
          onChange={(e) => setTemplateCode(e.target.value)}
        >
          <option value="">Aucun modèle — SAÉ vierge</option>
          {[...new Set(templates.map((t) => t.semester))].map((s) => (
            <optgroup key={s} label={`Semestre ${s}`}>
              {templates.filter((t) => t.semester === s).map((t) => (
                <option key={t.code} value={t.code}>
                  {t.code} — {t.title}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <p className="mt-1 text-sm text-muted" aria-live="polite">
          {template
            ? template.acs.length > 0
              ? `Un jalon « Rendu final » sera créé avec ${template.acs.length} critères : ${template.acs.join(", ")}.`
              : "Un jalon « Rendu final » sera créé ; le programme ne fixe pas d'AC pour cette SAÉ, ajoutez vos critères ensuite."
            : "Code, titre et semestre sont pré-remplis ; les critères reprennent les apprentissages critiques du programme."}
        </p>
      </div>

      <div className="border-t border-line pt-5">
        {/* Changer de modèle réinitialise les champs pré-remplis */}
        <SaeFields
          key={templateCode || "blank"}
          idPrefix="new-sae"
          courses={courses}
          cohorts={cohorts}
          defaults={template ? { code: template.code, title: template.title, semester: template.semester } : undefined}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <SubmitButton pendingLabel="Création…">Créer la SAÉ</SubmitButton>
        <Link href="/saes" className="btn">
          Annuler
        </Link>
      </div>
    </ActionForm>
  );
}
