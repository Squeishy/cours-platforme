# Inspirations — refonte MMI

siteType: dashboard (secondaire docs) · dbCount: 64 · pas de harvest (≥ 50)
vault: vide
harvest: DB dashboard surtout portfolios, hors sujet ; Pittogramma retenu via recherche Awwwards
catalog: linear, stripe-docs, notion
Vus en 320 et 1280 : Are.na, GitBook, Pittogramma, Linear. Écartés : Khan Academy (anti-bot), DSFR (réservé .gouv.fr), Read.cv et Height (fermés).

## Références

1. **Linear** — https://linear.app : sidebar dense, actif en pastille teintée. Statut = cercle partiellement rempli, identifiant mono avant le titre.
2. **Outline** — https://www.getoutline.com : page doc = fil d'Ariane, titre, « modifié il y a X par Y ». Un seul bleu saturé, pour le CTA principal.
3. **Are.na** — https://www.are.na/explore : hiérarchie par graisse et gris, pas par taille. Blocs bordés 1px sans ombre ; à 320, chips de filtre et barre d'onglets basse.
4. **Stripe Docs** — https://docs.stripe.com/payments/checkout : neutres teintés marine (#1A1F36, #3C4257), jamais de gris pur.
5. **GitBook** — https://gitbook.com/docs : texte 768px max, corps 16/26, actif et badge « New » en teinte d'accent. À 320 : arbre en tiroir, sommaire près du fil d'Ariane.
6. **Notion Calendar** — https://www.notion.com/product/calendar : événement = fond pâle + bord gauche saturé ; aujourd'hui = pastille pleine.
7. **OpenClassrooms** — https://openclassrooms.com/fr/courses/1603881-creez-votre-site-web-avec-html5-et-css3 : en-tête de cours = surtitre, H1, chapeau, méta (Facile · 15 h), onglets Aperçu / Table des matières.
8. **Pittogramma** (Awwwards) — https://www.pittogramma.xyz/ : étiquettes mono capitales 12px détourées ; cartes sans boîte (image + texte).

## 5 recommandations

1. **Typo** — Bricolage Grotesque (titres, 600) + Source Sans 3 conservée (corps 16/1,6, 65ch) + JetBrains Mono (labels, dates, codes SAÉ, chiffres tabulaires). Échelle 1,25 : 13 · 16 · 20 · 25 · 31.
2. **Palette** (mêmes noms de tokens) — bg #F7F5F0, surface #FFFFFF, sunken #EFECE5, ink #1C1A17 (15,9:1), muted #5F5A52 (6,3:1), line #E2DDD3. Accent unique #2448C8 (6,8:1), accent-soft #E9EDFB. Statuts, texte foncé sur teinte, ≥ 5,6:1 : ok #16692E/#E6F2E9, warn #8A5300/#FBF0D9, danger #B42318/#FCEBE8. L'accent n'est jamais un statut.
3. **Layout/nav** — ≥ 1024 : sidebar 240px, labels de section en mono. Dessous : barre haute (titre + recherche) + barre basse (Accueil, Cours, SAÉ, Profil), cibles 44px. Cours : colonne 68ch + bouton sommaire. Tableau de bord : une liste « À rendre » triée par date, pas une grille de cartes.
4. **Composants** — Cartes réservées aux SAÉ : bord 1px, rayon 8, sans ombre ; le reste en lignes à filets. Badges : pilule mono 12px, teinte + texte, jamais la couleur seule. Progression : anneau 14px + « 3/5 jalons ». Échéance : « J-3 » mono, warn sous 72 h, danger en retard, plus la date absolue.
5. **Signature MMI** — la « piste de montage » : jalons d'une SAÉ posés comme des clips sur une timeline, tête de lecture accent = aujourd'hui, timecode mono « S04 · J-3 ». À 320, piste verticale. Statique si prefers-reduced-motion.
