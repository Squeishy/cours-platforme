# Recherche — de quoi un département BUT MMI a vraiment besoin

Synthèse de 4 recherches menées en parallèle (septembre 2026) : benchmark des plateformes, référentiel et
quotidien MMI, authentification externe, références d'interface. Chaque fonctionnalité retenue est reliée
à un besoin observé et à sa mise en œuvre dans le code.

## 1. Ce que font les autres (et ce qu'on en garde)

| Plateforme | Ce qu'on retient |
|---|---|
| **Moodle** (Workshop, compétences, badges) | Phases dépôt → évaluation par les pairs ; référentiels de compétences avec preuves. *Mais* interface surchargée, trop de clics, notifications vides — [docs](https://docs.moodle.org/502/en/Workshop_activity), [critiques](https://edwiser.org/blog/problem-moodle-ui/) |
| **Canvas** (Rubrics, SpeedGrader, Outcomes) | Auto-évaluation sur la grille visible pendant la correction ; correction en file avec banque de commentaires ; flux iCal ; import d'un cours avec décalage des dates — [rubrics](https://blog.uwgb.edu/catl/canvas-rubrics-enhanced/), [SpeedGrader](https://teaching.pitt.edu/resources/speedgrader-comment-library/) |
| **Google Classroom** (2026) | Accueil selon le rôle : « à rendre bientôt » pour l'étudiant, alertes pour l'enseignant — [annonce](https://workspaceupdates.googleblog.com/2026/07/redesigned-google-classroom-homepage-with-tailored-views-based-on-users-role.html) |
| **BookStack** (outil actuel) | Révisions + restauration, tags, favoris, export Markdown, API — **à ne pas régresser** |
| **Outline** | Liens publics, commentaires, comparaison de révisions, import Markdown |
| **FeedbackFruits** (ex-Peergrade) | Auto-évaluation + évaluation des coéquipiers sur les mêmes critères, détection des écarts (passagers clandestins) — [solution](https://feedbackfruits.com/solutions/group-member-evaluation) |
| **Mahara / Karuta** | Portfolio de compétences : traces reliées aux AC, carte des compétences acquises / en cours — [Karuta vs Mahara](https://karuta-france-portfolio.fr/karuta-et-mahara-2-outils-open-source-de-qualite-pour-les-competences-lequel-choisir/) |
| **Portfolios MMI Grenoble** | ≥ 3 traces par compétence et par an, chaque trace reliée à des AC, auto-positionnement argumenté — [site](https://portfolios.25.gremmi.fr/) |
| **GitHub Classroom** | **Fermé le 28/08/2026** → ne dépendre d'aucun service tiers pour les rendus ; URL seulement |
| **Festival MMI** | Catégories (graphisme, audiovisuel, animation, UX, web) et fiche projet (titre, 600 caractères, lien, visuel) — [règlement 2026](https://2026.festivalmmi.fr/sites/festival2026/documents/Reglement_2026_Festival_MMI.pdf) |

## 2. Le cadre MMI (vérifié dans le Programme national 2022)

- **5 compétences** : Comprendre · Concevoir · Exprimer · Développer · Entreprendre ; 3 niveaux (≈ années).
- **75 apprentissages critiques** (codes `AC{niveau}{compétence}.{nn}`) et 25 composantes essentielles — intégrés
  dans `src/data/referentiel-mmi.ts` (source : [PN MMI](https://www.enseignementsup-recherche.gouv.fr/sites/default/files/2023-12/m-tiers-du-multim-dia-et-de-l-internet-30867.pdf), texte extrait dans `pn-mmi-2022.txt`).
- **3 parcours** en BUT3 : Création numérique (Exprimer + Entreprendre), Stratégie de communication numérique
  et design d'expérience (Concevoir + Entreprendre), Développement web et dispositifs interactifs (Développer + Entreprendre).
- **SAÉ** : codes `SAÉ 1.01`… `SAÉ 3.Crea.01`, groupes de 3 à 5 en pratique, livrables multimédias (site, maquette,
  vidéo, audio, charte, dataviz, dispositif interactif), volumes « à définir localement » → **refaites chaque année**.
- **Portfolio** : point d'étape non évalué aux S1/S3/S5, évalué aux S2/S4/S6 ; traces issues de toutes les SAÉ.
- **Outils du quotidien** : ENT + CAS (ESUP), Moodle, ADE/Hyperplanning/Celcat (export ICS), ScoDoc (notes, jurys),
  Esup-Pod (vidéo), Figma, GitHub/GitLab, Drive.

## 3. Les besoins, par personne

**Enseignant·e** — beaucoup de SAÉ et de groupes à suivre ; savoir qui n'a pas rendu, quels liens sont privés ;
corriger vite et de façon homogène ; ne pas tout refaire chaque année ; planifier les soutenances sans tableur ;
coordonner plusieurs collègues sur une même SAÉ.

**Étudiant·e** — savoir quoi rendre et quand, au même endroit ; comprendre ce que le référentiel attend ;
un retour qui explique l'écart entre son auto-évaluation et l'avis de l'enseignant ; retrouver ses traces pour
le portfolio ; montrer ses projets ; poser une question sans gêne.

**Responsable / admin** — un seul référentiel juste ; des promos à gérer ; des annonces qui arrivent au bon
public ; conformité (RGAA, RGPD) ; brancher le CAS plus tard.

## 4. Ce qui a été construit (v2) — besoin → fonctionnalité

| Besoin | Fonctionnalité | Où |
|---|---|---|
| « Qu'est-ce que je dois rendre ? » | **À faire** unifié (retards, cette semaine, plus tard) + **flux ICS** personnel pour son agenda | `/todo`, `/me/settings`, `/api/calendar/[token]` |
| Liens de rendu privés / cassés | **Vérificateur de liens** (accessible sans connexion ? page de login Google/Figma/GitHub détectée), anti-SSRF | `src/lib/link-check.ts`, page groupe |
| Corriger vite et homogène | **File de correction** (clavier j/k), **positionnement enseignant** par critère, **banque de commentaires**, publication groupée des retours | `/saes/[id]/review`, `/assessments/[id]`, `/me/comment-bank` |
| Comprendre l'écart d'évaluation | **Comparaison auto / enseignant** avec écarts ≥ 2 niveaux signalés | `/assessments/[id]` |
| Passagers clandestins | **Évaluation de la contribution** entre coéquipiers (anonyme pour l'évalué) | page jalon |
| Rendre le référentiel lisible | **Référentiel MMI officiel** en base, critères reliés aux AC, **radar des 5 compétences** | `/admin/referentiel`, `/me/competences` |
| Préparer le portfolio | **Portfolio** : traces (URL + réflexion + niveau) par AC + traces SAÉ automatiques, **lien public** partageable | `/me/portfolio`, `/p/portfolio/[token]` |
| Refaire les SAÉ chaque année | **Modèles du Programme national**, **duplication** d'une SAÉ avec décalage des dates, duplication de cours | `/saes/new`, gestion SAÉ, cours |
| Former les groupes | Promo liée à la SAÉ, **groupes automatiques**, ajout par liste d'e-mails | gestion SAÉ, `/admin/cohorts` |
| Planifier les soutenances | **Créneaux** générés en lot, réservation par les groupes, dans l'ICS | `/saes/[id]/defenses` |
| Un canal officiel | **Annonces** (globales, promo, SAÉ, cours) + **notifications** in-app | `/admin/announcements`, `/notifications` |
| Ne pas régresser vs BookStack | **Historique des versions** + restauration, **recherche plein texte**, **favoris**, **lien public** de cours | pages de cours, `/search` |
| Cours multimédia | **Intégrations** Figma, YouTube, Vimeo, CodePen, SoundCloud, Sketchfab, Esup-Pod (liste blanche + CSP) | éditeur (`/` → Intégration) |
| Poser une question sans gêne | **Questions anonymes** (vis-à-vis des étudiants) sur chaque page, **FAQ** du cours | pages de cours |
| Montrer ses projets | **Vitrine** publique modérée (catégories Festival MMI) | `/vitrine` |
| Jurys | Fiche étudiant (radar, portfolio, SAÉ), **export CSV** du suivi | `/students/[id]`, export SAÉ |
| Obligations légales | Déclaration **RGAA**, export **RGPD** de ses données | `/accessibilite`, `/me/settings` |
| CAS plus tard | Point d'extension prêt, rôle déduit de l'annuaire (SUPANN) | `docs/AUTH-EXTERNE.md` |

## 5. Pièges évités volontairement

- Pas d'écrans d'options à la Moodle : bons défauts, actions groupées, autosave partout.
- Pas de moyenne automatique de compétences transformée en note : les notes restent dans ScoDoc ; ici on
  **positionne** (1–4) et on **exporte** (CSV).
- Pas de collecte de fichiers (demande du client) ni d'annotation de PDF ; pas de messagerie privée (minimisation RGPD).
- Pas de gamification (badges, classements) : pensée pour le secondaire, peu utile en BUT.
- Pas de dépendance à un service tiers pour l'essentiel (GitHub Classroom et Eduflow ont fermé).

## 6. Pistes suivantes (non construites)

Import BookStack via son API · import ICS des emplois du temps (ADE/Hyperplanning) · résumé par e-mail
(nécessite un SMTP) · webhook Discord par promo · édition temps réel (Yjs + Hocuspocus) · contrôles automatiques
des livrables web (W3C, accessibilité, poids) · export vers ScoDoc · matrice SAÉ × AC de couverture du référentiel.
