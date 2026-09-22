import type { Metadata } from "next";
import Link from "next/link";
import { StatusView } from "@/components/app-shell/status-view";

export const metadata: Metadata = { title: "Accès refusé" };

export default function Forbidden() {
  return (
    <StatusView
      code="Erreur 403"
      title="Accès refusé"
      actions={
        <>
          <Link href="/" className="btn btn-primary">
            Retour à l&apos;accueil
          </Link>
          <Link href="/aide" className="btn">
            Consulter l&apos;aide
          </Link>
        </>
      }
    >
      <p>Votre compte n&apos;a pas les droits nécessaires pour cette page.</p>
      <p>
        Un cours ou une SAÉ non publiés ne sont visibles que par leur équipe pédagogique ; une auto-évaluation en
        brouillon, seulement par son auteur. Si vous pensez que c&apos;est une erreur, contactez l&apos;enseignant
        responsable.
      </p>
    </StatusView>
  );
}
