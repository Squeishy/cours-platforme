// Logique pure du flux calendrier ICS (testée dans calendar.test.ts).
// Imports relatifs : ce module est testé par vitest sans alias « @/ ».
import type { IcsEvent } from "../../../../lib/ics";
import { formatDateTime } from "../../../../lib/format";
import { isTokenShape } from "../../../../lib/tokens";

const DAY_MS = 86_400_000;

/** Fenêtre du flux : 30 jours passés, 12 mois à venir */
export function calendarWindow(now: Date) {
  return { from: new Date(now.getTime() - 30 * DAY_MS), to: new Date(now.getTime() + 365 * DAY_MS) };
}

/** Jeton lu dans l'URL ; le suffixe « .ics » est toléré (certains clients l'exigent) */
export function parseCalendarToken(raw: string): string | null {
  const token = raw.endsWith(".ics") ? raw.slice(0, -4) : raw;
  return isTokenShape(token) ? token : null;
}

/** URL publique de l'application (BETTER_AUTH_URL), sinon l'origine de la requête ; sans slash final */
export function resolveBaseUrl(envUrl: string | undefined, fallbackOrigin: string) {
  for (const candidate of [envUrl, fallbackOrigin]) {
    if (!candidate) continue;
    try {
      const u = new URL(candidate);
      if (u.protocol === "https:" || u.protocol === "http:") return `${u.origin}${u.pathname}`.replace(/\/+$/, "");
    } catch {
      // candidat suivant
    }
  }
  return "";
}

/** Adresse d'abonnement : https (Google, Outlook, Thunderbird) et webcal (Apple, ouverture directe) */
export function calendarFeedUrls(baseUrl: string, token: string) {
  const https = `${baseUrl}/api/calendar/${token}`;
  return { https, webcal: https.replace(/^https?:\/\//, "webcal://") };
}

type SaeRef = { id: string; code: string | null; title: string };

function saeShort(sae: SaeRef) {
  return sae.code ?? sae.title;
}

function saeLong(sae: SaeRef) {
  return sae.code ? `${sae.code} — ${sae.title}` : sae.title;
}

export type CalendarMilestone = { id: string; title: string; dueAt: Date; sae: SaeRef };

/** Échéance de jalon : événement ponctuel (début = fin = échéance), comme les exports Moodle */
export function milestoneEvent(m: CalendarMilestone, baseUrl: string): IcsEvent {
  const url = `${baseUrl}/saes/${m.sae.id}/milestones/${m.id}`;
  return {
    uid: `milestone-${m.id}@cours-sae`,
    title: `${saeShort(m.sae)} · ${m.title}`,
    start: m.dueAt,
    end: m.dueAt,
    description: `Échéance du jalon « ${m.title} »\nSAÉ : ${saeLong(m.sae)}\nÀ rendre avant le ${formatDateTime(m.dueAt)}\n${url}`,
    url,
  };
}

export type CalendarSlot = {
  id: string;
  startsAt: Date;
  durationMin: number;
  location: string | null;
  sae: SaeRef;
  group: { name: string } | null;
};

/** Créneau de soutenance ; le nom du groupe n'est ajouté que pour l'équipe pédagogique */
export function defenseEvent(s: CalendarSlot, baseUrl: string, withGroup: boolean): IcsEvent {
  const url = `${baseUrl}/saes/${s.sae.id}/defenses`;
  const group = withGroup && s.group ? ` · ${s.group.name}` : "";
  const minutes = Math.min(Math.max(s.durationMin, 5), 480);
  return {
    uid: `defense-${s.id}@cours-sae`,
    title: `Soutenance · ${saeShort(s.sae)}${group}`,
    start: s.startsAt,
    end: new Date(s.startsAt.getTime() + minutes * 60_000),
    description: `Soutenance — SAÉ : ${saeLong(s.sae)}${withGroup && s.group ? `\nGroupe : ${s.group.name}` : ""}\n${url}`,
    location: s.location ?? undefined,
    url,
  };
}
