# Cours & SAÉ

Plateforme pour diffuser des **cours** et des **sujets de SAÉ** dans un éditeur par blocs « à la Notion »
(Markdown à la frappe et au collage), organiser les **groupes** de SAÉ, collecter des **URL de dépôt**
(GitHub, GitLab, Drive… — aucun fichier stocké) et faire **s'auto-positionner** les étudiants sur chaque
point d'étape, avec **commentaires** des enseignants et des pairs.

> Base de travail : le style est volontairement minimal. Tout le thème est dans `src/app/globals.css`.

## Stack

| | |
|---|---|
| Front + back | Next.js 16 (App Router, Server Actions), React 19, TypeScript |
| Base de données | MariaDB 11 via Prisma 7 (adaptateur `@prisma/adapter-mariadb`) |
| Auth | Better Auth (e-mail + mot de passe), rôles `ADMIN` / `TEACHER` / `STUDENT` |
| Éditeur | BlockNote (blocs, `/` pour insérer, Markdown import/export) |
| UI | Tailwind CSS 4 |
| Déploiement | Docker multi-stage (standalone) + docker-compose, compatible Dokploy |

## Démarrer en local

```bash
cp .env.example .env          # puis générer BETTER_AUTH_SECRET
npm install
docker compose up -d db       # MariaDB sur localhost:3307
npm run db:migrate            # applique les migrations
npm run db:seed               # données de démo
npm run dev                   # http://localhost:3000
```

> `prisma migrate dev` a besoin d'une base « shadow ». En local, donner les droits à l'utilisateur :
> `docker compose exec db mariadb -uroot -p -e "GRANT ALL ON *.* TO 'cours'@'%'"`

Comptes de démo (mot de passe `demo-password-2026`) : `admin@demo.fr`, `prof@demo.fr`, `prof2@demo.fr`,
`lea@demo.fr`, `hugo@demo.fr`, `ines@demo.fr`, `nathan@demo.fr`.

## Modèle

- **Cours** → arbre de **pages** (contenu BlockNote JSON + export Markdown). Propriétaire + co-éditeurs.
- **SAÉ** → sujet (éditeur), compétences, dates, cours lié, co-enseignants.
  - **Jalons** (points d'étape / rendus) → **critères** rattachés à des apprentissages critiques (`AC21.01`…).
  - **Groupes** → membres, espace de travail partagé (éditeur), **URL de dépôt** par jalon.
  - **Auto-évaluations** : un étudiant par jalon, niveau 1–4 + justification par critère + réflexion globale.
    Brouillon privé → soumise (visible par le groupe et l'équipe) → **commentaires**. L'enseignant peut rouvrir.
- Règles d'accès : `src/lib/permissions.ts` (testées dans `permissions.test.ts`), appliquées côté serveur
  sur chaque page et chaque Server Action.

Détails et conventions : [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Scripts

| | |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run typecheck` / `lint` / `test` | Qualité |
| `npm run db:migrate` | Nouvelle migration (dev) |
| `npm run db:deploy` | Appliquer les migrations (prod) |
| `npm run db:seed` | Données de démo (refusé en production) |

## Déploiement (Dokploy)

1. Créer une application **Docker Compose** pointant sur ce dépôt (`docker-compose.yml`).
2. Renseigner les variables : `MARIADB_ROOT_PASSWORD`, `MARIADB_PASSWORD`, `BETTER_AUTH_SECRET`,
   `BETTER_AUTH_URL` (URL publique), éventuellement `SIGNUP_ALLOWED_DOMAINS`.
3. Déployer : `db` démarre, `migrate` applique les migrations puis s'arrête, `app` démarre
   (healthcheck sur `/api/health`).
4. Créer le premier admin : s'inscrire, puis
   `docker compose exec db mariadb -u cours -p cours -e "UPDATE user SET role='ADMIN' WHERE email='…'"`.

## Pistes pour la suite

- Édition **temps réel** à plusieurs (BlockNote + Yjs + serveur Hocuspocus) pour l'espace de groupe.
- SSO de l'établissement (CAS / OIDC) via un plugin Better Auth.
- Import des pages BookStack (export Markdown → champ `markdown`, converti à la première ouverture).
- Notifications (nouveau commentaire, jalon proche), export CSV du suivi des auto-évaluations.
- Référentiel de compétences / AC réutilisable entre SAÉ, portfolio étudiant.
