# Authentification externe (CAS / OIDC / SAML) — préparée, **pas encore active**

Aujourd'hui : connexion par e-mail + mot de passe (Better Auth 1.7). Le code est prêt à accueillir le CAS de
l'université ou un autre fournisseur d'identité **sans migration de base** (`Account.providerId` gère déjà
plusieurs fournisseurs par utilisateur).

## Ce qui est déjà en place

| Élément | Fichier |
|---|---|
| Choix des fournisseurs par variable d'env `AUTH_PROVIDERS` (`credentials`, `cas`, `oidc`) — la connexion locale reste toujours active (secours admin) | `src/lib/auth-providers.ts` (+ tests) |
| Liaison de comptes : un compte IdP est rattaché au compte local de même e-mail (`trustedProviders`) | `src/lib/auth.ts` |
| Rôle depuis l'annuaire (SUPANN `eduPersonAffiliation`) : `faculty`/`teacher` → TEACHER, `student` → STUDENT, sinon pas d'accès automatique, **jamais ADMIN** | `src/lib/auth-roles.ts` (+ tests) |
| Boutons de connexion affichés seulement si le fournisseur est activé | `src/app/login` |

## Option recommandée : CAS en mode OIDC (aucun code à écrire)

Apereo CAS (utilisé par la plupart des ENT via ESUP) sait exposer OpenID Connect (`cas-server-support-oidc`,
émetteur `https://cas.univ.fr/cas/oidc`). À demander à la DSI :

1. Enregistrer un service OIDC (`OidcRegisteredService`) avec l'URL de retour
   `${BETTER_AUTH_URL}/api/auth/callback/<OIDC_PROVIDER_ID>` ;
2. Libérer les attributs : `uid`, `mail` (**obligatoire**), `displayName`, `eduPersonAffiliation`, `supannEtuId` ;
3. Fournir `client_id` / `client_secret`.

Puis, dans `externalAuthPlugins()` :

```ts
import { genericOAuth } from "better-auth/plugins/generic-oauth";
genericOAuth({ config: [{
  providerId: process.env.OIDC_PROVIDER_ID!, discoveryUrl: process.env.OIDC_DISCOVERY_URL!,
  clientId: process.env.OIDC_CLIENT_ID!, clientSecret: process.env.OIDC_CLIENT_SECRET!,
  scopes: ["openid", "email", "profile"], pkce: true,
}] })
```

et `AUTH_PROVIDERS="credentials,oidc"`. Côté client : `authClient.signIn.social({ provider: OIDC_PROVIDER_ID })`.

## Alternative : protocole CAS 3.0 (plugin maison)

Si le CAS n'expose pas OIDC : `/login?service=…` → `?ticket=ST-…` → validation
`/p3/serviceValidate?service=…&ticket=…&format=JSON`
([spécification](https://apereo.github.io/cas/development/protocol/CAS-Protocol-Specification.html)).
Squelette d'un plugin Better Auth (2 endpoints `/cas/sign-in` et `/cas/callback`) :
- `sign-in` : état signé lié à un cookie (anti login-CSRF, `generateGenericState`), redirection vers le CAS ;
- `callback` : `parseGenericState`, validation du ticket (timeout 5 s), puis `handleOAuthUserInfo(ctx, { userInfo, account: { providerId: "cas", accountId: user }, source: { method: "oauth", oauth: { providerId: "cas", profile: attributes } } })`
  et `setSessionCookie` — exactement ce que fait le callback OAuth natif ;
- après déconnexion locale, rediriger vers `${CAS_BASE_URL}/logout?service=…` (postes partagés en salle de TP) ;
- prévoir un parseur XML si le CAS est ancien (pas de `format=JSON`).
Hors périmètre : Single Logout (nécessiterait une table ticket → session).

## Attribution du rôle (à brancher le jour J)

`role` est déclaré `input: false` : Better Auth l'ignore dans `mapProfileToUser`. Il faut donc le poser via
`user.validateUserInfo` (reçoit le profil brut) + `databaseHooks.user.create.before` (même objet `ctx`) :

```ts
const pendingRole = new WeakMap<object, "TEACHER" | "STUDENT">();
user: { validateUserInfo: ({ source }, ctx) => {
  const p = source.oauth?.profile ?? source.sso?.profile;
  if (!p || source.action !== "create-user") return;
  const role = mapAffiliationToRole(p.eduPersonAffiliation);
  if (!role) return { error: "affiliation_not_allowed" };
  pendingRole.set(ctx, role);
}},
// databaseHooks.user.create.before : const role = ctx && pendingRole.get(ctx); if (role) return { data: { ...user, role } };
```
À couvrir par un test d'intégration (le partage de `ctx` est un détail d'implémentation de Better Auth).

## Pièges identifiés

1. **Comptes locaux existants** : la liaison automatique exige `emailVerified = true` sur le compte local.
   Avant d'activer l'IdP, marquer vérifiés les comptes des personnels (script admin) ou activer la vérification d'e-mail.
2. **`SIGNUP_ALLOWED_DOMAINS`** s'applique aussi aux comptes créés par l'IdP : y ajouter `etu.univ-…`.
3. **SAML** (Fédération Éducation-Recherche / Renater) : paquet séparé `@better-auth/sso` — seulement si ni CAS ni OIDC.

## Variables d'environnement (commentées dans `.env.example`)

`AUTH_PROVIDERS`, `CAS_BASE_URL`, `OIDC_PROVIDER_ID`, `OIDC_DISCOVERY_URL`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`.

Sources : [generic-oauth](https://www.better-auth.com/docs/plugins/generic-oauth) ·
[sso](https://www.better-auth.com/docs/plugins/sso) ·
[CAS OIDC](https://apereo.github.io/cas/development/authentication/OIDC-Authentication.html) ·
[eduPersonAffiliation (Renater)](https://services.renater.fr/documentation/supann/evolepa)
