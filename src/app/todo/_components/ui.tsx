// Petits composants d'affichage de la page « À faire » (sans état, rendus serveur).
import type { ReactNode } from "react";
import { DeadlineChip as UiDeadlineChip, EmptyState } from "@/components/ui";

/** Échéance (composant partagé) ; « Sans date » si le jalon n'a pas d'échéance */
export function DeadlineChip({ due, now, done = false, showDate = false }: { due: Date | null; now: Date; done?: boolean; showDate?: boolean }) {
  if (!due) return <span className="badge font-mono whitespace-nowrap">Sans date</span>;
  return <UiDeadlineChip due={due} now={now} done={done} showDate={showDate} />;
}

export function saeLabel(sae: { code: string | null; title: string }) {
  return sae.code ? `${sae.code} · ${sae.title}` : sae.title;
}

type SectionProps = {
  id: string;
  title: string;
  count?: number;
  hint?: string;
  action?: ReactNode;
  empty: ReactNode;
  children?: ReactNode;
  isEmpty: boolean;
  tone?: "danger" | "default";
};

/** Section titrée avec compteur mono et état vide explicite */
export function TodoSection({ id, title, count, hint, action, empty, children, isEmpty, tone = "default" }: SectionProps) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="flex scroll-mt-20 flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id={`${id}-title`} className={`text-lg font-semibold ${tone === "danger" && !isEmpty ? "text-danger" : ""}`}>
          {title}
          {count !== undefined && <span className="ml-2 font-mono text-sm font-normal text-muted tabular-nums">{count}</span>}
        </h2>
        {action}
      </div>
      {hint && <p className="text-sm text-muted">{hint}</p>}
      {isEmpty ? (
        <EmptyState>{empty}</EmptyState>
      ) : (
        <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-md border border-line bg-surface">{children}</ul>
      )}
    </section>
  );
}
