import type { ReactNode } from "react";

/** Gabarit des pages d'état (404, 403, erreur) : code mono, titre, explication utile, actions */
export function StatusView({
  code,
  title,
  children,
  actions,
}: {
  code: string;
  title: string;
  children: ReactNode;
  actions: ReactNode;
}) {
  return (
    <div className="flex max-w-2xl flex-col gap-4 py-4 md:py-10">
      <p className="eyebrow">{code}</p>
      <h1 className="text-2xl font-semibold md:text-3xl">{title}</h1>
      <div className="flex max-w-prose flex-col gap-2 text-muted">{children}</div>
      <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:flex-wrap">{actions}</div>
    </div>
  );
}
