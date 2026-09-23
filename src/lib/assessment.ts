// Échelle d'auto-positionnement, inspirée des grilles utilisées en BUT
// pour situer ses apprentissages critiques.
export const LEVELS = [
  { value: 1, label: "Non acquis", hint: "Je ne sais pas encore le faire" },
  { value: 2, label: "En cours d'acquisition", hint: "Je sais le faire avec de l'aide" },
  { value: 3, label: "Acquis", hint: "Je sais le faire seul·e" },
  { value: 4, label: "Maîtrisé", hint: "Je peux l'expliquer / l'enseigner à d'autres" },
] as const;

export type Level = (typeof LEVELS)[number]["value"];

export function levelLabel(level: number) {
  return LEVELS.find((l) => l.value === level)?.label ?? "—";
}

export function isValidLevel(level: number): level is Level {
  return LEVELS.some((l) => l.value === level);
}

/** Évaluation de la contribution d'un coéquipier (PeerReview.contribution) */
export const CONTRIBUTION_LEVELS = [
  { value: 1, label: "Peu impliqué·e", hint: "A peu contribué au travail du groupe" },
  { value: 2, label: "Contribution partielle", hint: "A contribué, mais moins que prévu" },
  { value: 3, label: "Contribution attendue", hint: "A fait sa part du travail" },
  { value: 4, label: "Moteur du groupe", hint: "A porté le projet au-delà de sa part" },
] as const;

export function contributionLabel(value: number) {
  return CONTRIBUTION_LEVELS.find((l) => l.value === value)?.label ?? "—";
}
