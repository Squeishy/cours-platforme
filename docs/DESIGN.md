# Direction visuelle — « la table de montage »

**Thèse.** Un outil de travail calme, dense et lisible, qui ressemble à ce que les étudiants MMI utilisent
(Linear, Notion, Figma) plutôt qu'à un ENT. Le contenu (cours, sujets) respire comme une doc (GitBook, Outline) ;
le suivi (jalons, auto-évaluations) est précis comme un outil de production. Une seule signature :
**la piste de montage** — les jalons d'une SAÉ posés comme des clips sur une timeline, tête de lecture = aujourd'hui.

Références (vues en vrai, 320 et 1280 px) : Linear, Outline, Are.na, Stripe Docs, GitBook, Notion Calendar,
OpenClassrooms (en-tête de cours), Pittogramma (étiquettes mono). Détails : `.orchestrator/inspiration.md`.

## Typographie
- Titres : **Bricolage Grotesque** 600 (Google Fonts, `next/font`), `text-wrap: balance`, interlignage 1.15.
- Texte : **Source Sans 3** 400/600, 16 px, interlignage 1.6, mesure 65–70ch pour la lecture.
- Étiquettes / codes (SAÉ 2.03, AC14.02, J-3, dates, compteurs) : **JetBrains Mono** 500, 12–13 px, chiffres tabulaires.
- Échelle 1.25 : 13 · 16 · 20 · 25 · 31 (· 39 pour le H1 d'accueil en desktop).

## Couleurs (tokens dans `globals.css`, jamais de valeur en dur dans les pages)
| Token | Valeur | Usage |
|---|---|---|
| `--bg` | #F7F5F0 | fond (neutre chaud) |
| `--surface` | #FFFFFF | cartes, éditeur |
| `--sunken` | #EFECE5 | zones en retrait, survols, sidebar |
| `--ink` | #1C1A17 | texte (15.9:1) |
| `--muted` | #5F5A52 | texte secondaire (6.3:1) |
| `--line` | #E2DDD3 | filets 1 px |
| `--accent` / `--accent-soft` | #2448C8 / #E9EDFB | action principale, état actif, lien — **jamais un statut** |
| `--ok` / `--ok-soft` | #16692E / #E6F2E9 | soumis, accessible, publié |
| `--warn` / `--warn-soft` | #8A5300 / #FBF0D9 | < 72 h, brouillon, à vérifier |
| `--danger` / `--danger-soft` | #B42318 / #FCEBE8 | en retard, lien cassé, suppression |
Couleurs de compétence (radar, pastilles AC) : C1 #2F6F9F · C2 #8A5A00 · C3 #B3325A · C4 #2E7D4F · C5 #6A4BB3.
Mode sombre : tokens redéfinis sous `prefers-color-scheme: dark` (ink/bg inversés, accent éclairci ≥ 4.5:1).

## Mise en page
- **≥ 1024 px** : sidebar fixe 240 px (fond `--sunken`), sections en étiquettes mono, élément actif = pastille `--accent-soft`.
- **< 1024 px** : barre haute (titre + recherche + cloche) et **barre d'onglets basse** (Accueil, À faire, Cours, SAÉ, Moi), cibles 44 px.
- Pages de lecture : colonne 70ch ; sommaire à gauche en desktop, repliable en haut en mobile.
- Accueil : une **liste « À rendre » triée par date**, pas une grille de cartes. Cartes réservées aux SAÉ et à la vitrine.
- Pas d'ombre portée ; bord 1 px, rayon 8 px (6 px pour les contrôles). Espacements Tailwind (4 px de base) uniquement.

## Composants (`src/components/ui/`)
- `PageHeader` : surtitre mono (ex. « SAÉ 2.03 · S2 »), H1, chapeau, méta, actions à droite.
- `StatusBadge` : pilule 12 px, fond soft + texte foncé + libellé (jamais la couleur seule).
- `DeadlineChip` : « J-3 » mono (warn < 72 h, danger en retard) + date absolue en `title`/texte secondaire.
- `ProgressRing` : anneau 14 px + « 3/5 ».
- `EmptyState` : phrase utile + action (« Aucun jalon. Ajoutez le premier pour que les étudiants voient l'échéance. »).
- `MilestoneTrack` (signature) : piste horizontale (vertical < 768 px), clips = jalons (couleur selon statut),
  tête de lecture accent = aujourd'hui, timecode mono « S04 · J-3 ». Statique si `prefers-reduced-motion`.
- `CompetenceRadar` : SVG 5 axes, polygone auto (trait) vs enseignant (plein léger), légende texte.

## Mouvement
150–250 ms, une seule courbe (`cubic-bezier(.2,.7,.2,1)`), uniquement : survols, ouverture de tiroirs, apparition
des toasts. Tout est coupé sous `prefers-reduced-motion`.

## Accessibilité (RGAA 4.1 / WCAG 2.1 AA — obligation légale d'un établissement public)
Contrastes AA, focus visible 2 px accent, labels visibles, `aria-live` pour les enregistrements, pas d'information
portée par la seule couleur, navigation clavier complète, page `/accessibilite` (déclaration).

## Risque assumé
Trois familles de polices : gain d'identité (titres, codes) contre ~60 ko de fontes ; on limite les graisses
(Bricolage 600, Source Sans 400/600, JetBrains 500) et `next/font` les auto-héberge.
