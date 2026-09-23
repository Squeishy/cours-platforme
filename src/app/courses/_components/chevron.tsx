/** Indicateur d'ouverture pour <summary> (le marqueur natif disparaît avec display:flex) — parent <details className="group"> */
export function Chevron() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      width="14"
      height="14"
      className="shrink-0 transition-transform duration-200 group-open:rotate-90"
    >
      <path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
