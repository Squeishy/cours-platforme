import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PROVIDER_BUTTONS, enabledProviders } from "@/lib/auth-providers";
import { getCurrentUser } from "@/lib/session";
import { ExternalProviders, type ExternalProvider } from "./external-providers";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Connexion" };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");

  // Uniquement les fournisseurs activés (AUTH_PROVIDERS) ; aucun bouton « bientôt disponible »
  const external: ExternalProvider[] = enabledProviders
    .filter((p): p is ExternalProvider["id"] => p !== "credentials")
    .map((id) => ({
      id,
      label: PROVIDER_BUTTONS[id],
      providerId: id === "oidc" ? (process.env.OIDC_PROVIDER_ID ?? "oidc") : "cas",
    }));

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,28rem)_minmax(0,20rem)] lg:gap-16">
      <div className="flex min-w-0 flex-col gap-6">
        <div className="flex flex-col gap-2">
          <p className="eyebrow">BUT MMI · Espace de travail</p>
          <h1 className="text-2xl font-semibold">Connexion</h1>
          <p className="text-muted">Retrouvez vos cours, vos SAÉ et vos auto-évaluations.</p>
        </div>
        {external.length > 0 && (
          <>
            <ExternalProviders providers={external} />
            <p className="flex items-center gap-3 font-mono text-xs text-muted uppercase before:h-px before:flex-1 before:bg-line after:h-px after:flex-1 after:bg-line">
              ou avec votre e-mail
            </p>
          </>
        )}
        <LoginForm />
      </div>

      <aside aria-labelledby="premiere-connexion" className="flex flex-col gap-3 border-line lg:mt-24 lg:border-l lg:pl-8">
        <h2 id="premiere-connexion" className="text-lg font-semibold">
          Première connexion ?
        </h2>
        <p className="text-muted">
          Créez votre compte avec votre adresse universitaire. Il est ouvert avec le rôle étudiant ; un administrateur
          attribue le rôle enseignant.
        </p>
        <p className="text-muted">Vos enseignants vous ajoutent ensuite aux groupes de SAÉ : vos jalons apparaissent sur l&apos;accueil.</p>
        <p className="flex flex-wrap gap-x-4">
          <Link href="/register" className="link inline-flex min-h-11 items-center">
            Créer un compte
          </Link>
          <Link href="/aide" className="link inline-flex min-h-11 items-center">
            Aide
          </Link>
        </p>
      </aside>
    </div>
  );
}
