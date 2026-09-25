# Cours & SAÉ — plateforme du département BUT MMI

Diffuser les **cours** et les **sujets de SAÉ** dans un éditeur par blocs « à la Notion » (Markdown, intégrations
Figma / YouTube / CodePen…), suivre les **groupes** et leurs **URL de dépôt** (aucun fichier stocké), faire
**s'auto-positionner** les étudiants sur chaque jalon au regard des **apprentissages critiques du référentiel MMI**,
comparer avec le **positionnement enseignant**, et construire le **portfolio de compétences**.

> La recherche qui a guidé les fonctionnalités (benchmark Moodle, Canvas, BookStack, Karuta… + référentiel et
> quotidien MMI) est dans [`docs/research/SYNTHESE.md`](docs/research/SYNTHESE.md).

## Fonctionnalités

**Étudiant·e**
- **À faire** : tout ce qui est à rendre, trié (en retard / cette semaine / plus tard), avec l'état de son
  auto-évaluation, de ses dépôts et de sa soutenance ; **flux ICS** pour son agenda (Google, Outlook, Apple).
- **Auto-évaluation** par critère (niveau 1–4 + justification + réflexion), brouillon puis soumission ;
  **retour enseignant** comparé à son propre positionnement.
- **Espace de groupe** : page de travail partagée, URL de dépôt **vérifiées** (le lien Drive/Figma/GitHub est-il
  vraiment accessible ?), réservation d'un **créneau de soutenance**, proposition à la **vitrine**.
