import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { canCreateSae, isAdmin } from "@/lib/permissions";
import { EmptyState, PageHeader, StatusBadge, Swatch } from "@/components/ui";

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
    take: 300,
    select: { id: true, code: true, title: true, semester: true, published: true },
  });

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        title="SAÉ"
        actions={
          canCreateSae(user) && (
            <Link href="/saes/new" className="btn btn-primary">
              Nouvelle SAÉ
            </Link>
          )
        }
      />

      {saes.length === 0 ? (
        <EmptyState>Aucune SAÉ.</EmptyState>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {saes.map((sae) => (
            <li key={sae.id}>
              <Link
                href={`/saes/${sae.id}`}
                className="card flex h-full min-h-11 items-start gap-4 transition-colors hover:border-ink"
              >
                <Swatch seed={sae.id} text={sae.code ?? sae.title} />
                <div className="flex min-w-0 flex-col gap-1">
                  {sae.code && <span className="text-sm text-muted">{sae.code}</span>}
                  <h2 className="text-lg break-words">{sae.title}</h2>
                  {(sae.semester || !sae.published) && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
                      {sae.semester && <span>Semestre {sae.semester}</span>}
                      {!sae.published && <StatusBadge tone="warn">Brouillon</StatusBadge>}
                    </div>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
