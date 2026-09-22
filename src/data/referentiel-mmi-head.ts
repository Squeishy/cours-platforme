// Référentiel de compétences du BUT MMI (Programme national 2022, annexe 19).
// Source : https://www.enseignementsup-recherche.gouv.fr/sites/default/files/2023-12/m-tiers-du-multim-dia-et-de-l-internet-30867.pdf
// Texte extrait : docs/research/pn-mmi-2022.txt — utilisé par prisma/seed.ts (upsert idempotent).

export const MMI_PARCOURS = [
  { code: "Crea", name: "Création numérique", competences: ["C3", "C5"] },
  { code: "Strat-UX", name: "Stratégie de communication numérique et design d'expérience", competences: ["C2", "C5"] },
  { code: "DWeb-DI", name: "Développement web et dispositifs interactifs", competences: ["C4", "C5"] },
] as const;

export const MMI_COMPETENCES = [
  {
    code: "C1",
    name: "Comprendre",
    description: "Comprendre les écosystèmes, les besoins des utilisateurs et les dispositifs de communication numérique",
    color: "#2f6f9f",
    levelLabels: [
      "Comprendre les éléments de communication et les attentes utilisateurs",
      "Comprendre la stratégie de communication et l'expérience utilisateur",
    ],
    components: [
      "en intégrant les enjeux humains, écologiques et éthiques",
      "en écoutant et observant les utilisateurs",
      "en s'appuyant sur des données quantitatives pertinentes et des outils statistiques adaptés",
      "en sollicitant des modèles théoriques issus des sciences humaines et sociales",
      "en restituant les résultats de manière synthétique",
    ],
  },
  {
    code: "C2",
    name: "Concevoir",
    description: "Concevoir ou co-concevoir une réponse stratégique pertinente à une problématique complexe",
    color: "#8a5a00",
    levelLabels: [
      "Concevoir une réponse stratégique",
      "Co-concevoir une réponse stratégique",
      "Co-concevoir une réponse stratégique complexe et prospective",
    ],
    components: [
      "en optimisant la responsabilité sociale et environnementale de l'organisation",
      "en s'intégrant aux écosystèmes physiques et numériques des parties prenantes",
      "en s'appuyant sur les usages et les modes de communication observés",
      "en enrichissant sa démarche de connaissances sociologiques, esthétiques, culturelles et inter-culturelles",
      "en présentant de façon convaincante la réponse proposée, en français, en anglais ou dans d'autres langues",
    ],
  },
  {
    code: "C3",
    name: "Exprimer",
    description: "Exprimer un message avec les médias numériques pour informer et communiquer",
    color: "#b3325a",
    levelLabels: [
      "Exprimer un message par des productions simples",
      "Exprimer une identité visuelle et éditoriale transmédia",
      "Exprimer un récit interactif et une direction artistique",
    ],
    components: [
      "en veillant à la qualité esthétique des créations et en la justifiant par des références culturelles et artistiques",
      "en produisant un discours de qualité, appuyé sur les théories du récit et les traditions narratives",
      "en respectant la stratégie de communication établie",
      "en veillant à la qualité orthographique, grammaticale et typographique des productions",
      "en communiquant en français, en anglais ou dans d'autres langues",
    ],
  },
  {
    code: "C4",
    name: "Développer",
    description: "Développer pour le web et les médias numériques",
    color: "#2e7d4f",
    levelLabels: [
      "Développer un site web simple et le mettre en ligne",
      "Développer une application Web interactive",
      "Développer un écosystème numérique complexe",
    ],
    components: [
      "en se conformant aux standards du Web et aux normes d'accessibilité",
      "en s'appuyant sur des concepts théoriques issus de l'informatique et des sciences de l'information",
      "en produisant du code fonctionnel, sobre et réutilisable",
      "en utilisant les outils favorisant un développement itératif et collaboratif",
      "en veillant à la sécurité des systèmes et des données",
    ],
  },
  {
    code: "C5",
    name: "Entreprendre",
    description: "Entreprendre dans le secteur du numérique",
    color: "#6a4bb3",
    levelLabels: [
      "Entreprendre un projet numérique",
      "Entreprendre un projet au sein d'un écosystème numérique",
      "Entreprendre dans le numérique",
    ],
    components: [
      "en s'appuyant sur une veille technologique et des modèles de l'innovation",
      "en favorisant la collaboration entre les parties prenantes du projet",
      "en respectant le droit et la vie privée",
      "en favorisant la sobriété numérique",
      "en exploitant des cadres de réflexion français et internationaux",
    ],
  },
] as const;

/** SAÉ du programme national (modèles à dupliquer et adapter localement) */
export const MMI_SAE_TEMPLATES = [
  { code: "SAÉ 1.01", semester: 1, title: "Auditer une communication numérique", acs: ["AC11.01", "AC11.02", "AC11.03", "AC11.04", "AC11.05"] },
  { code: "SAÉ 1.02", semester: 1, title: "Concevoir une recommandation de communication numérique", acs: ["AC12.03", "AC12.04"] },
  { code: "SAÉ 1.03", semester: 1, title: "Produire les éléments d'une communication visuelle", acs: ["AC13.02", "AC13.03", "AC13.06"] },
  { code: "SAÉ 1.04", semester: 1, title: "Produire un contenu audio et vidéo", acs: ["AC13.01", "AC13.04", "AC13.06"] },
  { code: "SAÉ 1.05", semester: 1, title: "Produire un site Web", acs: ["AC14.01", "AC14.02", "AC14.03", "AC14.04"] },
  { code: "SAÉ 1.06", semester: 1, title: "Gérer un projet de communication numérique", acs: ["AC15.01", "AC15.02", "AC15.03", "AC15.06", "AC15.07"] },
  { code: "SAÉ 2.01", semester: 2, title: "Explorer les usages du numérique", acs: [] },
  { code: "SAÉ 2.02", semester: 2, title: "Concevoir un produit ou un service et sa communication", acs: [] },
  { code: "SAÉ 2.03", semester: 2, title: "Concevoir un site web avec une source de données", acs: [] },
  { code: "SAÉ 2.04", semester: 2, title: "Construire sa présence en ligne", acs: ["AC15.05", "AC15.07"] },
] as const;
