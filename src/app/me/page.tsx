import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { ROLE_LABELS, isStaff } from "@/lib/permissions";

export const metadata: Metadata = { title: "Mon espace" };

type HubLink = { href: string; title: string; description: string };

export default async function MePage() {
  const user = await requireUser();
  const staff = isStaff(user);

  const [cohorts, profile, evidenceCount, groupCount] = await Promise.all([
    db.cohortMember.findMany({
      where: { userId: user.id },
      take: 20,
      select: { cohort: { select: { id: true, name: true, year: true, parcours: true, academicYear: true } } },
    }),
    db.user.findUnique({ where: { id: user.id }, select: { portfolioToken: true, createdAt: true } }),
    staff ? Promise.resolve(0) : db.portfolioEvidence.count({ where: { userId: user.id } }),
    db.groupMember.count({ where: { userId: user.id } }),
  ]);
  const myCohorts = cohorts
    .map((c) => c.cohort)
    .sort((a, b) => b.academicYear.localeCompare(a.academicYear) || a.name.localeCompare(b.name, "fr"));

  const links: HubLink[] = staff
    ? [
        { href: "/students", title: "Étudiants", description: "Rechercher un étudiant : radar, portfolio, SAÉ et auto-évaluations (jurys, suivi)." },
        { href: "/vitrine/moderation", title: "Modération de la vitrine", description: "Valider les projets proposés par les groupes de vos SAÉ." },
        { href: "/me/comment-bank", title: "Banque de commentaires", description: "Vos formulations réutilisables pour les retours d'évaluation." },
        { href: "/me/settings", title: "Réglages", description: "Notifications, calendrier personnel et préférences." },
        { href: "/vitrine", title: "Vitrine des projets", description: "Les projets étudiants publiés, visibles de tous." },
      ]
    : [
        { href: "/me/competences", title: "Mes compétences", description: "Radar, niveaux par apprentissage critique et écarts avec l'enseignant." },
        {
          href: "/me/portfolio",
          title: "Mon portfolio",
          description: `${evidenceCount} trace${evidenceCount > 1 ? "s" : ""} personnelle${evidenceCount > 1 ? "s" : ""}${profile?.portfolioToken ? " · lien public actif" : " · privé"}.`,
        },
        { href: "/me/settings", title: "Réglages", description: "Notifications, calendrier personnel et préférences." },
        { href: "/vitrine", title: "Vitrine des projets", description: "Les projets étudiants publiés ; proposez le vôtre depuis votre espace de groupe." },
      ];

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-3">
        <p className="eyebrow font-mono">{ROLE_LABELS[user.role]}</p>
        <h1 className="text-2xl font-semibold text-balance break-words">{user.name}</h1>
      </header>

      <section aria-labelledby="profile-title" className="flex flex-col gap-3">
        <h2 id="profile-title" className="text-lg font-semibold">
          Profil
        </h2>
        <dl className="card grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[max-content_minmax(0,1fr)]">
          <dt className="text-muted">Nom</dt>
          <dd className="break-words">{user.name}</dd>
          <dt className="text-muted">E-mail</dt>
          <dd className="break-all">{user.email}</dd>
          <dt className="text-muted">Rôle</dt>
          <dd>{ROLE_LABELS[user.role]}</dd>
          <dt className="text-muted">Promo{myCohorts.length > 1 ? "s" : ""}</dt>
          <dd>
            {myCohorts.length === 0 ? (
              <span className="text-muted">
                {staff ? "—" : "Aucune promo : l'administration vous rattachera à votre groupe de TD."}
              </span>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {myCohorts.map((c) => (
                  <li key={c.id} className="badge text-ink">
                    {c.name} · {c.academicYear}
                    {c.parcours ? ` · ${c.parcours}` : ""}
                  </li>
                ))}
              </ul>
            )}
          </dd>
          {!staff && (
            <>
              <dt className="text-muted">Groupes de SAÉ</dt>
              <dd className="font-mono tabular-nums">{groupCount}</dd>
            </>
          )}
        </dl>
      </section>

      <nav aria-labelledby="hub-title" className="flex flex-col gap-3">
        <h2 id="hub-title" className="text-lg font-semibold">
          Raccourcis
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {links.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className="card flex h-full min-h-11 flex-col gap-1 transition-colors hover:border-accent"
              >
                <span className="font-semibold">{l.title}</span>
                <span className="text-sm text-muted">{l.description}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
