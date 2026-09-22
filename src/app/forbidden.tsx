import Link from "next/link";

export default function Forbidden() {
  return (
    <div className="mx-auto max-w-xl py-16">
      <h1 className="text-2xl font-semibold">Accès refusé</h1>
      <p className="mt-2 text-muted">Vous n&apos;avez pas les droits pour accéder à cette ressource.</p>
      <Link href="/" className="mt-6 inline-block underline">
        Retour à l&apos;accueil
      </Link>
    </div>
  );
}
