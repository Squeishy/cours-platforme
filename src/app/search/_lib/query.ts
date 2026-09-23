// Recherche plein texte — fonctions pures (testées dans query.test.ts).

/** Longueur minimale d'un mot indexé par InnoDB (innodb_ft_min_token_size = 3 par défaut) */
export const MIN_FULLTEXT_TERM = 3;
const MAX_TERMS = 8;
const MAX_TERM_LENGTH = 40;
export const MAX_QUERY_LENGTH = 200;

export type SearchPlan =
  | { kind: "empty" }
  /** MATCH … AGAINST (… IN BOOLEAN MODE) sur les mots ≥ 3 caractères, préfixés « * » */
  | { kind: "fulltext"; boolean: string; terms: string[]; anchor: string }
  /** Uniquement des mots courts (« UX », « C1 ») : LIKE %…% (tous les mots requis) */
  | { kind: "like"; terms: string[]; anchor: string };

/**
 * Découpe la saisie en mots : tout ce qui n'est ni lettre ni chiffre sépare les mots,
 * ce qui retire aussi les opérateurs booléens (+ - < > ( ) ~ * " @).
 */
export function parseTerms(raw: string): string[] {
  const seen = new Set<string>();
  const terms: string[] = [];
  for (const word of raw.normalize("NFC").slice(0, MAX_QUERY_LENGTH).split(/[^\p{L}\p{N}_]+/u)) {
    const term = word.slice(0, MAX_TERM_LENGTH);
    const key = term.toLowerCase();
    if (!term || seen.has(key)) continue;
    seen.add(key);
    terms.push(term);
    if (terms.length >= MAX_TERMS) break;
  }
  return terms;
}

export function planSearch(raw: string): SearchPlan {
  const terms = parseTerms(raw);
  if (terms.length === 0) return { kind: "empty" };
  const long = terms.filter((t) => [...t].length >= MIN_FULLTEXT_TERM);
  if (long.length > 0) {
    // Le mot le plus long sert d'ancre pour extraire un passage autour de la correspondance
    const anchor = [...long].sort((a, b) => b.length - a.length)[0];
    return { kind: "fulltext", boolean: long.map((t) => `${t}*`).join(" "), terms: long, anchor };
  }
  return { kind: "like", terms, anchor: terms[0] };
}

/** Motif LIKE « contient », avec « ! » comme caractère d'échappement (… LIKE ? ESCAPE '!') */
export function likePattern(term: string) {
  return `%${term.replace(/[!%_]/g, (c) => `!${c}`)}%`;
}

/** Markdown → texte brut lisible (passage de résultat, jamais interprété comme HTML) */
export function stripMarkdown(md: string) {
  return md
    .replace(/```[^\n]*\n?/g, " ")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>\n]*>/g, " ")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?/gm, "")
    .replace(/^\s*\|?(?:\s*:?-{3,}:?\s*\|)+\s*:?-*:?\s*$/gm, " ")
    .replace(/\\([\\`*_{}[\]()#+\-.!|>~])/g, "$1")
    .replace(/[`*_~|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Forme « pliée » (minuscules, sans accents) avec correspondance vers les indices du texte d'origine */
function fold(text: string) {
  let folded = "";
  const map: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const f = text[i].normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
    for (const ch of f) {
      folded += ch;
      map.push(i);
    }
  }
  map.push(text.length);
  return { folded, map };
}

function foldTerm(term: string) {
  return term.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

export type SnippetPart = { text: string; match: boolean };

/** Plages [début, fin[ des occurrences des mots (insensible à la casse et aux accents), fusionnées */
export function matchRanges(text: string, terms: string[]): [number, number][] {
  const { folded, map } = fold(text);
  const ranges: [number, number][] = [];
  for (const term of terms.map(foldTerm).filter(Boolean)) {
    let from = 0;
    while (from <= folded.length - term.length) {
      const at = folded.indexOf(term, from);
      if (at === -1) break;
      ranges.push([map[at], map[at + term.length - 1] + 1]);
      from = at + term.length;
    }
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([r[0], r[1]]);
  }
  return merged;
}

/**
 * Passage d'environ `size` caractères autour de la première occurrence, découpé en segments
 * (match = à surligner). Rendu en texte par React : aucun HTML n'est interprété.
 */
export function makeSnippet(source: string, terms: string[], size = 200): SnippetPart[] {
  const text = stripMarkdown(source);
  if (!text) return [];
  const ranges = matchRanges(text, terms);
  const first = ranges[0]?.[0] ?? 0;

  let start = Math.max(0, first - Math.floor(size / 3));
  let end = Math.min(text.length, start + size);
  if (end - start < size) start = Math.max(0, end - size);
  // Couper sur des espaces pour ne pas tronquer un mot
  if (start > 0) {
    const space = text.indexOf(" ", start);
    if (space !== -1 && space < first) start = space + 1;
  }
  if (end < text.length) {
    const space = text.lastIndexOf(" ", end);
    if (space > start && space > first) end = space;
  }

  const parts: SnippetPart[] = [];
  const push = (t: string, match: boolean) => {
    if (t) parts.push({ text: t, match });
  };
  if (start > 0) push("… ", false);
  let cursor = start;
  for (const [a, b] of ranges) {
    if (b <= start || a >= end) continue;
    const from = Math.max(a, start);
    const to = Math.min(b, end);
    push(text.slice(cursor, from), false);
    push(text.slice(from, to), true);
    cursor = to;
  }
  push(text.slice(cursor, end), false);
  if (end < text.length) push(" …", false);
  return parts;
}
