// Dates des SAÉ : saisies et affichées en heure de Paris, quel que soit le fuseau du serveur.

export const APP_TIME_ZONE = "Europe/Paris";

type Parts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function parisParts(date: Date): Parts {
  const parts = partsFormatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

/** Décalage (ms) de l'heure de Paris par rapport à UTC à cet instant */
function parisOffsetMs(date: Date): number {
  const p = parisParts(date);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - (date.getTime() - date.getMilliseconds());
}

/**
 * Convertit la valeur d'un `<input type="date">` (AAAA-MM-JJ) ou
 * `<input type="datetime-local">` (AAAA-MM-JJTHH:mm) saisie en heure de Paris.
 * Renvoie null si le format ne correspond pas.
 */
export function parisLocalToDate(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(value);
  if (!m) return null;
  const guess = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] ?? 0), Number(m[5] ?? 0));
  let ts = guess - parisOffsetMs(new Date(guess));
  ts = guess - parisOffsetMs(new Date(ts));
  return new Date(ts);
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Valeur par défaut d'un `<input type="date">` */
export function toInputDate(date: Date | null | undefined): string {
  if (!date) return "";
  const p = parisParts(date);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** Valeur par défaut d'un `<input type="datetime-local">` */
export function toInputDateTime(date: Date | null | undefined): string {
  if (!date) return "";
  const p = parisParts(date);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

const dateFormatter = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: APP_TIME_ZONE });
const dateTimeFormatter = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: APP_TIME_ZONE,
});

export function formatDate(date: Date): string {
  return dateFormatter.format(date);
}

export function formatDateTime(date: Date): string {
  return dateTimeFormatter.format(date);
}

/** « Du 3 février 2026 au 14 mars 2026 », « À partir du … », « Jusqu'au … » ou null */
export function formatDateRange(start: Date | null, end: Date | null): string | null {
  if (start && end) return `Du ${formatDate(start)} au ${formatDate(end)}`;
  if (start) return `À partir du ${formatDate(start)}`;
  if (end) return `Jusqu'au ${formatDate(end)}`;
  return null;
}

/**
 * Décale une date d'un nombre de jours en conservant l'heure murale de Paris
 * (une échéance à 18 h reste à 18 h de l'autre côté d'un changement d'heure).
 */
export function addParisDays(date: Date, days: number): Date {
  const p = parisParts(date);
  const shifted = new Date(Date.UTC(p.year, p.month - 1, p.day + days, p.hour, p.minute));
  const local = `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}T${pad(
    shifted.getUTCHours(),
  )}:${pad(shifted.getUTCMinutes())}`;
  return parisLocalToDate(local) ?? new Date(date.getTime() + days * 86_400_000);
}
