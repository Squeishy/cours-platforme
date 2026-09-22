import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { cx } from "@/components/ui/cx";
import type { ResolvedFavorite } from "@/lib/favorites";

/** Logotype texte : Bricolage + étiquette mono du département */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cx("flex items-center gap-2", className)}>
      <span className="font-display text-base leading-none font-semibold tracking-tight whitespace-nowrap text-ink lg:text-lg">Cours &amp; SAÉ</span>
      <span className="rounded-sm border border-line-strong/50 px-1 py-px font-mono text-xs leading-none text-muted">MMI</span>
    </span>
  );
}

/** Cloche : lien vers /notifications, compteur visuel + libellé complet pour les lecteurs d'écran */
export function NotificationBell({ count, className }: { count: number; className?: string }) {
  const label =
    count === 0 ? "Notifications, aucune non lue" : `Notifications, ${count} non lue${count > 1 ? "s" : ""}`;
  return (
    <Link
      href="/notifications"
      aria-label={label}
      title="Notifications"
      className={cx("relative inline-flex size-11 shrink-0 items-center justify-center rounded-md text-ink transition-colors", className)}
    >
      <Icon name="bell" />
      {count > 0 && (
        <span
          aria-hidden="true"
          className="absolute top-1 right-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-surface bg-accent px-1 font-mono text-xs leading-none font-medium text-accent-ink tabular-nums"
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}

const KIND_TAG: Record<ResolvedFavorite["kind"], string> = { COURSE: "Cours", PAGE: "Page", SAE: "SAÉ" };

/** Favoris (étoile « Favori » sur un cours, une page ou une SAÉ) */
export function FavoritesNav({ favorites, id, max = 8 }: { favorites: ResolvedFavorite[]; id: string; max?: number }) {
  const shown = favorites.slice(0, max);
  const rest = favorites.length - shown.length;
  return (
    <nav aria-labelledby={id} className="flex flex-col gap-1">
      <p id={id} className="eyebrow px-2.5">
        Favoris
      </p>
      {shown.length === 0 ? (
        <p className="px-2.5 text-sm text-muted">L&apos;étoile « Favori » d&apos;un cours, d&apos;une page ou d&apos;une SAÉ l&apos;épingle ici.</p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {shown.map((f) => (
            <li key={f.id}>
              <Link
                href={f.href}
                title={f.context ? `${f.label} — ${f.context}` : f.label}
                className="flex min-h-11 items-center gap-2 rounded-md px-2.5 text-sm text-ink transition-colors hover:bg-line/60 pointer-fine:min-h-9"
              >
                <Icon name="star" size={14} className="shrink-0 text-muted" />
                <span className="min-w-0 flex-1 truncate">{f.label}</span>
                <span className="shrink-0 font-mono text-xs text-muted">{KIND_TAG[f.kind]}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {rest > 0 && (
        <Link href="/#favoris" className="flex min-h-11 items-center px-2.5 text-sm text-muted hover:text-ink hover:underline pointer-fine:min-h-9">
          + {rest} autre{rest > 1 ? "s" : ""}
        </Link>
      )}
    </nav>
  );
}

/** Pied de contenu : mention d'accessibilité obligatoire (RGAA) sur chaque page */
export function ContentFooter({ className }: { className?: string }) {
  return (
    <footer
      className={cx(
        "mt-16 flex flex-wrap items-center gap-x-5 border-t border-line pt-2 text-sm text-muted",
        className,
      )}
    >
      <Link href="/accessibilite" className="-mx-2 inline-flex min-h-11 items-center px-2 hover:text-ink hover:underline">
        Accessibilité : non conforme
      </Link>
      <Link href="/aide" className="-mx-2 inline-flex min-h-11 items-center px-2 hover:text-ink hover:underline">
        Aide
      </Link>
      <span className="font-mono text-xs">BUT MMI</span>
    </footer>
  );
}
