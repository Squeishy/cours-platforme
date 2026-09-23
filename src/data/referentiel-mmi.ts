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

// Apprentissages critiques — libellés exacts du PN (75 AC : 29 niveau 1, 28 niveau 2, 18 niveau 3)
export const MMI_CRITICAL_LEARNINGS: ReadonlyArray<{ code: string; level: 1 | 2 | 3; competence: string; parcours: string | null; label: string }> = [
  {
    "code": "AC11.01",
    "level": 1,
    "competence": "C1",
    "label": "Présenter une organisation, ses activités et son environnement (économique, sociologique, culturel, juridique, technologique, communicationnel et médiatique)",
    "parcours": null
  },
  {
    "code": "AC11.02",
    "level": 1,
    "competence": "C1",
    "label": "Évaluer un site web, un produit multimédia ou un dispositif interactif existant en s’appuyant sur des guides de bonnes pratiques",
    "parcours": null
  },
  {
    "code": "AC11.03",
    "level": 1,
    "competence": "C1",
    "label": "Produire des analyses statistiques descriptives et les interpréter pour évaluer un contexte socio-économique",
    "parcours": null
  },
  {
    "code": "AC11.04",
    "level": 1,
    "competence": "C1",
    "label": "Analyser des formes médiatiques et leur sémiotique",
    "parcours": null
  },
  {
    "code": "AC11.05",
    "level": 1,
    "competence": "C1",
    "label": "Identifier les cibles (critères socio-économiques, démographiques, géographiques, culturels...)",
    "parcours": null
  },
  {
    "code": "AC11.06",
    "level": 1,
    "competence": "C1",
    "label": "Réaliser des entretiens utilisateurs pour construire des personae et des récits utilisateurs (user stories)",
    "parcours": null
  },
  {
    "code": "AC12.01",
    "level": 1,
    "competence": "C2",
    "label": "Concevoir un produit ou un service en terme d’usage et de fonctionnalité",
    "parcours": null
  },
  {
    "code": "AC12.02",
    "level": 1,
    "competence": "C2",
    "label": "Construire la proposition de valeur d’un produit ou d’un service",
    "parcours": null
  },
  {
    "code": "AC12.03",
    "level": 1,
    "competence": "C2",
    "label": "Proposer une recommandation marketing (cibles, objectifs, points de contact)",
    "parcours": null
  },
  {
    "code": "AC12.04",
    "level": 1,
    "competence": "C2",
    "label": "Proposer une stratégie de communication",
    "parcours": null
  },
  {
    "code": "AC13.01",
    "level": 1,
    "competence": "C3",
    "label": "Ecrire pour les médias numériques",
    "parcours": null
  },
  {
    "code": "AC13.02",
    "level": 1,
    "competence": "C3",
    "label": "Produire des pistes graphiques et des planches d’inspiration",
    "parcours": null
  },
  {
    "code": "AC13.03",
    "level": 1,
    "competence": "C3",
    "label": "Créer, composer et retoucher des visuels",
    "parcours": null
  },
  {
    "code": "AC13.04",
    "level": 1,
    "competence": "C3",
    "label": "Tourner et monter une vidéo (scénario, captation image et son...)",
    "parcours": null
  },
  {
    "code": "AC13.05",
    "level": 1,
    "competence": "C3",
    "label": "Designer une interface web (wireframes, UI)",
    "parcours": null
  },
  {
    "code": "AC13.06",
    "level": 1,
    "competence": "C3",
    "label": "Optimiser les médias en fonction de leurs usages et supports de diffusion",
    "parcours": null
  },
  {
    "code": "AC14.01",
    "level": 1,
    "competence": "C4",
    "label": "Exploiter de manière autonome un environnement de développement efficace et productif",
    "parcours": null
  },
  {
    "code": "AC14.02",
    "level": 1,
    "competence": "C4",
    "label": "Produire des pages Web fluides incluant un balisage sémantique efficace et des interactions simples",
    "parcours": null
  },
  {
    "code": "AC14.03",
    "level": 1,
    "competence": "C4",
    "label": "Générer des pages Web à partir de données structurées",
    "parcours": null
  },
  {
    "code": "AC14.04",
    "level": 1,
    "competence": "C4",
    "label": "Mettre en ligne une application Web en utilisant une solution d’hébergement standard",
    "parcours": null
  },
  {
    "code": "AC14.05",
    "level": 1,
    "competence": "C4",
    "label": "Modéliser les données d’une application Web",
    "parcours": null
  },
  {
    "code": "AC14.06",
    "level": 1,
    "competence": "C4",
    "label": "Déployer et personnaliser une application Web en utilisant un CMS ou un framework MVC",
    "parcours": null
  },
  {
    "code": "AC15.01",
    "level": 1,
    "competence": "C5",
    "label": "Gérer un projet avec une méthode classique",
    "parcours": null
  },
  {
    "code": "AC15.02",
    "level": 1,
    "competence": "C5",
    "label": "Budgéter un projet et suivre sa rentabilité",
    "parcours": null
  },
  {
    "code": "AC15.03",
    "level": 1,
    "competence": "C5",
    "label": "Découvrir les écosystèmes d’innovation numérique (fab labs, living labs, tiers-lieux, incubateurs…)",
    "parcours": null
  },
  {
    "code": "AC15.04",
    "level": 1,
    "competence": "C5",
    "label": "Analyser un produit ou un service innovant en identifiant les propositions de valeurs et en évaluant les solutions proposées",
    "parcours": null
  },
  {
    "code": "AC15.05",
    "level": 1,
    "competence": "C5",
    "label": "Construire une présence en ligne professionnelle (personal branding)",
    "parcours": null
  },
  {
    "code": "AC15.06",
    "level": 1,
    "competence": "C5",
    "label": "Interagir au sein des organisations",
    "parcours": null
  },
  {
    "code": "AC15.07",
    "level": 1,
    "competence": "C5",
    "label": "Produire un message écrit ou oral professionnel",
    "parcours": null
  },
  {
    "code": "AC21.01",
    "level": 2,
    "competence": "C1",
    "label": "Analyser la stratégie de communication ou marketing d’un acteur, d’une organisation au regard d’un secteur ou d’un marché (stratégie, mission, valeurs...)",
    "parcours": null
  },
  {
    "code": "AC21.02",
    "level": 2,
    "competence": "C1",
    "label": "Auditer un site web, une marque ou un service, en termes de trafic et de référencement",
    "parcours": null
  },
  {
    "code": "AC21.03",
    "level": 2,
    "competence": "C1",
    "label": "Traiter des données avec des outils statistiques pour faciliter leur analyse et leur exploitation",
    "parcours": null
  },
  {
    "code": "AC21.04",
    "level": 2,
    "competence": "C1",
    "label": "Identifier et décrire les parcours client à partir d’enquêtes de terrain",
    "parcours": null
  },
  {
    "code": "AC21.05",
    "level": 2,
    "competence": "C1",
    "label": "Cartographier les expériences utilisateur : points de contact, points de friction et de satisfaction, carte d’empathie.",
    "parcours": null
  },
  {
    "code": "AC22.01",
    "level": 2,
    "competence": "C2",
    "label": "Co-concevoir un produit ou un service (proposition de valeur, fonctionnalités...)",
    "parcours": null
  },
  {
    "code": "AC22.02",
    "level": 2,
    "competence": "C2",
    "label": "Produire une recommandation ergonomique à partir des tests utilisateurs (sur système fonctionnel, prototype ou maquette interactive)",
    "parcours": null
  },
  {
    "code": "AC22.03",
    "level": 2,
    "competence": "C2",
    "label": "Co-construire une recommandation stratégique (en structurant un plan d’action)",
    "parcours": null
  },
  {
    "code": "AC22.04",
    "level": 2,
    "competence": "C2",
    "label": "Optimiser le référencement d’un site web, d’un produit ou d’un service",
    "parcours": null
  },
  {
    "code": "AC22.05",
    "level": 2,
    "competence": "C2",
    "label": "Mettre en place une présence sur les réseaux sociaux",
    "parcours": null
  },
  {
    "code": "AC23.01",
    "level": 2,
    "competence": "C3",
    "label": "Produire un écrit journalistique sourcé et documenté",
    "parcours": null
  },
  {
    "code": "AC23.02",
    "level": 2,
    "competence": "C3",
    "label": "Définir une iconographie (illustrations, photographies, vidéos)",
    "parcours": null
  },
  {
    "code": "AC23.03",
    "level": 2,
    "competence": "C3",
    "label": "Créer et décliner une identité visuelle (charte graphique)",
    "parcours": null
  },
  {
    "code": "AC23.04",
    "level": 2,
    "competence": "C3",
    "label": "Imaginer, écrire et scénariser en vue d’une communication multimédia ou transmédia",
    "parcours": null
  },
  {
    "code": "AC23.05",
    "level": 2,
    "competence": "C3",
    "label": "Réaliser, composer et produire pour une communication plurimédia",
    "parcours": null
  },
  {
    "code": "AC23.06",
    "level": 2,
    "competence": "C3",
    "label": "Élaborer et produire des animations, des designs sonores, des effets spéciaux, de la visualisation de données ou de la 3D",
    "parcours": null
  },
  {
    "code": "AC24.01",
    "level": 2,
    "competence": "C4",
    "label": "Produire des pages et applications Web responsives",
    "parcours": null
  },
  {
    "code": "AC24.02",
    "level": 2,
    "competence": "C4",
    "label": "Mettre en place ou développer un back office",
    "parcours": null
  },
  {
    "code": "AC24.03",
    "level": 2,
    "competence": "C4",
    "label": "Intégrer, produire ou développer des interactions riches ou des dispositifs interactifs",
    "parcours": null
  },
  {
    "code": "AC24.04",
    "level": 2,
    "competence": "C4",
    "label": "Modéliser les traitements d’une application Web",
    "parcours": null
  },
  {
    "code": "AC24.05",
    "level": 2,
    "competence": "C4",
    "label": "Optimiser une application web en termes de référencement et de temps de chargement",
    "parcours": null
  },
  {
    "code": "AC24.06",
    "level": 2,
    "competence": "C4",
    "label": "Configurer une solution d’hébergement adaptée aux besoins",
    "parcours": null
  },
  {
    "code": "AC25.01",
    "level": 2,
    "competence": "C5",
    "label": "Gérer un projet avec une méthode d’amélioration continue par exemple une méthode agile",
    "parcours": null
  },
  {
    "code": "AC25.02",
    "level": 2,
    "competence": "C5",
    "label": "Cartographier un écosystème (identification des acteurs, synthèse des propositions de valeur)",
    "parcours": null
  },
  {
    "code": "AC25.03",
    "level": 2,
    "competence": "C5",
    "label": "Initier la constitution d’un réseau professionnel",
    "parcours": null
  },
  {
    "code": "AC25.04",
    "level": 2,
    "competence": "C5",
    "label": "Collaborer au sein des organisations",
    "parcours": null
  },
  {
    "code": "AC25.05",
    "level": 2,
    "competence": "C5",
    "label": "Maitriser les codes des productions écrites et orales professionnelles",
    "parcours": null
  },
  {
    "code": "AC25.06",
    "level": 2,
    "competence": "C5",
    "label": "Prendre en compte les contraintes juridiques",
    "parcours": null
  },
  {
    "code": "AC32.01",
    "level": 3,
    "competence": "C2",
    "label": "Projeter les futurs possibles d’une organisation, d’une marque, d’un service, produit ou secteur (tendances, évolutions, scénarios prospectifs)",
    "parcours": "Strat-UX"
  },
  {
    "code": "AC32.02",
    "level": 3,
    "competence": "C2",
    "label": "Co-construire un produit ou service de manière itérative (ateliers de créativité, idéation, définition de l’expérience utilisateur, exploitation des résultats de test)",
    "parcours": "Strat-UX"
  },
  {
    "code": "AC32.03",
    "level": 3,
    "competence": "C2",
    "label": "Concevoir et mettre en oeuvre une communication 360, plurimédia ou transmédia",
    "parcours": "Strat-UX"
  },
  {
    "code": "AC32.04",
    "level": 3,
    "competence": "C2",
    "label": "Construire des outils de validation et de suivi (flux, indicateurs de performance, tableaux de bord, référencement, engagement...)",
    "parcours": "Strat-UX"
  },
  {
    "code": "AC33.01",
    "level": 3,
    "competence": "C3",
    "label": "Adopter et justifier une démarche originale et personnelle dans ses productions",
    "parcours": "Crea"
  },
  {
    "code": "AC33.02",
    "level": 3,
    "competence": "C3",
    "label": "Concevoir un design system et en produire les éléments visuels, graphiques ou sonores",
    "parcours": "Crea"
  },
  {
    "code": "AC33.03",
    "level": 3,
    "competence": "C3",
    "label": "Maitriser les étapes de production d'un projet multimédia",
    "parcours": "Crea"
  },
  {
    "code": "AC33.04",
    "level": 3,
    "competence": "C3",
    "label": "Produire les éléments pour une expérience sophistiquée (notamment immersive, en réalité virtuelle, augmentée...)",
    "parcours": "Crea"
  },
  {
    "code": "AC33.05",
    "level": 3,
    "competence": "C3",
    "label": "Apprehender les enjeux liés à la direction artistique",
    "parcours": "Crea"
  },
  {
    "code": "AC34.01",
    "level": 3,
    "competence": "C4",
    "label": "Développer à l’aide d’un framework de développement côté client",
    "parcours": "DWeb-DI"
  },
  {
    "code": "AC34.02",
    "level": 3,
    "competence": "C4",
    "label": "Développer à l’aide d’un framework de développement côté serveur",
    "parcours": "DWeb-DI"
  },
  {
    "code": "AC34.03",
    "level": 3,
    "competence": "C4",
    "label": "Développer des dispositifs interactifs sophistiqués",
    "parcours": "DWeb-DI"
  },
  {
    "code": "AC34.04",
    "level": 3,
    "competence": "C4",
    "label": "Concevoir et développer des composants logiciels, plugins ou extensions",
    "parcours": "DWeb-DI"
  },
  {
    "code": "AC34.05",
    "level": 3,
    "competence": "C4",
    "label": "Maitriser l'hébergement et le déploiement d'applications",
    "parcours": "DWeb-DI"
  },
  {
    "code": "AC35.01",
    "level": 3,
    "competence": "C5",
    "label": "Piloter un produit, un service ou une équipe",
    "parcours": null
  },
  {
    "code": "AC35.02",
    "level": 3,
    "competence": "C5",
    "label": "Maîtriser la qualité en projet Web ou multimédia",
    "parcours": null
  },
  {
    "code": "AC35.03",
    "level": 3,
    "competence": "C5",
    "label": "Concevoir un projet d’entreprise innovante en définissant le nom, l’identité, la forme juridique et le ton de la marque",
    "parcours": null
  },
  {
    "code": "AC35.04",
    "level": 3,
    "competence": "C5",
    "label": "Défendre un projet de manière convaincante",
    "parcours": null
  }
] as const;
