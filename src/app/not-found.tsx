import type { Metadata } from "next";
import Link from "next/link";
import { StatusView } from "@/components/app-shell/status-view";

export const metadata: Metadata = { title: "Page introuvable" };

export default function NotFound() {
  return (
    <StatusView
      code="Erreur 404"
      title="Cette page n'existe pas, ou plus."
      actions={
        <>
          <Link href="/" className="btn btn-primary">
            Retour à l&apos;accueil
          </Link>
          <Link href="/search" className="btn">
            Rechercher
          </Link>
          <Link href="/courses" className="btn btn-ghost">
            Tous les cours
          </Link>
        </>
      }
    >
      <p>
        Le lien est peut-être ancien : une page de cours a pu être renommée ou supprimée, une SAÉ archivée ou
        dupliquée pour la nouvelle année.
      </p>
      <p>La recherche retrouve les cours, pages et SAÉ par leur titre ou leur contenu.</p>
    </StatusView>
  );
}
