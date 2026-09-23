// Point d'extension de l'authentification externe (CAS / OIDC).
// AUJOURD'HUI : seul "credentials" (e-mail + mot de passe) est actif.
// PLUS TARD : voir docs/AUTH-EXTERNE.md — il suffira d'ajouter "cas" ou "oidc" à AUTH_PROVIDERS
// et de compléter externalAuthPlugins(). La connexion locale reste toujours disponible (secours admin).
import type { BetterAuthPlugin } from "better-auth";

export const KNOWN_PROVIDERS = ["credentials", "cas", "oidc"] as const;
export type AuthProviderId = (typeof KNOWN_PROVIDERS)[number];

export function parseAuthProviders(raw = process.env.AUTH_PROVIDERS ?? "credentials"): AuthProviderId[] {
  const ids = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const unknown = ids.filter((i) => !(KNOWN_PROVIDERS as readonly string[]).includes(i));
  if (unknown.length) throw new Error(`AUTH_PROVIDERS inconnu(s) : ${unknown.join(", ")}`);
  const list = ids as AuthProviderId[];
  return list.includes("credentials") ? list : ["credentials", ...list];
}

export const enabledProviders = parseAuthProviders();

/** Fournisseurs externes dont l'e-mail est considéré fiable pour lier un compte existant */
export const trustedProviders: string[] = enabledProviders.filter((p) => p !== "credentials");

/** Libellés des boutons de connexion (page /login) */
export const PROVIDER_BUTTONS: Record<Exclude<AuthProviderId, "credentials">, string> = {
  cas: "Se connecter avec l'ENT (CAS)",
  oidc: "Se connecter avec le compte de l'université",
};

/**
 * Plugins Better Auth des fournisseurs externes.
 * PLUS TARD :
 *  - "oidc" (recommandé, y compris CAS exposant /cas/oidc) :
 *      genericOAuth({ config: [{ providerId: process.env.OIDC_PROVIDER_ID!, discoveryUrl: process.env.OIDC_DISCOVERY_URL!,
 *        clientId: process.env.OIDC_CLIENT_ID!, clientSecret: process.env.OIDC_CLIENT_SECRET!, scopes: ["openid","email","profile"], pkce: true }] })
 *  - "cas" (protocole CAS 3.0) : plugin maison, squelette dans docs/AUTH-EXTERNE.md
 *  Rôle : mapAffiliationToRole() (src/lib/auth-roles.ts) branché via user.validateUserInfo + databaseHooks.
 */
export function externalAuthPlugins(): BetterAuthPlugin[] {
  return [];
}
