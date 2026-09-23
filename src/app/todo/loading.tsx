export default function TodoLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <p role="status" className="sr-only">
        Chargement de vos tâches…
      </p>
      <div aria-hidden="true" className="flex flex-col gap-2">
        <div className="h-3 w-40 animate-pulse rounded bg-sunken" />
        <div className="h-7 w-32 animate-pulse rounded bg-sunken" />
      </div>
      {[0, 1, 2].map((section) => (
        <div key={section} aria-hidden="true" className="flex flex-col gap-2">
          <div className="h-5 w-36 animate-pulse rounded bg-sunken" />
          <div className="flex flex-col divide-y divide-line rounded-md border border-line bg-surface">
            {[0, 1].map((row) => (
              <div key={row} className="flex flex-col gap-2 px-4 py-3">
                <div className="h-4 w-16 animate-pulse rounded bg-sunken" />
                <div className="h-4 w-3/4 animate-pulse rounded bg-sunken" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
