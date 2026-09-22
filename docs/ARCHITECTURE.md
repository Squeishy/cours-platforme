# Architecture — contrat

Stack : Next.js 16 (App Router, Server Components, Server Actions) · React 19 · TypeScript · Tailwind 4 ·
Prisma 7 (`prisma-client`, adaptateur `@prisma/adapter-mariadb`) · MariaDB 11 · Better Auth (e-mail + mot de passe) ·
BlockNote (éditeur par blocs « à la Notion », Markdown à la frappe et au collage).

## Modules partagés (ne pas dupliquer)

| Fichier | Rôle |
|---|---|
| `prisma/schema.prisma` | Modèle de données (source de vérité) |
| `src/lib/db.ts` | `db` — client Prisma (serveur uniquement) |
| `src/generated/prisma/client` | Types Prisma générés (`import type { ... } from "@/generated/prisma/client"`) |
| `src/lib/auth.ts` / `auth-client.ts` | Better Auth serveur / client (`authClient.signIn.email`, `signUp.email`, `signOut`) |
| `src/lib/session.ts` | `getCurrentUser()`, `requireUser()`, `assertAllowed(bool)` (403) |
| `src/lib/permissions.ts` | **Toutes** les règles d'accès (fonctions pures). Chaque page et chaque Server Action les appelle côté serveur. |
| `src/lib/assessment.ts` | Échelle d'auto-positionnement `LEVELS` (1..4), `levelLabel`, `isValidLevel` |
| `src/lib/deposit.ts` | `depositUrlSchema` (http/https uniquement), `detectProvider`, `PROVIDER_LABELS` |
| `src/lib/content.ts` | `editorContentSchema` (validation contenu éditeur), `slugify` |
| `src/components/editor` | `<BlockEditor initialContent initialMarkdown editable onSave />` — `onSave(content, markdown) => Promise<{ok:true}|{ok:false,error}>` |
| `src/app/globals.css` | Tokens + classes `.btn .btn-primary .btn-danger .input .label .card .badge .form-error` |

## Conventions

- Pages = Server Components. Chaque page protégée commence par `const user = await requireUser()`,
  charge la ressource, puis `assertAllowed(canXxx(user, resource))`. `notFound()` si la ressource n'existe pas.
- `params` est une `Promise` : `export default async function Page({ params }: PageProps<"/saes/[saeId]">) { const { saeId } = await params; }`
- Mutations = Server Actions dans un fichier `actions.ts` (`"use server"`) à côté de la route.
  Chaque action : `requireUser()` → validation **zod** des entrées → recharge la ressource → vérifie la permission → écrit → `revalidatePath(...)`.
  Les actions renvoient `{ ok: true } | { ok: false, error: string }` (jamais d'exception brute vers le client) ou font `redirect()`.
- Action d'éditeur : `saveXxxContent = async (id: string, content: unknown, markdown: string) => ...` ;
  côté page : `onSave={saveXxxContent.bind(null, id)}`.
- Formulaires : `<form action={...}>` + `useActionState` pour afficher les erreurs ; états vides explicites (« Aucun jalon pour l'instant »).
- Style : utilitaires Tailwind + classes de `globals.css`. Mobile d'abord (320 px), une colonne jusqu'à `md:`. Cibles tactiles ≥ 44 px (`min-h-11`).
- Textes de l'interface en français.

## Routes (propriété des fichiers)

| Route | Contenu | Propriétaire |
|---|---|---|
| `/login`, `/register` | Connexion / inscription (client, `authClient`) | builder A |
| `/` | Tableau de bord : mes cours, mes SAÉ/groupes, jalons à venir, auto-évaluations à commenter (enseignant) | builder A |
| `/courses`, `/courses/new` | Liste (publiés + ceux que je peux éditer), création (staff) | builder A |
| `/courses/[slug]` | Sommaire (arbre de pages), réglages (titre, résumé, publié, co-éditeurs), SAÉ liées | builder A |
| `/courses/[slug]/pages/[pageId]` | Lecture/édition d'une page ; créer sous-page, renommer, supprimer, monter/descendre | builder A |
| `/admin/users` | Liste des utilisateurs, changement de rôle (admin uniquement) | builder A |
| `/saes`, `/saes/new` | Liste des SAÉ (publiées + gérées + celles où je suis dans un groupe), création (staff) | builder B |
| `/saes/[saeId]` | Sujet (éditeur), infos (code, semestre, compétences, dates, cours lié), jalons, groupes ; mon groupe mis en avant pour l'étudiant | builder B |
| `/saes/[saeId]/manage` | Gestion : réglages, publication, co-enseignants, jalons + critères (AC), groupes + membres | builder B |
| `/saes/[saeId]/groups/[groupId]` | Espace de groupe : membres, espace de travail partagé (éditeur), URL de dépôt par jalon, auto-évaluations soumises des membres | builder C |
| `/saes/[saeId]/milestones/[milestoneId]` | Jalon : description, critères ; étudiant → son auto-évaluation (brouillon/soumise) ; enseignant → tableau de suivi groupes × étudiants × statut | builder C |
| `/saes/[saeId]/milestones/[milestoneId]/assess` | Formulaire d'auto-évaluation de l'étudiant (niveau 1..4 + justification par critère, réflexion globale, enregistrer brouillon / soumettre) | builder C |
| `/assessments/[assessmentId]` | Lecture d'une auto-évaluation + fil de commentaires (enseignants + membres du groupe) ; enseignant peut « rouvrir » | builder C |

Liens attendus entre slices : B affiche des liens vers les routes C ; C revient vers `/saes/[saeId]`.
