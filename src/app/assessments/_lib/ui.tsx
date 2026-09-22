// Petits composants d'affichage (sans état) réutilisés par les pages du slice.
import Link from "next/link";
import { levelLabel } from "@/lib/assessment";
import { STATUS_LABELS, type AssessmentStatusValue } from "./shared";

/** Badge de statut : le texte porte l'information, la couleur n'est qu'un complément */
export function StatusBadge({ status }: { status: AssessmentStatusValue | null }) {
  const key = status ?? "NONE";
  const tone =
    key === "SUBMITTED" ? "border-ok text-ok" : key === "DRAFT" ? "border-accent text-accent" : "text-muted";
  return <span className={`badge ${tone}`}>{STATUS_LABELS[key]}</span>;
}

/** Indicateur visuel 1..4 accompagné du texte (niveau + libellé) */
export function LevelMeter({ level }: { level: number }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="inline-flex gap-1" aria-hidden="true">
        {[1, 2, 3, 4].map((step) => (
          <span
            key={step}
            className={`h-3 w-5 rounded-sm border ${step <= level ? "border-accent bg-accent" : "border-line bg-bg"}`}
          />
        ))}
      </span>
      <span className="text-sm font-medium">
        Niveau {level}/4 — {levelLabel(level)}
      </span>
    </span>
  );
}

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex min-h-11 items-center gap-1 text-sm text-muted hover:text-ink hover:underline">
      <span aria-hidden="true">←</span>
      {children}
    </Link>
  );
}
