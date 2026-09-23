// Créneaux de soutenance : génération par lot (heure de Paris) et verrouillage à J-1.
import { parisLocalToDate } from "./dates";

/** Les réservations se figent 24 h avant le début du créneau (seule l'équipe peut encore modifier) */
export const DEFENSE_LOCK_MS = 24 * 60 * 60 * 1000;

export function isDefenseLocked(startsAt: Date, now: Date = new Date()): boolean {
  return startsAt.getTime() - now.getTime() < DEFENSE_LOCK_MS;
}

export type SlotBatch = {
  /** AAAA-MM-JJ (jour à Paris) */
  date: string;
  /** HH:mm (heure de Paris) */
  startTime: string;
  count: number;
  durationMin: number;
  breakMin: number;
};

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Heures de début d'une série de créneaux consécutifs le même jour, calculées
 * en heure murale de Paris (robuste aux changements d'heure).
 * Renvoie une erreur si la série déborde après minuit ou si la saisie est invalide.
 */
export function buildSlotStarts(batch: SlotBatch): { ok: true; starts: Date[] } | { ok: false; error: string } {
  const time = /^(\d{2}):(\d{2})$/.exec(batch.startTime);
  if (!time || !/^\d{4}-\d{2}-\d{2}$/.test(batch.date)) return { ok: false, error: "Date ou heure invalide." };
  const first = Number(time[1]) * 60 + Number(time[2]);
  if (Number(time[1]) > 23 || Number(time[2]) > 59) return { ok: false, error: "Heure invalide." };
  if (batch.count < 1 || batch.durationMin < 1 || batch.breakMin < 0) return { ok: false, error: "Paramètres invalides." };

  const step = batch.durationMin + batch.breakMin;
  const lastEnd = first + (batch.count - 1) * step + batch.durationMin;
  if (lastEnd > 24 * 60) return { ok: false, error: "Les créneaux dépassent minuit : réduisez leur nombre ou leur durée." };

  const starts: Date[] = [];
  for (let i = 0; i < batch.count; i++) {
    const minutes = first + i * step;
    const d = parisLocalToDate(`${batch.date}T${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`);
    if (!d || Number.isNaN(d.getTime())) return { ok: false, error: "Date invalide." };
    starts.push(d);
  }
  return { ok: true, starts };
}
