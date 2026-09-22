import type { Metadata } from "next";
import Link from "next/link";
import { assertAllowed, requireUser } from "@/lib/session";
import { canCreateSae } from "@/lib/permissions";
import { MMI_SAE_TEMPLATES } from "@/data/referentiel-mmi";
import { findCohortOptions, findEditableCourses } from "../_lib/queries";
import { NewSaeForm } from "./new-sae-form";

export const metadata: Metadata = { title: "Nouvelle SAÉ" };

export default async function NewSaePage() {
  const user = await requireUser();
  assertAllowed(canCreateSae(user));

  const [courses, cohorts] = await Promise.all([findEditableCourses(user), findCohortOptions()]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/saes" className="inline-flex min-h-11 items-center text-sm text-muted hover:underline">
          ← Toutes les SAÉ
        </Link>
        <p className="eyebrow">Nouvelle SAÉ</p>
        <h1 className="text-2xl font-semibold text-balance">Créer une SAÉ</h1>
        <p className="mt-1 text-muted">
          La SAÉ est créée en brouillon : vous pourrez rédiger le sujet, régler les jalons, les critères et les groupes
          avant de la publier.
        </p>
      </div>

      <NewSaeForm courses={courses} cohorts={cohorts} templates={MMI_SAE_TEMPLATES} />
    </div>
  );
}
