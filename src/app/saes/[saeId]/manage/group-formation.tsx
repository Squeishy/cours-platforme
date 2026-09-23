import { addGroupMembersBulk, autoCreateGroups } from "../../actions";
import { ActionForm, SubmitButton } from "../../_components/action-form";
import { EditDisclosure } from "./fields";

/** Ajout en lot dans un groupe : liste d'adresses collée */
export function BulkMembersForm({ groupId, groupName }: { groupId: string; groupName: string }) {
  const fieldId = `bulk-emails-${groupId}`;
  return (
    <EditDisclosure summary="Ajouter une liste">
      <ActionForm action={addGroupMembersBulk} resetOnSuccess className="space-y-2" aria-label={`Ajouter une liste à ${groupName}`}>
        <input type="hidden" name="groupId" value={groupId} />
        <label htmlFor={fieldId} className="label">
          Adresses e-mail <span className="font-normal text-muted">(une par ligne, ou séparées par des virgules)</span>
        </label>
        <textarea
          id={fieldId}
          name="emails"
          className="input py-2 font-mono text-sm"
          rows={4}
          required
          maxLength={30000}
          autoComplete="off"
          spellCheck={false}
          placeholder={"lea.bernard@univ.fr\nhugo.moreau@univ.fr"}
        />
        <SubmitButton pendingLabel="Ajout…">Ajouter ces étudiants</SubmitButton>
      </ActionForm>
    </EditDisclosure>
  );
}

type AutoProps = {
  saeId: string;
  cohort: { name: string; academicYear: string } | null;
  /** Étudiants de la promo sans groupe dans cette SAÉ */
  unassigned: number;
};

/** « Créer des groupes automatiquement » à partir de la promo liée */
export function AutoGroupsCard({ saeId, cohort, unassigned }: AutoProps) {
  return (
    <div className="card space-y-3">
      <h3 className="font-semibold">Créer des groupes automatiquement</h3>
      {!cohort ? (
        <p className="text-sm text-muted">
          Liez d&apos;abord une promo à la SAÉ dans les{" "}
          <a href="#reglages" className="underline">
            réglages
          </a>{" "}
          : les étudiants de la promo sans groupe seront répartis au hasard.
        </p>
      ) : unassigned === 0 ? (
        <p className="text-sm text-muted">
          Tous les étudiants de la promo {cohort.name} ({cohort.academicYear}) ont déjà un groupe dans cette SAÉ.
        </p>
      ) : (
        <ActionForm
          action={autoCreateGroups}
          aria-label="Créer des groupes automatiquement"
          confirmMessage={`Répartir au hasard ${unassigned} étudiant·es de ${cohort.name} dans de nouveaux groupes ?`}
        >
          <input type="hidden" name="saeId" value={saeId} />
          <p className="mb-3 text-sm text-muted">
            {unassigned} étudiant·e{unassigned > 1 ? "s" : ""} de la promo {cohort.name} ({cohort.academicYear}) sans
            groupe. Les groupes sont équilibrés (écart d&apos;un étudiant au plus) et nommés « Groupe 1 », « Groupe 2 »…
          </p>
          <label htmlFor="auto-group-size" className="label">
            Taille maximale d&apos;un groupe
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="auto-group-size"
              name="size"
              type="number"
              inputMode="numeric"
              min={2}
              max={12}
              defaultValue={4}
              required
              className="input sm:w-32"
            />
            <SubmitButton pendingLabel="Création des groupes…">Créer les groupes</SubmitButton>
          </div>
        </ActionForm>
      )}
    </div>
  );
}
