import type { Metadata } from "next";
import Link from "next/link";
import { assertAllowed, requireUser } from "@/lib/session";
import { canCreateSae } from "@/lib/permissions";
import { createSae } from "../actions";
import { ActionForm, SubmitButton } from "../_components/action-form";
import { SaeFields } from "../_components/sae-fields";
import { findEditableCourses } from "../_lib/queries";

export const metadata: Metadata = { title: "Nouvelle SAÉ" };

export default async function NewSaePage() {
  const user = await requireUser();
  assertAllowed(canCreateSae(user));

  const courses = await findEditableCourses(user);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/saes" className="inline-flex min-h-11 items-center text-sm text-muted hover:underline">
          ← Toutes les SAÉ
        </Link>
        <h1 className="text-2xl font-semibold">Nouvelle SAÉ</h1>
        <p className="mt-1 text-muted">
          La SAÉ est créée en brouillon : vous pourrez ajouter le sujet, les jalons, les critères et les groupes avant
          de la publier.
        </p>
      </div>

      <ActionForm action={createSae} className="card space-y-4" aria-label="Créer une SAÉ">
        <SaeFields idPrefix="new-sae" courses={courses} />
        <div className="flex flex-wrap gap-3">
          <SubmitButton pendingLabel="Création…">Créer la SAÉ</SubmitButton>
          <Link href="/saes" className="btn">
            Annuler
          </Link>
        </div>
      </ActionForm>
    </div>
  );
}
