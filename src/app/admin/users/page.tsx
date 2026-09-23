import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { assertAllowed, requireUser } from "@/lib/session";
import { ROLE_LABELS, isAdmin, type Role } from "@/lib/permissions";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/ui";
import { addUsersToCohort, changeRole } from "./actions";
import { RoleForm } from "./role-form";
import { ActionForm, SubmitButton } from "./_components/action-form";
import { AdminNav } from "./_components/admin-nav";
import { SelectAll } from "./_components/select-all";
import { USERS_PAGE_SIZE, pageCount, parseUserFilters, usersHref } from "./_lib/filters";

export const metadata: Metadata = { title: "Utilisateurs" };

const ROLES = (Object.keys(ROLE_LABELS) as Role[]).map((value) => ({ value, label: ROLE_LABELS[value] }));
const BULK_FORM_ID = "bulk-cohort";

export default async function AdminUsersPage({ searchParams }: PageProps<"/admin/users">) {
  const user = await requireUser();
  assertAllowed(isAdmin(user));

  const filters = parseUserFilters(await searchParams);
  const conditions: Prisma.UserWhereInput[] = [];
  if (filters.q) conditions.push({ OR: [{ name: { contains: filters.q } }, { email: { contains: filters.q } }] });
  if (filters.role) conditions.push({ role: filters.role });
  if (filters.cohort === "none") conditions.push({ cohorts: { none: {} } });
  else if (filters.cohort) conditions.push({ cohorts: { some: { cohortId: filters.cohort } } });
  const where: Prisma.UserWhereInput = conditions.length ? { AND: conditions } : {};

  const [total, users, cohorts] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        cohorts: {
          select: { cohort: { select: { id: true, name: true, academicYear: true } } },
          orderBy: { cohort: { academicYear: "desc" } },
          take: 6,
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (filters.page - 1) * USERS_PAGE_SIZE,
      take: USERS_PAGE_SIZE,
    }),
    db.cohort.findMany({
      select: { id: true, name: true, academicYear: true },
      orderBy: [{ academicYear: "desc" }, { year: "asc" }, { name: "asc" }],
      take: 300,
    }),
  ]);

  const pages = pageCount(total);
  const filtered = !!(filters.q || filters.role || filters.cohort);
  const selectedCohort = cohorts.find((c) => c.id === filters.cohort);
  // Sélection groupée seulement s'il existe au moins une promo cible
  const bulk = cohorts.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <AdminNav user={user} current="users" />
        <PageHeader eyebrow="Administration" title="Utilisateurs" lead="Rôles des comptes et rattachement aux promos." />
      </div>

      <form method="get" role="search" aria-label="Filtrer les utilisateurs" className="card flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end">
        <div className="min-w-0 md:flex-1">
          <label htmlFor="user-search" className="label">
            Nom ou e-mail
          </label>
          <input id="user-search" name="q" type="search" defaultValue={filters.q} maxLength={100} className="input" />
        </div>
        <div className="md:w-44">
          <label htmlFor="user-role" className="label">
            Rôle
          </label>
          <select id="user-role" name="role" defaultValue={filters.role ?? ""} className="input">
            <option value="">Tous les rôles</option>
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <div className="md:w-60">
          <label htmlFor="user-cohort" className="label">
            Promo
          </label>
          <select id="user-cohort" name="cohort" defaultValue={filters.cohort ?? ""} className="input">
            <option value="">Toutes les promos</option>
            <option value="none">Sans promo</option>
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.academicYear}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="btn btn-primary">
            Filtrer
          </button>
          {filtered && (
            <Link href="/admin/users" className="btn">
              Réinitialiser
            </Link>
          )}
        </div>
      </form>

      <p className="text-sm text-muted" aria-live="polite">
        {total} utilisateur{total > 1 ? "s" : ""}
        {filters.q ? ` pour « ${filters.q} »` : ""}
        {filters.role ? ` · ${ROLE_LABELS[filters.role]}` : ""}
        {filters.cohort === "none" ? " · sans promo" : selectedCohort ? ` · ${selectedCohort.name}` : ""}
        {pages > 1 ? ` · page ${Math.min(filters.page, pages)} sur ${pages}` : ""}
      </p>

      {users.length > 0 && (
        <section aria-labelledby="bulk-title" className="card flex flex-col gap-3">
          <h2 id="bulk-title" className="text-base font-semibold">
            Ajouter à une promo
          </h2>
          {cohorts.length === 0 ? (
            <p className="text-sm text-muted">
              Aucune promo pour l&apos;instant.{" "}
              <Link href="/admin/cohorts" className="inline-flex min-h-11 items-center text-accent underline">
                Créer une promo
              </Link>
            </p>
          ) : (
            <>
              <p className="text-sm text-muted">Cochez des utilisateurs dans la liste, choisissez la promo puis validez.</p>
              <ActionForm id={BULK_FORM_ID} action={addUsersToCohort} resetOnSuccess className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
                <div className="min-w-0 sm:flex-1">
                  <label htmlFor="bulk-cohort-id" className="label">
                    Promo
                  </label>
                  <select id="bulk-cohort-id" name="cohortId" required defaultValue="" className="input">
                    <option value="" disabled>
                      Choisir une promo…
                    </option>
                    {cohorts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} · {c.academicYear}
                      </option>
                    ))}
                  </select>
                </div>
                <SubmitButton pendingLabel="Ajout…">Ajouter la sélection</SubmitButton>
              </ActionForm>
              <SelectAll formId={BULK_FORM_ID} name="userIds" />
            </>
          )}
        </section>
      )}

      {users.length === 0 ? (
        <div className="card flex flex-col items-start gap-2">
          <p className="text-muted">
            {filters.page > 1 && total > 0
              ? "Cette page n'existe pas."
              : filtered
                ? "Aucun utilisateur ne correspond à ces filtres."
                : "Aucun utilisateur pour l'instant."}
          </p>
          {(filtered || filters.page > 1) && (
            <Link href="/admin/users" className="btn">
              Voir tous les utilisateurs
            </Link>
          )}
        </div>
      ) : (
        <ul className="flex flex-col gap-3 md:gap-0 md:divide-y md:divide-line md:rounded-md md:border md:border-line md:bg-surface">
          {users.map((u) => (
            <li
              key={u.id}
              className={`card flex flex-col gap-3 md:grid md:items-center md:gap-4 md:rounded-none md:border-0 ${
                bulk ? "md:grid-cols-[2.75rem_minmax(0,1fr)_8rem_15rem]" : "md:grid-cols-[minmax(0,1fr)_8rem_15rem]"
              }`}
            >
              {bulk && (
                <label className="inline-flex min-h-11 min-w-11 cursor-pointer items-center gap-2 md:justify-center">
                  <input type="checkbox" name="userIds" value={u.id} form={BULK_FORM_ID} className="size-5" />
                  <span className="text-sm md:sr-only">Sélectionner {u.name}</span>
                </label>
              )}
              <div className="flex min-w-0 flex-col gap-1">
                <span className="font-medium break-words">
                  {u.name}
                  {u.id === user.id && <span className="badge ml-2">vous</span>}
                </span>
                <span className="text-sm break-all text-muted">
                  <span className="sr-only">E-mail : </span>
                  {u.email}
                </span>
                {u.cohorts.length > 0 && (
                  <ul aria-label="Promos" className="flex flex-wrap gap-1">
                    {u.cohorts.map(({ cohort }) => (
                      <li key={cohort.id} className="badge badge-accent">
                        {cohort.name} · {cohort.academicYear}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <span className="text-sm text-muted">
                <span className="md:sr-only">Inscrit le </span>
                <time dateTime={u.createdAt.toISOString()}>{formatDate(u.createdAt)}</time>
              </span>
              <RoleForm action={changeRole.bind(null, u.id)} userName={u.name} currentRole={u.role} roles={ROLES} locked={u.id === user.id} />
            </li>
          ))}
        </ul>
      )}

      {pages > 1 && (
        <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-2">
          {filters.page > 1 ? (
            <Link href={usersHref({ ...filters, page: Math.min(filters.page - 1, pages) })} className="btn" rel="prev">
              ← Page précédente
            </Link>
          ) : (
            <span />
          )}
          <span className="font-mono text-sm text-muted">
            {Math.min(filters.page, pages)} / {pages}
          </span>
          {filters.page < pages ? (
            <Link href={usersHref({ ...filters, page: filters.page + 1 })} className="btn" rel="next">
              Page suivante →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
