"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export type ExternalProvider = { id: "cas" | "oidc"; label: string; providerId: string };

/**
 * Boutons de connexion externe — rendus uniquement si AUTH_PROVIDERS les active
 * (src/lib/auth-providers.ts). Points d'entrée prévus par docs/AUTH-EXTERNE.md :
 *  - oidc : endpoint genericOAuth « /sign-in/oauth2 » (renvoie l'URL du fournisseur) ;
 *  - cas  : plugin maison « /cas/sign-in » (redirection directe).
 * À valider le jour où le plugin correspondant est branché dans externalAuthPlugins().
 */
export function ExternalProviders({ providers }: { providers: ExternalProvider[] }) {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function signInOidc(providerId: string) {
    setPending(providerId);
    setError(null);
    try {
      const { data, error: authError } = await authClient.$fetch<{ url?: string }>("/sign-in/oauth2", {
        method: "POST",
        body: { providerId, callbackURL: "/" },
      });
      if (authError || !data?.url) throw new Error("oauth");
      window.location.assign(data.url);
    } catch {
      setError("Connexion par l'université indisponible pour le moment. Utilisez votre e-mail.");
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {providers.map((p) =>
        p.id === "cas" ? (
          <button
            key={p.id}
            type="button"
            className="btn w-full"
            // Navigation complète (redirection vers le CAS), pas une route de page
            onClick={() => window.location.assign(new URL("/api/auth/cas/sign-in?callbackURL=%2F", window.location.origin).href)}
          >
            {p.label}
          </button>
        ) : (
          <button
            key={p.id}
            type="button"
            className="btn w-full"
            disabled={pending !== null}
            onClick={() => signInOidc(p.providerId)}
          >
            {pending === p.providerId ? "Redirection…" : p.label}
          </button>
        ),
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </div>
  );
}
