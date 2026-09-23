// Tableau de suivi (équipe pédagogique) : groupes × étudiant·e·s × auto-évaluation × retour enseignant.
import Link from "next/link";
import {
  averageLevel,
  countSignificantGaps,
  feedbackStatus,
  formatAverage,
  formatDate,
  type AssessmentStatusValue,
  type FeedbackStatus,
} from "@/app/assessments/_lib/shared";
import { FeedbackStatusBadge, StatusBadge } from "@/app/assessments/_lib/ui";

export type FollowUpAssessment = {
  id: string;
  userId: string;
  status: AssessmentStatusValue;
  submittedAt: Date | null;
  feedbackPublishedAt: Date | null;
  items: { level: number; teacherLevel: number | null; teacherComment: string | null }[];
  _count: { comments: number };
};

type Props = {
  saeId: string;
  requiresDepositUrl: boolean;
  groups: {
    id: string;
    name: string;
    depositCount: number;
    members: { userId: string; name: string }[];
  }[];
  assessmentByUser: Map<string, FollowUpAssessment>;
};

type Row = {
  userId: string;
  name: string;
  a: FollowUpAssessment | undefined;
  feedback: FeedbackStatus | null;
  selfAvg: number | null;
  teacherAvg: number | null;
  gaps: number;
};

function toRow(member: { userId: string; name: string }, a: FollowUpAssessment | undefined): Row {
  const items = a?.items ?? [];
  return {
    userId: member.userId,
    name: member.name,
    a,
    feedback: a?.status === "SUBMITTED" ? feedbackStatus(a) : null,
    selfAvg: averageLevel(items.map((i) => i.level)),
    teacherAvg: averageLevel(items.flatMap((i) => (i.teacherLevel != null ? [i.teacherLevel] : []))),
    gaps: countSignificantGaps(items),
  };
}

function GapCell({ gaps }: { gaps: number }) {
  return gaps > 0 ? (
    <span className="badge badge-warn">
      Écart important ({gaps} critère{gaps > 1 ? "s" : ""})
    </span>
  ) : (
    <span className="text-muted">—</span>
  );
}

export function FollowUp({ saeId, requiresDepositUrl, groups, assessmentByUser }: Props) {
  if (groups.length === 0) return <p className="text-muted">Aucun groupe dans cette SAÉ pour l&apos;instant.</p>;

  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => {
        const rows = group.members.map((m) => toRow(m, assessmentByUser.get(m.userId)));
        return (
          <div key={group.id} className="flex flex-col gap-2">
            <h3 className="flex flex-wrap items-center gap-2 text-base font-semibold">
              <Link href={`/saes/${saeId}/groups/${group.id}`} className="break-words hover:underline">
                {group.name}
              </Link>
              {requiresDepositUrl && (
                <span className={`badge ${group.depositCount > 0 ? "badge-ok" : "badge-danger"}`}>
                  {group.depositCount > 0
                    ? `${group.depositCount} URL déposée${group.depositCount > 1 ? "s" : ""}`
                    : "Aucune URL déposée"}
                </span>
              )}
            </h3>

            {rows.length === 0 ? (
              <p className="text-sm text-muted">Aucun membre.</p>
            ) : (
              <>
                {/* Mobile : cartes */}
                <ul className="flex flex-col gap-2 md:hidden">
                  {rows.map((row) => (
                    <li key={row.userId} className="card flex flex-col gap-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium break-words">{row.name}</span>
                        <StatusBadge status={row.a?.status ?? null} />
                      </div>
                      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                        <dt className="text-muted">Soumise le</dt>
                        <dd>{row.a?.submittedAt ? formatDate(row.a.submittedAt) : "—"}</dd>
                        <dt className="text-muted">Retour</dt>
                        <dd>{row.feedback ? <FeedbackStatusBadge status={row.feedback} /> : "—"}</dd>
                        <dt className="text-muted">Moy. auto</dt>
                        <dd>{formatAverage(row.selfAvg)}</dd>
                        <dt className="text-muted">Moy. enseignant</dt>
                        <dd>{formatAverage(row.teacherAvg)}</dd>
                        <dt className="text-muted">Écart</dt>
                        <dd>
                          <GapCell gaps={row.gaps} />
                        </dd>
                        <dt className="text-muted">Commentaires</dt>
                        <dd>{row.a?._count.comments ?? 0}</dd>
                      </dl>
                      {row.a && (
                        <Link href={`/assessments/${row.a.id}`} className="btn w-full">
                          {row.a.status === "SUBMITTED" ? "Ouvrir et positionner" : "Ouvrir l'auto-évaluation"}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>

                {/* Tablette et plus : tableau */}
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full border-collapse text-left text-sm">
                    <caption className="sr-only">Auto-évaluations et retours — groupe {group.name}</caption>
                    <thead>
                      <tr className="border-b border-line text-muted">
                        <th scope="col" className="py-2 pr-3 font-medium">Étudiant·e</th>
                        <th scope="col" className="py-2 pr-3 font-medium">Auto-évaluation</th>
                        <th scope="col" className="py-2 pr-3 font-medium">Retour</th>
                        <th scope="col" className="py-2 pr-3 font-medium">
                          <abbr title="Moyenne de l'auto-positionnement" className="no-underline">Auto</abbr>
                        </th>
                        <th scope="col" className="py-2 pr-3 font-medium">
                          <abbr title="Moyenne du positionnement enseignant" className="no-underline">Ens.</abbr>
                        </th>
                        <th scope="col" className="py-2 pr-3 font-medium">Écart</th>
                        <th scope="col" className="py-2 pr-3 font-medium">
                          <abbr title="Commentaires" className="no-underline">Comm.</abbr>
                        </th>
                        <th scope="col" className="py-2 font-medium">
                          <span className="sr-only">Action</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.userId} className="border-b border-line align-top">
                          <th scope="row" className="py-2 pr-3 font-medium break-words">
                            {row.name}
                          </th>
                          <td className="py-2 pr-3">
                            <span className="flex flex-col items-start gap-1">
                              <StatusBadge status={row.a?.status ?? null} />
                              {row.a?.submittedAt && (
                                <span className="text-xs text-muted">{formatDate(row.a.submittedAt)}</span>
                              )}
                            </span>
                          </td>
                          <td className="py-2 pr-3">
                            {row.feedback ? <FeedbackStatusBadge status={row.feedback} /> : <span className="text-muted">—</span>}
                          </td>
                          <td className="py-2 pr-3 font-mono whitespace-nowrap tabular-nums">{formatAverage(row.selfAvg)}</td>
                          <td className="py-2 pr-3 font-mono whitespace-nowrap tabular-nums">{formatAverage(row.teacherAvg)}</td>
                          <td className="py-2 pr-3">
                            <GapCell gaps={row.gaps} />
                          </td>
                          <td className="py-2 pr-3 font-mono tabular-nums">{row.a?._count.comments ?? 0}</td>
                          <td className="py-2">
                            {row.a ? (
                              <Link
                                href={`/assessments/${row.a.id}`}
                                className="inline-flex min-h-11 items-center text-accent underline"
                                aria-label={`Ouvrir l'auto-évaluation de ${row.name}`}
                              >
                                Ouvrir
                              </Link>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
