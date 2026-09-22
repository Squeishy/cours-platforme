// Petits composants d'affichage (sans état) réutilisés par les pages du slice.
import Link from "next/link";
import { levelLabel } from "@/lib/assessment";
import { LINK_STATUS_LABELS, type LinkCheckStatus } from "@/lib/link-check-core";
import {
  FEEDBACK_STATUS_LABELS,
  STATUS_LABELS,
  type AssessmentStatusValue,
  type CriterionView,
  type FeedbackStatus,
} from "./shared";

/** Badge de statut : le texte porte l'information, la couleur n'est qu'un complément */
export function StatusBadge({ status }: { status: AssessmentStatusValue | null }) {
  const key = status ?? "NONE";
  const tone = key === "SUBMITTED" ? "badge-ok" : key === "DRAFT" ? "badge-warn" : "";
  return <span className={`badge ${tone}`}>{STATUS_LABELS[key]}</span>;
}

/** Statut du retour enseignant : Non commencé / Brouillon / Publié */
export function FeedbackStatusBadge({ status }: { status: FeedbackStatus }) {
  const tone = status === "PUBLISHED" ? "badge-ok" : status === "DRAFT" ? "badge-warn" : "";
  return <span className={`badge ${tone}`}>{FEEDBACK_STATUS_LABELS[status]}</span>;
}

/**
 * Indicateur visuel 1..4 accompagné du texte (niveau + libellé).
 * `self` = auto-positionnement (accent), `teacher` = enseignant (encre) — le préfixe textuel distingue les deux.
 */
export function LevelMeter({
  level,
  tone = "self",
  prefix,
}: {
  level: number;
  tone?: "self" | "teacher";
  prefix?: string;
}) {
  const filled = tone === "teacher" ? "border-ink bg-ink" : "border-accent bg-accent";
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="inline-flex gap-1" aria-hidden="true">
        {[1, 2, 3, 4].map((step) => (
          <span
            key={step}
            className={`h-3 w-5 rounded-sm border ${step <= level ? filled : "border-line bg-bg"}`}
          />
        ))}
      </span>
      <span className="text-sm font-medium">
        {prefix ? `${prefix} : ` : ""}
        {level}/4 — {levelLabel(level)}
      </span>
    </span>
  );
}

/** Écart auto / enseignant ≥ 2 niveaux : signalé par un texte, pas seulement une couleur */
export function GapFlag({ self, teacher }: { self: number; teacher: number }) {
  return (
    <span className="badge badge-warn font-medium">
      Écart important · auto {self} / enseignant {teacher}
    </span>
  );
}

/** Code d'AC (référentiel prioritaire) + libellé du critère + intitulé de l'AC */
export function CriterionHeading({
  criterion,
  level = 3,
}: {
  criterion: Pick<CriterionView, "code" | "label" | "learningLabel">;
  level?: 3 | 4;
}) {
  const Heading = level === 3 ? "h3" : "h4";
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-baseline gap-2">
        {criterion.code && <span className="badge font-mono text-ink">{criterion.code}</span>}
        <Heading className="font-semibold break-words">{criterion.label}</Heading>
      </div>
      {criterion.learningLabel && <p className="text-sm break-words text-muted">{criterion.learningLabel}</p>}
    </div>
  );
}

/** Résultat de la vérification automatique d'un lien de dépôt */
export function LinkStatusBadge({ status, checkedAt }: { status: LinkCheckStatus | null; checkedAt?: Date | null }) {
  if (!status) return <span className="badge">Non vérifié</span>;
  const tone = status === "OK" ? "badge-ok" : status === "BROKEN" ? "badge-danger" : "badge-warn";
  return (
    <span
      className={`badge ${tone}`}
      title={checkedAt ? `Vérifié le ${checkedAt.toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}` : undefined}
    >
      {LINK_STATUS_LABELS[status]}
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
