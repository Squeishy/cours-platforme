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

---

# v2 — contrat (fonctionnalités « département BUT MMI »)

Recherche : `docs/research/` (benchmark plateformes, référentiel MMI, auth externe). Direction visuelle : `docs/DESIGN.md`.

## Nouveaux modules partagés (propriété du lead — ne pas modifier, les importer)

| Fichier | Rôle |
|---|---|
| `prisma/schema.prisma` (v2) | Référentiel (`Competence`, `EssentialComponent`, `CriticalLearning`), `PortfolioEvidence`, `Cohort`, `Announcement`, `Notification`, `Favorite`, `PageRevision`, `PageQuestion/Answer`, `CommentSnippet`, `PeerReview`, `DefenseSlot` ; champs vitrine sur `Group`, vérif. de lien sur `DepositLink`, niveaux enseignant sur `SelfAssessmentItem` + `feedbackPublishedAt` |
| `src/data/referentiel-mmi.ts` | Référentiel officiel MMI (5 compétences, 75 AC, CE, parcours) + `MMI_SAE_TEMPLATES` |
| `src/lib/permissions.ts` | + `canEvaluateAssessment`, `canSeeTeacherFeedback`, `canReviewPeer`, `canSeePeerReviews`, `canBookDefense`, `canRequestShowcase`, `canPublishShowcase`, `canAskQuestion`, `canAnswerQuestion`, `canModerateQuestion`, `canResolveQuestion`, `canSeeAnonymousAuthor`, `canAnnounce`, `canManageReferentiel`, `canManageCohorts`, `canViewPortfolio`, `canDeleteCourse`, `canDeleteSae` |
| `src/lib/notify.ts` | `notify(userIds, { type, title, body?, link? }, exceptUserId?)` (ne lève jamais), `unreadNotificationCount`, `saeStaffIds` |
| `src/lib/format.ts` | `formatDate`, `formatDateShort`, `formatDateTime`, `formatTime`, `deadline(due, now?, done?) → { label: "J-3", tone }`, `timeAgo` — **fuseau Europe/Paris** |
| `src/lib/ics.ts` | `buildIcs(name, events)` (RFC 5545) |
| `src/lib/link-check.ts` | `checkLink(url) → { status: OK|PRIVATE|BROKEN|UNREACHABLE, http, note }` — anti-SSRF ; `LINK_STATUS_LABELS` |
| `src/lib/embeds.ts` | `toEmbed(url, peertubeHosts?) → { provider, src, title, aspect } | null` (liste blanche), `EMBED_LABELS` |
| `src/lib/competences.ts` | `computeCompetenceProfile`, `isSignificantGap`, `radarPoints` |
| `src/lib/revisions.ts` | `snapshotPageBeforeWrite(pageId, editorId)` — à appeler avant chaque écriture de contenu de page |
| `src/lib/favorites.ts` + `src/components/favorite-button.tsx` + `src/app/_actions/favorites.ts` | `listFavorites`, `isFavorite`, `<FavoriteButton kind targetId initial label />` |
| `src/lib/tokens.ts` | `randomToken()`, `isTokenShape()` (liens publics, ICS) |
| `src/lib/assessment.ts` | + `CONTRIBUTION_LEVELS`, `contributionLabel` |
| `src/lib/auth-providers.ts`, `auth-roles.ts` | Point d'extension CAS/OIDC (inactif) — voir `docs/AUTH-EXTERNE.md` |
| `globals.css` | + `.btn-ghost`, `.badge-ok|warn|danger|accent`, `.eyebrow`, tokens `sunken`, `*-soft`, `warn` |

## Règles communes v2
- Mêmes conventions qu'en v1 (requireUser → zod → recharger → permission → écrire → revalidatePath ; `{ ok } | { ok:false, error }`).
- **Notifications** : chaque événement listé ci-dessous appelle `notify()` dans l'action concernée.
- **Liens externes** : `rel="noopener noreferrer nofollow" target="_blank"`, URL validées (`depositUrlSchema`). Images de vitrine : URL `https:` uniquement, `<img loading="lazy" alt="…">`, `referrerPolicy="no-referrer"`.
- **Pages publiques** (`/p/**`, `/vitrine`) : `export const metadata = { robots: { index: false } }` sauf `/vitrine` (indexable), aucune adresse e-mail affichée, uniquement du contenu explicitement publié.
- **Jamais** `dangerouslySetInnerHTML` ; textes libres rendus en texte brut avec `whitespace-pre-line`.
- **CSV** : BOM UTF-8, séparateur `;` (Excel FR), cellules commençant par `= + - @` préfixées d'une apostrophe (injection de formules).
- Tailles : listes paginées ou bornées (`take`), pas de requête non bornée sur des tables qui grossissent.

## Événements → notifications
| Événement | Destinataires |
|---|---|
| Commentaire sur une auto-évaluation | auteur de l'auto-éval + équipe de la SAÉ (sauf l'auteur du commentaire) |
| Retour enseignant publié / auto-éval rouverte | l'étudiant |
| Annonce SAÉ / cours / promo / globale | membres des groupes de la SAÉ / (cours : aucun) / membres de la promo / tous |
| Question sur une page | éditeurs du cours |
| Réponse à une question | auteur de la question |
| Créneau de soutenance attribué / réservé | membres du groupe / équipe de la SAÉ |
| Demande de vitrine / publication | équipe de la SAÉ / membres du groupe |

## Routes v2 et propriété des fichiers (agents en parallèle — ne jamais écrire hors de son périmètre)

| Agent | Fichiers |
|---|---|
| **D — design & coquille** | `src/app/globals.css`, `src/app/layout.tsx`, `src/components/site-header.tsx`, `src/components/sign-out-button.tsx`, `src/components/app-shell/**`, `src/components/ui/**`, `src/app/page.tsx` (accueil), `src/app/login/**`, `src/app/register/**`, `src/app/accessibilite/**`, `src/app/aide/**`, `src/app/not-found.tsx`, `src/app/forbidden.tsx`, `src/app/loading.tsx`, `src/app/error.tsx` |
| **S — SAÉ & organisation** | `src/app/saes/page.tsx`, `saes/new/**`, `saes/actions.ts`, `saes/_components/**`, `saes/_lib/**`, `saes/[saeId]/page.tsx`, `saes/[saeId]/manage/**`, `saes/[saeId]/defenses/**`, `saes/[saeId]/export/**`, `src/app/admin/referentiel/**` |
| **E — évaluation** | `saes/[saeId]/milestones/**`, `saes/[saeId]/review/**`, `src/app/assessments/**`, `src/app/me/comment-bank/**` |
| **P — portfolio, vitrine, groupes** | `saes/[saeId]/groups/**`, `src/app/me/page.tsx`, `src/app/me/competences/**`, `src/app/me/portfolio/**`, `src/app/p/portfolio/**`, `src/app/vitrine/**`, `src/app/students/**`, `src/components/competence-radar.tsx` |
| **C — contenus** | `src/app/courses/**`, `src/components/editor/**`, `src/app/search/**`, `src/app/p/course/**` |
| **N — communication & planning** | `src/app/notifications/**`, `src/app/todo/**`, `src/app/api/calendar/**`, `src/app/me/settings/**`, `src/app/admin/announcements/**`, `src/app/admin/cohorts/**`, `src/app/admin/users/**` |
