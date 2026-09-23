// Portfolio regroupé par compétence → AC : traces personnelles + traces issues des SAÉ.
// Composant serveur partagé par /me/portfolio (propriétaire), /students/[userId] (équipe) et /p/portfolio (public).
// Toujours placé sous un titre h2 de la page : compétences en h3, AC en h4, rubriques en h5.
import Link from "next/link";
import { PROVIDER_LABELS } from "@/lib/deposit";
import { formatDate } from "@/lib/format";
import type { EvidenceRow, Portfolio, SaeTrace } from "../_lib/profile";
import { CompetenceDot, ExternalLink, LevelPill, LinkCheckStatusView } from "./ui";

type Props = {
  portfolio: Portfolio;
  /** public : ni niveaux enseignant, ni lien vers les auto-évaluations, ni état des liens */
  mode: "owner" | "staff" | "public";
  /** Lien vers l'auto-évaluation autorisé pour cette trace ? */
  canOpenAssessment?: (trace: SaeTrace) => boolean;
  /** Contrôles d'édition d'une trace (propriétaire uniquement) */
  renderEvidenceActions?: (evidence: EvidenceRow) => React.ReactNode;
  emptyMessage: React.ReactNode;
};

export function PortfolioSections({ portfolio, mode, canOpenAssessment, renderEvidenceActions, emptyMessage }: Props) {
  const isPublic = mode === "public";
  const competences = portfolio.referentiel
    .map((c) => ({
      ...c,
      learnings: c.learnings.filter(
        (l) => portfolio.evidencesByLearning.has(l.id) || portfolio.tracesByLearning.has(l.id),
      ),
    }))
    .filter((c) => c.learnings.length > 0);

  if (competences.length === 0) {
    return <div className="card text-muted">{emptyMessage}</div>;
  }

  return (
    <div className="flex flex-col gap-8">
      {competences.map((c) => {
        const evidenceCount = c.learnings.reduce((n, l) => n + (portfolio.evidencesByLearning.get(l.id)?.length ?? 0), 0);
        const traceCount = c.learnings.reduce((n, l) => n + (portfolio.tracesByLearning.get(l.id)?.length ?? 0), 0);
        return (
          <section key={c.id} aria-labelledby={`pf-${c.code}`} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1 border-b border-line pb-2">
              <h3 id={`pf-${c.code}`} className="flex flex-wrap items-center gap-2 text-lg font-semibold">
                <CompetenceDot color={c.color} />
                <span className="font-mono text-base">{c.code}</span>
                <span>{c.name}</span>
              </h3>
              <p className="font-mono text-xs text-muted tabular-nums">
                {c.learnings.length} AC documenté{c.learnings.length > 1 ? "s" : ""} · {evidenceCount} trace
                {evidenceCount > 1 ? "s" : ""} personnelle{evidenceCount > 1 ? "s" : ""} · {traceCount} trace
                {traceCount > 1 ? "s" : ""} SAÉ
              </p>
            </div>

            <ul className="flex flex-col gap-3">
              {c.learnings.map((l) => {
                const evidences = portfolio.evidencesByLearning.get(l.id) ?? [];
                const traces = portfolio.tracesByLearning.get(l.id) ?? [];
                const latest = portfolio.latestByLearning.get(l.id);
                return (
                  <li key={l.id} id={`ac-${l.code}`} className="card flex scroll-mt-4 flex-col gap-4 print:break-inside-avoid">
                    <div className="flex flex-col gap-2">
                      <h4 className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-semibold">{l.code}</span>
                        <span className="badge font-mono">Niv. {l.level}</span>
                        {l.parcours && <span className="badge">{l.parcours}</span>}
                      </h4>
                      <p className="text-sm">{l.label}</p>
                      <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
                        <span>Dernier positionnement :</span>
                        <LevelPill level={latest?.self?.level ?? null} />
                        {!isPublic && <LevelPill level={latest?.teacher?.level ?? null} who="Ens." />}
                      </p>
                    </div>

                    {evidences.length > 0 && (
                      <div className="flex flex-col gap-2">
                        <h5 className="eyebrow">Traces personnelles</h5>
                        <ul className="flex flex-col divide-y divide-line">
                          {evidences.map((e) => (
                            <li key={e.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
                              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                                <p className="font-medium break-words">
                                  {e.url ? <ExternalLink href={e.url} className="text-accent underline break-words">{e.title}</ExternalLink> : e.title}
                                </p>
                                <LevelPill level={e.level} />
                                <span className="text-xs text-muted">
                                  mis à jour le <time dateTime={e.updatedAt.toISOString()}>{formatDate(e.updatedAt)}</time>
                                </span>
                              </div>
                              {e.url && <p className="font-mono text-xs break-all text-muted print:text-ink">{e.url}</p>}
                              {e.reflection && (
                                <p className="max-w-prose text-sm whitespace-pre-line">{e.reflection}</p>
                              )}
                              {renderEvidenceActions?.(e)}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {traces.length > 0 && (
                      <div className="flex flex-col gap-2">
                        <h5 className="eyebrow">Traces issues des SAÉ</h5>
                        <ul className="flex flex-col divide-y divide-line">
                          {traces.map((t) => (
                            <li key={t.key} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
                              <div className="flex flex-col gap-1">
                                <p className="font-mono text-xs text-muted">
                                  {t.saeCode ? `${t.saeCode} · ` : ""}
                                  {t.saeTitle}
                                </p>
                                <p className="font-medium break-words">
                                  {t.milestoneTitle}
                                  <span className="font-normal text-muted"> — {t.criterionLabel}</span>
                                </p>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <LevelPill level={t.selfLevel} />
                                {!isPublic && <LevelPill level={t.teacherLevel} who="Ens." />}
                                <span className="text-xs text-muted">
                                  soumise le <time dateTime={t.submittedAt.toISOString()}>{formatDate(t.submittedAt)}</time>
                                </span>
                                {!isPublic && canOpenAssessment?.(t) && (
                                  <Link
                                    href={`/assessments/${t.assessmentId}`}
                                    className="inline-flex min-h-11 items-center px-1 text-sm text-accent underline print:hidden"
                                  >
                                    Voir l&apos;auto-évaluation
                                  </Link>
                                )}
                              </div>
                              {t.links.length > 0 && (
                                <ul className="flex flex-col gap-2">
                                  {t.links.map((link) => (
                                    <li key={link.id} className="flex flex-wrap items-center gap-2 text-sm">
                                      <span className="badge">{PROVIDER_LABELS[link.provider]}</span>
                                      <ExternalLink href={link.url}>{link.label ?? link.url}</ExternalLink>
                                      {!isPublic && <LinkCheckStatusView status={link.checkStatus} compact />}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
