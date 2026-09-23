import Link from "next/link";
import { Wordmark } from "@/components/app-shell/parts";

/** En-tête des pages publiques (visiteur non connecté) : pas de barre latérale */
export function SiteHeader() {
  return (
    <header className="shell-topbar border-b border-line bg-surface">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-2 md:px-4">
        <Link href="/" className="mr-auto flex min-h-11 min-w-0 items-center rounded-md px-2">
          <Wordmark />
          <span className="sr-only"> — accueil</span>
        </Link>
        <Link href="/login" className="btn btn-ghost">
          Se connecter
        </Link>
        <Link href="/register" className="btn btn-primary hidden sm:inline-flex">
          Créer un compte
        </Link>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="public-main mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-5 border-t border-line py-2 text-sm text-muted">
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
