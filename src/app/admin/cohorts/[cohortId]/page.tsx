import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { assertAllowed, requireUser } from "@/lib/session";
import { ROLE_LABELS, canManageCohorts } from "@/lib/permissions";
import { PageHeader } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/app/admin/users/_components/action-form";
import { addMembers, deleteCohort, removeMember, updateCohort } from "../actions";
import { CohortForm } from "../_components/cohort-form";
import { MAX_EMAILS_PER_PASTE, PARCOURS_OPTIONS, parcoursLabel } from "../_lib/cohorts";

export const metadata: Metadata = { title: "Promo" };

const MEMBERS_LIMIT = 500;

export default async function CohortPage({ params }: PageProps<"/admin/cohorts/[cohortId]">) {
  const user = await requireUser();
  assertAllowed(canManageCohorts(user));
  const { cohortId } = await params;

  const cohort = await db.cohort.findUnique({
    where: { id: cohortId },
    select: {
      id: true,
      name: true,
      year: true,
      parcours: true,
      academicYear: true,
      _count: { select: { members: true, saes: true, announcements: true } },
      members: {
        select: { user: { select: { id: true, name: true, email: true, role: true } } },
        orderBy: { user: { name: "asc" } },
        take: MEMBERS_LIMIT,
      },
    },
  });
  if (!cohort) notFound();

  const count = cohort._count.members;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <Link href="/admin/cohorts" className="inline-flex min-h-11 items-center gap-1 self-start text-sm text-muted hover:text-ink hover:underline">
          <span aria-hidden="true">←</span> Toutes les promos
        </Link>
        <PageHeader
          eyebrow={`${cohort.academicYear} · BUT ${cohort.year}`}
          title={cohort.name}
          meta={
            <>
              <span>{parcoursLabel(cohort.parcours)}</span>
              <span>
                {count} membre{count > 1 ? "s" : ""}
              </span>
              {cohort._count.saes > 0 && (
                <span>
                  {cohort._count.saes} SAÉ liée{cohort._count.saes > 1 ? "s" : ""}
                </span>
              )}
            </>
          }
        />
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <section aria-labelledby="members-title" className="flex min-w-0 flex-col gap-3">
          <h2 id="members-title" className="text-lg font-semibold">
            Membres <span className="font-mono text-sm font-normal text-muted">{count}</span>
          </h2>
          {cohort.members.length === 0 ? (
            <p className="card text-muted">Aucun membre. Collez les adresses e-mail des étudiants pour remplir la promo.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line rounded-md border border-line bg-surface">
              {cohort.members.map(({ user: m }) => (
                <li key={m.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-3">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="font-medium break-words">
                      {m.name}
                      {m.role !== "STUDENT" && <span className="badge ml-2">{ROLE_LABELS[m.role]}</span>}
                    </span>
                    <span className="text-sm break-all text-muted">{m.email}</span>
                  </div>
                  <ActionForm
                    action={removeMember.bind(null, cohort.id, m.id)}
                    confirmMessage={`Retirer ${m.name} de la promo « ${cohort.name} » ?`}
                    className="flex flex-col items-start"
                  >
                    <SubmitButton className="btn btn-ghost" pendingLabel="Retrait…" aria-label={`Retirer ${m.name} de la promo`}>
                      Retirer
                    </SubmitButton>
                  </ActionForm>
                </li>
              ))}
            </ul>
          )}
          {count > cohort.members.length && (
            <p className="text-sm text-muted">
              {cohort.members.length} premiers membres affichés sur {count}.
            </p>
          )}
        </section>

        <div className="flex flex-col gap-6">
          <section aria-labelledby="add-title" className="card flex flex-col gap-3">
            <h2 id="add-title" className="text-lg font-semibold">
              Ajouter des membres
            </h2>
            <ActionForm action={addMembers.bind(null, cohort.id)} resetOnSuccess className="flex flex-col gap-3">
              <div>
                <label htmlFor="cohort-emails" className="label">
                  Adresses e-mail
                </label>
                <textarea
                  id="cohort-emails"
                  name="emails"
                  required
                  rows={6}
                  maxLength={40_000}
                  spellCheck={false}
                  autoComplete="off"
                  className="input py-2 font-mono text-sm"
                  aria-describedby="cohort-emails-hint"
                />
                <p id="cohort-emails-hint" className="mt-1 text-xs text-muted">
                  Une par ligne, ou séparées par des virgules ou points-virgules (copier-coller depuis un tableur ou
                  Apogée). {MAX_EMAILS_PER_PASTE} au maximum. Les personnes doivent déjà avoir un compte.
                </p>
              </div>
              <div>
                <SubmitButton pendingLabel="Ajout…">Ajouter à la promo</SubmitButton>
              </div>
            </ActionForm>
          </section>

          <section aria-labelledby="edit-title" className="card flex flex-col gap-3">
            <h2 id="edit-title" className="text-lg font-semibold">
              Modifier la promo
            </h2>
            <CohortForm
              action={updateCohort.bind(null, cohort.id)}
              parcoursOptions={PARCOURS_OPTIONS}
              initial={{ name: cohort.name, year: cohort.year, parcours: cohort.parcours, academicYear: cohort.academicYear }}
              submitLabel="Enregistrer"
              pendingLabel="Enregistrement…"
            />
          </section>

          <section aria-labelledby="delete-title" className="card flex flex-col gap-3 border-danger/40">
            <h2 id="delete-title" className="text-lg font-semibold">
              Supprimer la promo
            </h2>
            <p className="text-sm text-muted">
              Les comptes des membres sont conservés.
              {cohort._count.announcements > 0
                ? ` Ses ${cohort._count.announcements} annonce${cohort._count.announcements > 1 ? "s" : ""} seront supprimées.`
                : ""}
              {cohort._count.saes > 0 ? " Les SAÉ liées seront simplement détachées." : ""}
            </p>
            <ActionForm
              action={deleteCohort.bind(null, cohort.id)}
              confirmMessage={`Supprimer définitivement la promo « ${cohort.name} » ? Cette action est irréversible.`}
            >
              <SubmitButton className="btn btn-danger" pendingLabel="Suppression…">
                Supprimer la promo
              </SubmitButton>
            </ActionForm>
          </section>
        </div>
      </div>
    </div>
  );
}
