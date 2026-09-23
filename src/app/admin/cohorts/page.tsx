import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { assertAllowed, requireUser } from "@/lib/session";
import { canManageCohorts } from "@/lib/permissions";
import { PageHeader } from "@/components/ui";
import { AdminNav } from "@/app/admin/users/_components/admin-nav";
import { createCohort } from "./actions";
import { CohortForm } from "./_components/cohort-form";
import { PARCOURS_OPTIONS, currentAcademicYear, parcoursLabel } from "./_lib/cohorts";

export const metadata: Metadata = { title: "Promos" };

export default async function CohortsPage() {
  const user = await requireUser();
  assertAllowed(canManageCohorts(user));

  const cohorts = await db.cohort.findMany({
    select: {
      id: true,
      name: true,
      year: true,
      parcours: true,
      academicYear: true,
      _count: { select: { members: true, saes: true } },
    },
    orderBy: [{ academicYear: "desc" }, { year: "asc" }, { name: "asc" }],
    take: 300,
  });

  const byYear = new Map<string, typeof cohorts>();
  for (const c of cohorts) byYear.set(c.academicYear, [...(byYear.get(c.academicYear) ?? []), c]);
  const thisYear = currentAcademicYear();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <AdminNav user={user} current="cohorts" />
        <PageHeader
          eyebrow="Administration"
          title="Promos"
          lead="Une promo regroupe les étudiants d'une année (TD, TP ou parcours). Elle sert aux annonces ciblées et à l'ajout rapide des étudiants dans les groupes de SAÉ."
        />
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <section aria-labelledby="cohort-list" className="flex min-w-0 flex-col gap-4">
          <h2 id="cohort-list" className="text-lg font-semibold">
            Toutes les promos <span className="font-mono text-sm font-normal text-muted">{cohorts.length}</span>
          </h2>
          {cohorts.length === 0 ? (
            <p className="card text-muted">
              Aucune promo pour l&apos;instant. Créez la première avec le formulaire, puis collez les adresses e-mail des
              étudiants.
            </p>
          ) : (
            [...byYear.entries()].map(([academicYear, list]) => (
              <div key={academicYear} className="flex flex-col gap-2">
                <h3 className="eyebrow font-mono">
                  {academicYear}
                  {academicYear === thisYear ? " · en cours" : ""}
                </h3>
                <ul className="flex flex-col divide-y divide-line rounded-md border border-line bg-surface">
                  {list.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`/admin/cohorts/${c.id}`}
                        className="flex min-h-11 flex-col gap-1 px-4 py-3 hover:bg-sunken sm:flex-row sm:items-center sm:gap-3"
                      >
                        <span className="min-w-0 font-medium break-words sm:flex-1">{c.name}</span>
                        <span className="flex flex-wrap items-center gap-2 text-sm text-muted">
                          <span className="badge font-mono">BUT {c.year}</span>
                          <span className="badge">{parcoursLabel(c.parcours)}</span>
                          <span className="font-mono">
                            {c._count.members} membre{c._count.members > 1 ? "s" : ""}
                          </span>
                          {c._count.saes > 0 && (
                            <span className="font-mono">
                              · {c._count.saes} SAÉ
                            </span>
                          )}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </section>

        <section aria-labelledby="cohort-new" className="card flex flex-col gap-4">
          <h2 id="cohort-new" className="text-lg font-semibold">
            Nouvelle promo
          </h2>
          <CohortForm
            action={createCohort}
            parcoursOptions={PARCOURS_OPTIONS}
            initial={{ name: "", year: 1, parcours: null, academicYear: thisYear }}
            submitLabel="Créer la promo"
            pendingLabel="Création…"
            resetOnSuccess
          />
        </section>
      </div>
    </div>
  );
}
