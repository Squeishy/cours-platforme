import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Inscription" };

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect("/");

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,28rem)_minmax(0,20rem)] lg:gap-16">
      <div className="flex min-w-0 flex-col gap-6">
        <div className="flex flex-col gap-2">
          <p className="eyebrow">BUT MMI · Espace de travail</p>
          <h1 className="text-2xl font-semibold">Créer un compte</h1>
          <p className="text-muted">
            Les comptes sont créés avec le rôle étudiant ; un administrateur attribue le rôle enseignant.
          </p>
        </div>
        <RegisterForm />
      </div>

      <aside aria-labelledby="conseils-compte" className="flex flex-col gap-3 border-line lg:mt-24 lg:border-l lg:pl-8">
        <h2 id="conseils-compte" className="text-lg font-semibold">
          Avant de commencer
        </h2>
        <ul className="flex list-disc flex-col gap-2 pl-5 text-muted marker:text-line-strong">
          <li>Utilisez l&apos;adresse e-mail que vos enseignants connaissent : c&apos;est elle qui sert à vous ajouter aux groupes.</li>
          <li>Un mot de passe long (une phrase de quatre mots, par exemple) est plus sûr qu&apos;un mot court compliqué.</li>
          <li>Votre nom complet apparaît dans vos groupes de SAÉ et sur vos auto-évaluations.</li>
        </ul>
        <Link href="/aide" className="link inline-flex min-h-11 items-center self-start">
          Comment fonctionne la plateforme
        </Link>
      </aside>
    </div>
  );
}
