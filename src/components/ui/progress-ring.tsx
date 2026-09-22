import { cx } from "./cx";

/**
 * ProgressRing — anneau 14 px + « 3/5 » en mono (façon Linear).
 * L'anneau est décoratif ; le texte porte la valeur, `label` précise l'unité.
 *
 *   <ProgressRing value={3} max={5} label="jalons passés" />   // ◔ 3/5 jalons passés
 *   <ProgressRing value={3} max={5} label="jalons passés" hideLabel />  // libellé lu, non affiché
 */
type Props = {
  value: number;
  max: number;
  /** Unité, ex. « jalons passés » */
  label?: string;
  /** Garder le libellé pour les lecteurs d'écran seulement */
  hideLabel?: boolean;
  size?: number;
  className?: string;
};

export function ProgressRing({ value, max, label, hideLabel = false, size = 14, className }: Props) {
  const safeMax = Math.max(0, max);
  const v = Math.min(Math.max(0, value), safeMax);
  const ratio = safeMax === 0 ? 0 : v / safeMax;
  const complete = safeMax > 0 && v === safeMax;
  const r = 5;
  const c = 2 * Math.PI * r;
  return (
    <span className={cx("inline-flex items-center gap-1.5 whitespace-nowrap", className)}>
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 14 14"
        width={size}
        height={size}
        className={cx("shrink-0 -rotate-90", complete ? "text-ok" : "text-ink")}
      >
        <circle cx="7" cy="7" r={r} fill="none" stroke="var(--line-strong)" strokeOpacity="0.45" strokeWidth="2.2" />
        {ratio > 0 && (
          <circle
            cx="7"
            cy="7"
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap={complete ? "butt" : "round"}
            strokeDasharray={c}
            strokeDashoffset={c * (1 - ratio)}
          />
        )}
      </svg>
      <span className="font-mono text-xs font-medium tabular-nums">
        {v}/{safeMax}
      </span>
      {label && <span className={hideLabel ? "sr-only" : "text-sm text-muted"}>{label}</span>}
    </span>
  );
}
