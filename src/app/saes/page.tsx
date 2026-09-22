import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { canCreateSae, canManageSae, isAdmin } from "@/lib/permissions";
import { formatDateRange } from "./_lib/dates";

export const metadata: Metadata = { title: "SAÉ" };

export default async function SaesPage() {
  const user = await requireUser();

  // Même règle que canViewSae : publiées, ou gérées (responsable / co-enseignant).
  // Un étudiant déjà placé dans un groupe ne voit la SAÉ qu'une fois publiée.
  const saes = await db.sae.findMany({
    where: isAdmin(user)
      ? {}
      : {
          OR: [{ published: true }, { ownerId: user.id }, { teachers: { some: { id: user.id } } }],
        },
    orderBy: [{ semester: "asc" }, { code: "asc" }, { title: "asc" }],
    select: {
      id: true,
      code: true,
      title: true,
      semester: true,
      startsAt: true,
      endsAt: true,
      published: true,
      ownerId: true,
      teachers: { select: { id: true } },
      groups: {
        where: { members: { some: { userId: user.id } } },
        select: { name: true },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">SAÉ</h1>
        {canCreateSae(user) && (
          <Link href="/saes/new" className="btn btn-primary">
            Nouvelle SAÉ
          </Link>
        )}
      </div>

      {saes.length === 0 ? (
        <div className="card text-muted">
          <p>Aucune SAÉ pour l&apos;instant.</p>
          {canCreateSae(user) && (
            <p className="mt-1">
              <Link href="/saes/new" className="underline">
                Créer la première SAÉ
              </Link>
            </p>
          )}
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {saes.map((sae) => {
            const range = formatDateRange(sae.startsAt, sae.endsAt);
            const myGroup = sae.groups[0];
            return (
              <li key={sae.id}>
                <Link
                  href={`/saes/${sae.id}`}
                  className="card block h-full min-h-11 transition-colors hover:border-accent"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {sae.code && <span className="text-sm font-semibold text-accent">{sae.code}</span>}
                    {sae.semester && <span className="badge">Semestre {sae.semester}</span>}
                    {!sae.published && <span className="badge">Brouillon</span>}
                    {canManageSae(user, sae) && <span className="badge">Gérée</span>}
                  </div>
                  <h2 className="mt-2 font-semibold break-words">{sae.title}</h2>
                  {range && <p className="mt-1 text-sm text-muted">{range}</p>}
                  {myGroup && <p className="mt-1 text-sm">Mon groupe : {myGroup.name}</p>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
