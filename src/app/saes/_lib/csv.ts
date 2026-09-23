// Export CSV compatible Excel FR : BOM UTF-8, séparateur « ; », fins de ligne CRLF.
// Les cellules qui commencent par = + - @ (ou tabulation / retour chariot) sont préfixées
// d'une apostrophe pour neutraliser l'injection de formules.

export const CSV_BOM = "﻿";
const FORMULA_START = /^[=+\-@\t\r]/;
const NEEDS_QUOTES = /[";\r\n]/;

export type CsvValue = string | null | undefined;

export function csvCell(value: CsvValue): string {
  if (value === null || value === undefined || value === "") return "";
  let s = String(value);
  if (FORMULA_START.test(s)) s = `'${s}`;
  if (NEEDS_QUOTES.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(rows: readonly (readonly CsvValue[])[]): string {
  return CSV_BOM + rows.map((row) => row.map(csvCell).join(";")).join("\r\n") + "\r\n";
}

const decimal = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2, useGrouping: false });

/** Moyenne au format français (« 2,5 »), chaîne vide sans valeur */
export function formatAverage(values: readonly number[]): string {
  if (values.length === 0) return "";
  return decimal.format(values.reduce((sum, v) => sum + v, 0) / values.length);
}
