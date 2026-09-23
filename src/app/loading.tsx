/** Squelette statique (pas d'animation, cf. DESIGN.md « Mouvement ») ; annonce polie « Chargement… » */
export default function Loading() {
  return (
    <div aria-busy="true" className="flex flex-col gap-8">
      <p role="status" className="eyebrow">
        Chargement…
      </p>
      <div aria-hidden="true" className="flex flex-col gap-3">
        <div className="skeleton h-8 w-2/3 max-w-md" />
        <div className="skeleton h-4 w-full max-w-prose" />
        <div className="skeleton h-4 w-4/5 max-w-prose" />
      </div>
      <ul aria-hidden="true" className="flex flex-col divide-y divide-line border-t border-line">
        {[0, 1, 2, 3].map((i) => (
          <li key={i} className="grid gap-2 py-4 sm:grid-cols-[5.5rem_minmax(0,1fr)] sm:items-center sm:gap-4">
            <div className="skeleton h-6 w-14" />
            <div className="flex flex-col gap-2">
              <div className="skeleton h-4 w-1/2" />
              <div className="skeleton h-3 w-1/3" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
