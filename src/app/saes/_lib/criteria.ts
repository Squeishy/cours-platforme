// Affichage des critères : le rattachement au référentiel (learning) prime sur le code AC libre.

export type CriterionDisplayInput = {
  label: string;
  acCode: string | null;
  learning?: { code: string; label: string } | null;
};

/** Code affiché : celui de l'AC rattaché, sinon le code libre historique */
export function criterionCode(c: CriterionDisplayInput): string | null {
  return c.learning?.code ?? c.acCode ?? null;
}

/** Libellé officiel de l'AC, seulement s'il apporte une information (différent de l'intitulé du critère) */
export function learningHint(c: CriterionDisplayInput): string | null {
  if (!c.learning) return null;
  return c.learning.label.trim() === c.label.trim() ? null : c.learning.label;
}

/** Format « AC14.02 — libellé » */
export function acOptionLabel(code: string, label: string): string {
  return `${code} — ${label}`;
}

/** Code AC du référentiel : AC + niveau (1-3) + compétence (1-5) + « . » + numéro sur 2 chiffres */
export const AC_CODE_PATTERN = /^AC([1-3])([1-5])\.\d{2}$/;

/** Niveau et code de compétence déduits du code AC (« AC24.03 » → niveau 2, « C4 ») */
export function parseAcCode(code: string): { level: number; competenceCode: string } | null {
  const m = AC_CODE_PATTERN.exec(code);
  if (!m) return null;
  return { level: Number(m[1]), competenceCode: `C${m[2]}` };
}

/** Niveau de compétence attendu pour un semestre de BUT (S1-S2 → 1, S3-S4 → 2, S5-S6 → 3) */
export function levelForSemester(semester: number | null | undefined): number | null {
  if (!semester || semester < 1 || semester > 6) return null;
  return Math.ceil(semester / 2);
}

/** Couleur de compétence sûre pour un style inline (hex uniquement) */
export function safeColor(color: string | null | undefined): string | undefined {
  return color && /^#[0-9a-f]{3,8}$/i.test(color) ? color : undefined;
}
