import Link from "next/link";
import { isAdmin, isStaff, type Actor } from "@/lib/permissions";

type Section = "users" | "cohorts" | "announcements";

const LINKS: { key: Section | "referentiel"; href: string; label: string; adminOnly: boolean }[] = [
  { key: "users", href: "/admin/users", label: "Utilisateurs", adminOnly: true },
  { key: "cohorts", href: "/admin/cohorts", label: "Promos", adminOnly: true },
  { key: "announcements", href: "/admin/announcements", label: "Annonces", adminOnly: false },
  { key: "referentiel", href: "/admin/referentiel", label: "Référentiel", adminOnly: true },
];

/** Onglets de l'administration (seules les sections autorisées sont proposées) */
export function AdminNav({ user, current }: { user: Actor; current: Section }) {
  const links = LINKS.filter((l) => (l.adminOnly ? isAdmin(user) : isStaff(user)));
  if (links.length < 2) return null;
  return (
    <nav aria-label="Administration" className="-mx-1 flex gap-1 overflow-x-auto pb-1">
      {links.map((l) => {
        const active = l.key === current;
        return (
          <Link
            key={l.key}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex min-h-11 shrink-0 items-center rounded-md px-3 text-sm font-medium ${
              active ? "bg-accent-soft text-accent" : "text-muted hover:bg-sunken hover:text-ink"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