- **Évaluation de la contribution** des coéquipiers (anonyme pour l'évalué).
- **Mes compétences** : radar des 5 compétences MMI et détail par AC. **Portfolio** : traces par AC, traces SAÉ
  automatiques, lien public partageable, impression.
- Questions **anonymes** sur les pages de cours, FAQ, recherche plein texte, favoris, notifications.

**Enseignant·e**
- Cours en arbre de pages, **historique des versions** et restauration, lien public, duplication, annonces.
- SAÉ **depuis un modèle du Programme national**, critères reliés au **référentiel**, promo liée,
  **groupes automatiques** ou par liste d'e-mails, **duplication** d'une année sur l'autre (dates décalées),
  annonces, **créneaux de soutenance** en lot, **export CSV** du suivi (Excel FR).
- **File de correction** (raccourcis j/k), positionnement par critère, **banque de commentaires**, écarts
  auto/enseignant signalés, publication des retours (un par un ou en lot), matrice de contribution des groupes.
- Page **À faire** enseignant : à corriger, liens à problème, vitrine à valider, questions sans réponse.

**Administration** : utilisateurs et rôles, **promos**, **référentiel** (AC locaux possibles), annonces globales.

**Accessibilité / RGPD** : mobile d'abord (320 px), mode sombre, navigation clavier, déclaration RGAA
(`/accessibilite`), export de ses données (`/me/settings`).

## Stack

Next.js 16 (App Router, Server Actions) · React 19 · TypeScript · Tailwind CSS 4 · Prisma 7 + MariaDB 11 ·
Better Auth (e-mail + mot de passe ; **CAS/OIDC préparé**, voir [`docs/AUTH-EXTERNE.md`](docs/AUTH-EXTERNE.md)) ·
BlockNote 0.55 · Docker (image standalone) · Dokploy.

## Démarrer en local

```bash
cp .env.example .env          # puis générer BETTER_AUTH_SECRET (openssl rand -base64 32)
npm install
docker compose up -d db       # MariaDB sur localhost:3307
npm run db:deploy             # applique les migrations
npm run db:seed               # référentiel MMI officiel + données de démo (synthétiques)
npm run dev                   # http://localhost:3000
```

Comptes de démo (mot de passe `demo-password-2026`) : `admin@demo.fr`, `prof@demo.fr`, `prof2@demo.fr`,
`lea@demo.fr`, `hugo@demo.fr`, `ines@demo.fr`, `nathan@demo.fr`. **Toutes les données de démo sont fictives.**

> Nouvelle migration en dev : `npm run db:migrate` (interactif). Dans un terminal non interactif, générer le SQL
> avec `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` puis
> `npm run db:deploy`.

## Documentation

| Fichier | Contenu |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Modules partagés, conventions, règles de sécurité, routes |
| [`docs/DESIGN.md`](docs/DESIGN.md) | Direction visuelle, tokens, composants (`src/components/ui`) |
| [`docs/research/SYNTHESE.md`](docs/research/SYNTHESE.md) | Recherche utilisateurs et benchmark |
| [`docs/AUTH-EXTERNE.md`](docs/AUTH-EXTERNE.md) | Brancher le CAS de l'université (plus tard) |

Tout le thème est dans `src/app/globals.css` (tokens) ; les règles d'accès dans `src/lib/permissions.ts` (testées).

## Scripts

| | |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run typecheck` / `lint` / `test` | Qualité (Vitest) |
| `npm run db:deploy` / `db:migrate` / `db:seed` | Base de données |

## Variables d'environnement

Voir [`.env.example`](.env.example) : `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (**URL publique** :
elle sert aussi aux liens ICS et de partage), `SIGNUP_ALLOWED_DOMAINS`, `LINK_CHECK_ALLOW_HOSTS`,
`PEERTUBE_HOSTS` (instances Esup-Pod), et les variables CAS/OIDC commentées.

## Déploiement (Dokploy)

1. Application **Docker Compose** pointant sur ce dépôt (`docker-compose.yml`).
2. Variables : `MARIADB_ROOT_PASSWORD`, `MARIADB_PASSWORD`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, et les optionnelles.
3. Domaine (onglet *Domains*) : service **`app`**, port **3000**. L'app ne publie aucun port sur l'hôte (le 3000
   y est pris par Dokploy) : c'est Traefik qui route le domaine vers le conteneur.
4. Déployer : `db` → `migrate` (migrations **et référentiel MMI officiel**, puis arrêt) → `app` (healthcheck `/api/health`).
   Le référentiel est une migration de données (`prisma/migrations/*_referentiel_mmi`, générée par
   `scripts/build-referentiel-migration.ts`) : aucune donnée de démo n'est chargée en production.
5. Premier admin : s'inscrire, puis
   `docker compose exec db mariadb -u cours -p cours -e "UPDATE user SET role='ADMIN' WHERE email='…'"`.

## Sécurité

- Règles d'accès centralisées et testées (`src/lib/permissions.ts`), vérifiées côté serveur dans chaque page et
  chaque Server Action ; validation zod de toutes les entrées ; requêtes SQL paramétrées uniquement.
- Vérificateur de liens anti-SSRF (IP privées/IPv6/NAT64 bloquées au moment de la connexion, ports limités,
  redirections revalidées) ; 50 liens max par groupe, 10 ajouts/min par personne.
- En-têtes : CSP (iframes limitées aux intégrations autorisées), `X-Frame-Options`, `nosniff`, `Referrer-Policy`.
  Rate-limit sur la connexion et l'inscription. Export CSV protégé contre l'injection de formules.
- Contraintes en base : un étudiant = un groupe par SAÉ ; un créneau de soutenance par groupe.
- **Limite connue — adresses e-mail non vérifiées** : sans serveur d'e-mail, Better Auth ne peut pas vérifier les
  adresses. Quelqu'un pourrait s'inscrire avec l'adresse d'un autre étudiant avant lui et être ajouté à sa place
  dans une promo ou un groupe (ajout par e-mail). En attendant le CAS (qui règle le problème : l'identité vient de
  l'université) : restreindre `SIGNUP_ALLOWED_DOMAINS`, ou configurer un SMTP et activer
  `emailAndPassword.requireEmailVerification` dans `src/lib/auth.ts`.
- Les pages refusées affichent « Accès refusé » mais répondent en HTTP 200 (rendu en streaming à cause de
  `src/app/loading.tsx`) ; le contenu protégé n'est jamais envoyé.

## Pistes suivantes

Brancher le CAS (voir doc) · import BookStack via son API · import ICS des emplois du temps · résumé par e-mail
(SMTP) · édition temps réel (Yjs + Hocuspocus) · export vers ScoDoc · contrôles automatiques des livrables web.
