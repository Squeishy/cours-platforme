import { duplicateSae } from "../../actions";
import { ActionForm, SubmitButton } from "../../_components/action-form";

/** Reconduction d'une année sur l'autre : copie en brouillon avec dates décalées */
export function DuplicateSection({ saeId, milestones }: { saeId: string; milestones: number }) {
  return (
    <section aria-labelledby="reconduire" className="scroll-mt-4 space-y-3">
      <h2 id="reconduire" className="text-xl font-semibold">
        Reconduire la SAÉ
      </h2>
      <div className="card space-y-3">
        <p className="text-sm text-muted">
          Crée une copie en brouillon dont vous êtes responsable : sujet, cours lié, équipe pédagogique,{" "}
          {milestones} jalon{milestones > 1 ? "s" : ""} et leurs critères. Les groupes, auto-évaluations, annonces et
          soutenances ne sont pas copiés.
        </p>
        <ActionForm action={duplicateSae} aria-label="Dupliquer la SAÉ">
          <input type="hidden" name="saeId" value={saeId} />
          <label htmlFor="duplicate-weeks" className="label">
            Décaler toutes les dates de (semaines)
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="duplicate-weeks"
              name="weeks"
              type="number"
              inputMode="numeric"
              min={-260}
              max={260}
              defaultValue={52}
              required
              aria-describedby="duplicate-weeks-hint"
              className="input sm:w-32"
            />
            <SubmitButton pendingLabel="Duplication…">Dupliquer la SAÉ</SubmitButton>
          </div>
          <p id="duplicate-weeks-hint" className="mt-1 text-xs text-muted">
            52 semaines = même jour de la semaine l&apos;année suivante. 0 pour garder les dates.
          </p>
        </ActionForm>
      </div>
    </section>
  );
}
