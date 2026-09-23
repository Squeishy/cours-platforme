// Petits composants d'affichage sans état, partagés par le périmètre portfolio / vitrine / groupes.
import Link from "next/link";
import { levelLabel } from "@/lib/assessment";
import { LINK_STATUS_LABELS, type LinkCheckStatus } from "@/lib/link-check-core";
import { timeAgo } from "@/lib/format";

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 items-center gap-1 self-start text-sm text-muted hover:text-ink hover:underline print:hidden"
    >
      <span aria-hidden="true">←</span>
      {children}
    </Link>
  );
}

/** Lien externe (dépôt, trace, projet) : nouvel onglet, sans référent ni transmission de réputation */
export function ExternalLink({
  href,
  children,
  className = "text-accent underline break-all",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow" className={className}>
      {children}
      <span className="sr-only"> (s&apos;ouvre dans un nouvel onglet)</span>
    </a>
  );
}

/** Niveau 1..4 : texte explicite, la couleur n'est qu'un complément */
export function LevelPill({ level, who = "Auto" }: { level: number | null; who?: "Auto" | "Ens." }) {
  if (level == null) {
    return <span className="badge font-mono tabular-nums">{who} —</span>;
  }
  const tone = who === "Auto" ? "badge-accent" : "badge-ok";
  return (
    <span className={`badge ${tone} font-mono tabular-nums`} title={levelLabel(level)}>
      {who} {level}/4<span className="sr-only"> ({levelLabel(level)})</span>
    </span>
  );
}

const LINK_TONES: Record<LinkCheckStatus, string> = {
  OK: "badge-ok",
  PRIVATE: "badge-warn",
  BROKEN: "badge-danger",
  UNREACHABLE: "badge-warn",
};

/** Résultat de vérification d'un lien de dépôt : pilule + explication + ancienneté */
export function LinkCheckStatusView({
  status,
  note,
  http,
  checkedAt,
  compact = false,
}: {
  status: LinkCheckStatus | null;
  note?: string | null;
  http?: number | null;
  checkedAt?: Date | null;
  compact?: boolean;
}) {
  if (!status) {
    return compact ? null : <span className="badge">Non vérifié</span>;
  }
  if (compact) {
    return <span className={`badge ${LINK_TONES[status]}`}>{LINK_STATUS_LABELS[status]}</span>;
  }
  return (
    <span className="flex flex-col gap-1">
      <span className="flex flex-wrap items-center gap-2">
        <span className={`badge ${LINK_TONES[status]}`}>{LINK_STATUS_LABELS[status]}</span>
        {http != null && <span className="font-mono text-xs text-muted tabular-nums">HTTP {http}</span>}
        {checkedAt && (
          <span className="text-xs text-muted">
            vérifié <time dateTime={checkedAt.toISOString()}>{timeAgo(checkedAt)}</time>
          </span>
        )}
      </span>
      {note && status !== "OK" && <span className="text-sm text-muted">{note}</span>}
    </span>
  );
}

const ASSESSMENT_STATUS: Record<"NONE" | "DRAFT" | "SUBMITTED", { label: string; tone: string }> = {
  NONE: { label: "Pas commencée", tone: "" },
  DRAFT: { label: "Brouillon", tone: "badge-warn" },
  SUBMITTED: { label: "Soumise", tone: "badge-ok" },
};

export function AssessmentStatusBadge({ status }: { status: "DRAFT" | "SUBMITTED" | null }) {
  const s = ASSESSMENT_STATUS[status ?? "NONE"];
  return <span className={`badge ${s.tone}`}>{s.label}</span>;
}

/** Pastille de couleur d'une compétence (décorative) */
export function CompetenceDot({ color }: { color: string | null }) {
  const safe = color && /^#[0-9a-f]{3,8}$/i.test(color) ? color : null;
  return (
    <span
      aria-hidden="true"
      className="inline-block size-3 shrink-0 rounded-full bg-muted"
      style={safe ? { backgroundColor: safe } : undefined}
    />
  );
}
