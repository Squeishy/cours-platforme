import { cx } from "./cx";

/**
 * CompetenceChip — code de compétence ou d'apprentissage critique + pastille de couleur.
 * La couleur est déduite du code (C1…C5, ou AC{niveau}{compétence}.{n°}, ex. AC14.02 → C4)
 * via les tokens --c1…--c5 (éclaircis en mode sombre). `color` sert de repli pour un code inconnu.
 *
 *   <CompetenceChip code="C4" label="Développer" />
 *   <CompetenceChip code="AC14.02" />
 */
export function competenceIndex(code: string): number | null {
  const c = /^C([1-5])$/i.exec(code.trim());
  if (c) return Number(c[1]);
  const ac = /^AC\d([1-5])\./i.exec(code.trim());
  return ac ? Number(ac[1]) : null;
}

type Props = {
  code: string;
  label?: string;
  /** Couleur de repli (hex) si le code n'est pas reconnu */
  color?: string | null;
  className?: string;
  /** Texte complet en infobulle (ex. libellé de l'AC) */
  title?: string;
};

export function CompetenceChip({ code, label, color, className, title }: Props) {
  const n = competenceIndex(code);
  const dot = n ? `var(--c${n})` : (color ?? "var(--muted)");
  return (
    <span
      title={title}
      className={cx(
        "inline-flex min-h-6 max-w-full items-center gap-1.5 rounded-full border border-line bg-surface px-2 text-xs text-ink",
        className,
      )}
    >
      <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: dot }} />
      <span className="font-mono font-medium whitespace-nowrap">{code}</span>
      {label && <span className="min-w-0 truncate text-muted">{label}</span>}
    </span>
  );
}
