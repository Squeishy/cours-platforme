import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { assertAllowed, requireUser } from "@/lib/session";
import { isStaff } from "@/lib/permissions";
import type { Prisma } from "@/generated/prisma/client";

export const metadata: Metadata = { title: "Étudiants", robots: { index: false, follow: false } };

const LIMIT = 50;

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function StudentsPage({ searchParams }: PageProps<"/students">) {
  const user = await requireUser();
  assertAllowed(isStaff(user));

  const sp = await searchParams;
  const q = (one(sp.q) ?? "").trim().slice(0, 100);
  const rawPromo = (one(sp.promo) ?? "").trim();
  const promo = /^[A-Za-z0-9_-]{1,64}$/.test(rawPromo) ? rawPromo : "";

  const filters: Prisma.UserWhereInput[] = [{ role: "STUDENT" }];
  if (q) {
    filters.push({
      OR: [
        { name: { contains: q } },
        { email: { contains: q } },
        { cohorts: { some: { cohort: { name: { contains: q } } } } },
      ],
    });
  }
  if (promo) filters.push({ cohorts: { some: { cohortId: promo } } });
  const where: Prisma.UserWhereInput = { AND: filters };

  const [cohorts, total, students] = await Promise.all([
    db.cohort.findMany({
      orderBy: [{ academicYear: "desc" }, { name: "asc" }],
      take: 100,
      select: { id: true, name: true, academicYear: true },
    }),
    db.user.count({ where }),
    db.user.findMany({
      where,
      orderBy: { name: "asc" },
      take: LIMIT,
      select: {
        id: true,
        name: true,
        email: true,
        cohorts: {
          take: 5,
          select: { cohort: { select: { id: true, name: true, academicYear: true } } },
        },
        _count: { select: { evidences: true, memberships: true } },
      },
    }),
  ]);
  const filtered = !!(q || promo);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="eyebrow font-mono">Suivi · jurys</p>
        <h1 className="text-2xl font-semibold text-balance">Étudiants</h1>
        <p className="max-w-prose text-muted">
          Retrouvez un étudiant pour consulter son radar de compétences, son portfolio, ses groupes de SAÉ et ses
          auto-évaluations.
        </p>
      </header>

      <form method="get" action="/students" role="search" aria-label="Rechercher un étudiant" className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="sm:min-w-64 sm:flex-1">
          <label htmlFor="students-q" className="label">
            Nom, e-mail ou promo
          </label>
          <input
            id="students-q"
            name="q"
            type="search"
            defaultValue={q}
            maxLength={100}
            autoComplete="off"
            className="input"
          />
        </div>
        <div className="sm:w-64">
          <label htmlFor="students-promo" className="label">
            Promo
          </label>
          <select id="students-promo" name="promo" defaultValue={promo} className="input">
            <option value="">Toutes les promos</option>
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.academicYear}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="submit" className="btn btn-primary">
            Rechercher
          </button>
          {filtered && (
            <Link href="/students" className="btn btn-ghost">
              Effacer
            </Link>
          )}
        </div>
      </form>

      <section aria-labelledby="students-results" className="flex flex-col gap-3">
        <h2 id="students-results" className="font-mono text-sm text-muted tabular-nums">
          {total === 0
            ? "Aucun étudiant"
            : total > LIMIT
              ? `${total} étudiants — ${LIMIT} premiers affichés, affinez la recherche`
              : `${total} étudiant${total > 1 ? "s" : ""}`}
        </h2>

        {students.length === 0 ? (
          <p className="card text-muted">
            {filtered
              ? "Aucun étudiant ne correspond à cette recherche."
              : "Aucun compte étudiant pour l'instant."}
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-line rounded-md border border-line bg-surface">
            {students.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/students/${s.id}`}
                  className="flex min-h-11 flex-col gap-1 px-4 py-3 transition-colors hover:bg-sunken sm:flex-row sm:items-center sm:gap-4"
                >
                  <span className="min-w-0 sm:flex-1">
                    <span className="block font-medium break-words">{s.name}</span>
                    <span className="block text-sm break-all text-muted">{s.email}</span>
                  </span>
                  <span className="flex flex-wrap gap-1">
                    {s.cohorts.map((c) => (
                      <span key={c.cohort.id} className="badge">
                        {c.cohort.name}
                      </span>
                    ))}
                  </span>
                  <span className="font-mono text-xs text-muted tabular-nums">
                    {s._count.evidences} trace{s._count.evidences > 1 ? "s" : ""} · {s._count.memberships} groupe
                    {s._count.memberships > 1 ? "s" : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
