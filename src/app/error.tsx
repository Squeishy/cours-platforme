"use client";

import Link from "next/link";
import { useEffect } from "react";
import { StatusView } from "@/components/app-shell/status-view";

// Next 16.3 : `retry` (stable) recharge les données du segment puis le re-rend.
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatusView
      code="Erreur"
      title="Le chargement de cette page a échoué."
      actions={
        <>
          <button type="button" className="btn btn-primary" onClick={() => retry()}>
            Réessayer
          </button>
          <Link href="/" className="btn">
            Retour à l&apos;accueil
          </Link>
        </>
      }
    >
      <p>
        Réessayez dans un instant : ce que vous aviez déjà enregistré n&apos;est pas perdu. Si le problème persiste,
        transmettez le code ci-dessous à l&apos;administrateur de la plateforme.
      </p>
      {error.digest && (
        <p>
          Code : <code className="rounded-sm bg-sunken px-1.5 py-0.5 font-mono text-sm text-ink">{error.digest}</code>
        </p>
      )}
    </StatusView>
  );
}
