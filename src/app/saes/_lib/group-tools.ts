// Outils de formation des groupes (fonctions pures, testées dans group-tools.test.ts).

const EMAIL = /[A-Za-z0-9._%+'-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
/** Un jeton « <adresse> » dépasse rarement 256 caractères ; au-delà, il est ignoré */
const MAX_TOKEN = 320;

/**
 * Extrait les adresses d'une liste collée (une par ligne, ou séparées par virgule / point-virgule,
 * y compris le format « Prénom Nom <adresse> » des clients de messagerie).
 * Renvoie les adresses uniques en minuscules et les entrées non reconnues.
 */
export function parseEmailList(text: string): { emails: string[]; invalid: string[] } {
  const emails = new Set<string>();
  const invalid: string[] = [];
  for (const raw of text.split(/[\n\r,;]+/)) {
    const entry = raw.trim();
    if (!entry) continue;
    let found = 0;
    // Regex appliquée jeton par jeton, sur des jetons courts : coût linéaire quelle que soit la saisie
    for (const token of entry.split(/\s+/)) {
      if (!token.includes("@") || token.length > MAX_TOKEN) continue;
      for (const e of token.match(EMAIL) ?? []) {
        emails.add(e.toLowerCase());
        found++;
      }
    }
    if (found === 0) invalid.push(entry.slice(0, 80));
  }
  return { emails: [...emails], invalid };
}

/** Mélange de Fisher-Yates (copie) */
export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Répartit aléatoirement en groupes d'au plus `size` personnes, de tailles équilibrées
 * (écart d'au plus 1) : 25 étudiants par 4 → 4,4,4,4,3,3,3.
 */
export function splitIntoGroups<T>(items: readonly T[], size: number, random: () => number = Math.random): T[][] {
  if (items.length === 0 || size < 1) return [];
  const count = Math.ceil(items.length / size);
  const groups: T[][] = Array.from({ length: count }, () => []);
  shuffle(items, random).forEach((item, i) => groups[i % count].push(item));
  return groups;
}

/** Prochains noms libres « Groupe n » (comparaison insensible à la casse, comme la base) */
export function nextGroupNames(existing: readonly string[], count: number, prefix = "Groupe"): string[] {
  const taken = new Set(existing.map((n) => n.trim().toLowerCase()));
  const names: string[] = [];
  for (let n = 1; names.length < count; n++) {
    const name = `${prefix} ${n}`;
    if (!taken.has(name.toLowerCase())) names.push(name);
  }
  return names;
}
