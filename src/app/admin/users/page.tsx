import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { assertAllowed, requireUser } from "@/lib/session";
import { ROLE_LABELS, isAdmin, type Role } from "@/lib/permissions";
import { changeRole } from "./actions";
import { RoleForm } from "./role-form";

export const metadata: Metadata = { title: "Utilisateurs" };

const PAGE_SIZE = 200;
const ROLES = (Object.keys(ROLE_LABELS) as Role[]).map((value) => ({ value, label: ROLE_LABELS[value] }));
const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "Europe/Paris" });

export default async function AdminUsersPage({ searchParams }: PageProps<"/admin/users">) {
  const user = await requireUser();
  assertAllowed(isAdmin(user));

  const { q } = await searchParams;
  const query = (typeof q === "string" ? q : "").trim().slice(0, 100);

  const users = await db.user.findMany({
    where: query ? { OR: [{ name: { contains: query } }, { email: { contains: query } }] } : undefined,
    select: { id: true, name: true, email: true, role: true, createdAt: true },
    orderBy: [{ createdAt: "desc" }],
    take: PAGE_SIZE,
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Utilisateurs</h1>

      <form method="get" role="search" className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="user-search" className="label">
            Rechercher par nom ou e-mail
          </label>
          <input id="user-search" name="q" type="search" defaultValue={query} maxLength={100} className="input" />
        </div>
        <div className="flex gap-2">
          <button type="submit" className="btn btn-primary">
            Rechercher
          </button>
          {query && (
            <Link href="/admin/users" className="btn">
              Effacer
            </Link>
          )}
        </div>
      </form>

      <p className="text-sm text-muted" aria-live="polite">
        {users.length} utilisateur{users.length > 1 ? "s" : ""}
        {query ? ` pour « ${query} »` : ""}
        {users.length === PAGE_SIZE ? ` (${PAGE_SIZE} premiers — affinez la recherche)` : ""}
      </p>

      {users.length === 0 ? (
        <p className="card text-muted">
          {query ? "Aucun utilisateur ne correspond à cette recherche." : "Aucun utilisateur pour l'instant."}
        </p>
      ) : (
        <div className="flex flex-col">
          <div
            aria-hidden="true"
            className="hidden border-b border-line px-4 pb-2 text-sm font-semibold text-muted md:grid md:grid-cols-[1fr_1.3fr_8rem_16rem] md:gap-4"
          >
            <span>Nom</span>
            <span>E-mail</span>
            <span>Inscription</span>
            <span>Rôle</span>
          </div>
          <ul className="flex flex-col gap-3 md:gap-0 md:divide-y md:divide-line">
            {users.map((u) => (
              <li
                key={u.id}
                className="card flex flex-col gap-2 md:grid md:grid-cols-[1fr_1.3fr_8rem_16rem] md:items-center md:gap-4 md:rounded-none md:border-0 md:bg-transparent"
              >
                <span className="min-w-0 font-medium break-words">
                  {u.name}
                  {u.id === user.id && <span className="badge ml-2">vous</span>}
                </span>
                <span className="min-w-0 text-sm break-all md:text-base">
                  <span className="sr-only">E-mail : </span>
                  {u.email}
                </span>
                <span className="text-sm text-muted">
                  <span className="md:sr-only">Inscrit le </span>
                  <time dateTime={u.createdAt.toISOString()}>{dateFormat.format(u.createdAt)}</time>
                </span>
                <RoleForm
                  action={changeRole.bind(null, u.id)}
                  userName={u.name}
                  currentRole={u.role}
                  roles={ROLES}
                  locked={u.id === user.id}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
