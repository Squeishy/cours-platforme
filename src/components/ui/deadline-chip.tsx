import {
  deadline,
  formatDateShort,
  formatDateTime,
  formatTime,
  type DeadlineTone,
} from "@/lib/format";
import { cx } from "./cx";

/**
 * DeadlineChip — échéance relative en code mono (« J-3 », « Demain », « En retard »)
 * + date absolue lisible. Ton : warn < 72 h, danger en retard, ok si fait.
 *
 *   <DeadlineChip due={m.dueAt} />                       // J-3  lun. 12 oct. · 23:59
 *   <DeadlineChip due={m.dueAt} done showDate={false} />  // Fait (date en infobulle)
 *
 * Passer `now` depuis le serveur quand le composant est rendu dans un composant client
 * (évite un écart d'hydratation).
 */
const TONE_CLASS: Record<DeadlineTone, string> = {
  overdue: "border-transparent bg-danger-soft text-danger",
  soon: "border-transparent bg-warn-soft text-warn",
  later: "border-line bg-sunken text-ink",
  done: "border-transparent bg-ok-soft text-ok",
};

/** Texte lu par les lecteurs d'écran à la place de « J-3 » */
function spoken(label: string) {
  const m = /^J-(\d+)$/.exec(label);
  return m ? `Dans ${m[1]} jours` : label;
}

type Props = {
  due: Date;
  now?: Date;
  done?: boolean;
  /** Afficher la date absolue à côté (défaut : oui) */
  showDate?: boolean;
  className?: string;
};

export function DeadlineChip({
  due,
  now,
  done = false,
  showDate = true,
  className,
}: Props) {
  const { label, tone } = deadline(due, now, done);
  const iso = due.toISOString();
  const said = spoken(label);
  return (
    <span
      className={cx(
        "inline-flex flex-wrap items-baseline gap-x-2 gap-y-1",
        className,
      )}
    >
      <time
        dateTime={iso}
        title={`Échéance : ${formatDateTime(due)}`}
        className={cx(
          "inline-flex min-h-6 min-w-14 items-center justify-center rounded-sm border px-1.5 font-mono text-xs font-medium whitespace-nowrap tabular-nums",
          TONE_CLASS[tone],
        )}
      >
        <span aria-hidden={said !== label ? true : undefined}>{label}</span>
        {said !== label && <span className="sr-only">{said}</span>}
      </time>
      {/* Date absolue : jamais uniquement dans l'infobulle (WCAG 1.3.1 / 1.4.13) */}
      <span
        className={cx(
          "text-sm whitespace-nowrap text-muted",
          !showDate && "sr-only sm:not-sr-only",
        )}
      >
        <span className="sr-only">échéance le </span>
        {formatDateShort(due)} · {formatTime(due)}
      </span>
    </span>
  );
}
