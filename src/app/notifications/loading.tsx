export default function NotificationsLoading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6" aria-busy="true">
      <p role="status" className="sr-only">
        Chargement des notifications…
      </p>
      <div aria-hidden="true" className="flex flex-col gap-2">
        <div className="h-3 w-16 animate-pulse rounded bg-sunken" />
        <div className="h-7 w-44 animate-pulse rounded bg-sunken" />
      </div>
      <div aria-hidden="true" className="flex flex-col divide-y divide-line rounded-md border border-line bg-surface">
        {[0, 1, 2, 3, 4].map((row) => (
          <div key={row} className="flex flex-col gap-2 px-4 py-3">
            <div className="h-3 w-24 animate-pulse rounded bg-sunken" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-sunken" />
          </div>
        ))}
      </div>
    </div>
  );
}
