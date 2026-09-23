// Génération d'un calendrier iCalendar (RFC 5545) — flux d'échéances abonnable
// depuis Google Agenda, Outlook, Thunderbird, Apple Calendrier.

export type IcsEvent = {
  /** Identifiant stable (ex. "milestone-<id>@cours-sae") */
  uid: string;
  title: string;
  start: Date;
  /** Fin ; par défaut start + 30 min */
  end?: Date;
  description?: string;
  location?: string;
  url?: string;
};

/** Échappement des valeurs TEXT (RFC 5545 §3.3.11) */
export function escapeText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Repli des lignes à 75 octets (RFC 5545 §3.1), sans couper un caractère UTF-8 */
export function foldLine(line: string) {
  const bytes = (s: string) => new TextEncoder().encode(s).length;
  if (bytes(line) <= 75) return line;
  const out: string[] = [];
  let current = "";
  for (const ch of line) {
    const limit = out.length === 0 ? 75 : 74; // les lignes suivantes commencent par un espace
    if (bytes(current + ch) > limit) {
      out.push(current);
      current = ch;
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out.map((l, i) => (i === 0 ? l : ` ${l}`)).join("\r\n");
}

/** Date UTC au format 20261016T160000Z */
export function formatUtc(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function buildIcs(calendarName: string, events: IcsEvent[], now = new Date()) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Cours et SAE//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(calendarName)}`,
    "X-WR-TIMEZONE:Europe/Paris",
    // Rafraîchissement conseillé : 1 h
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];
  for (const e of events) {
    const end = e.end ?? new Date(e.start.getTime() + 30 * 60 * 1000);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${escapeText(e.uid)}`,
      `DTSTAMP:${formatUtc(now)}`,
      `DTSTART:${formatUtc(e.start)}`,
      `DTEND:${formatUtc(end)}`,
      `SUMMARY:${escapeText(e.title)}`,
    );
    if (e.description) lines.push(`DESCRIPTION:${escapeText(e.description)}`);
    if (e.location) lines.push(`LOCATION:${escapeText(e.location)}`);
    if (e.url) lines.push(`URL:${e.url}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
