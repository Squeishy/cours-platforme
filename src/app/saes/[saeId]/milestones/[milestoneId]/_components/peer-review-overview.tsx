// Synthèse de la contribution entre pairs pour l'équipe pédagogique : membre × moyenne reçue.
import { contributionLabel } from "@/lib/assessment";
import {
  averageLevel,
  formatAverage,
  formatDateTime,
  PEER_LOW_THRESHOLD,
} from "@/app/assessments/_lib/shared";

type Member = { userId: string; name: string };
type Review = {
  reviewerId: string;
  revieweeId: string;
  contribution: number;
  comment: string | null;
  updatedAt: Date;
};

type Props = {
  groups: { id: string; name: string; members: Member[] }[];
  reviews: Review[];
  /** Détail « qui a noté qui » (canSeePeerReviews) */
  canSeeDetails: boolean;
  closesAt: Date | null;
};

function analyseGroup(members: Member[], reviews: Review[]) {
  const ids = new Set(members.map((m) => m.userId));
  const valid = reviews.filter((r) => r.reviewerId !== r.revieweeId && ids.has(r.reviewerId) && ids.has(r.revieweeId));
  const expected = members.length - 1;
  const rows = members.map((m) => {
    const received = valid.filter((r) => r.revieweeId === m.userId);
    const given = valid.filter((r) => r.reviewerId === m.userId);
    const avg = averageLevel(received.map((r) => r.contribution));
    const reasons: string[] = [];
    if (avg !== null && avg <= PEER_LOW_THRESHOLD) reasons.push("moyenne reçue ≤ 1,5");
    if (given.length < expected) reasons.push("n'a pas évalué tous ses coéquipiers");
    return { ...m, avg, received: received.length, given: given.length, reasons };
  });
  return { valid, expected, rows, flagged: rows.some((r) => r.reasons.length > 0) };
}

export function PeerReviewOverview({ groups, reviews, canSeeDetails, closesAt }: Props) {
  const nameById = new Map(groups.flatMap((g) => g.members.map((m) => [m.userId, m.name] as const)));
  const analysed = groups.map((g) => ({ group: g, ...analyseGroup(g.members, reviews) }));
  const flaggedCount = analysed.filter((a) => a.group.members.length > 1 && a.flagged).length;

  return (
    <section aria-labelledby="peer-overview-title" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="peer-overview-title" className="text-lg font-semibold">
          Contribution entre pairs
        </h2>
        <p className="max-w-prose text-sm text-muted">
          Moyenne des niveaux de contribution reçus (1 à 4). « À vérifier » : moyenne reçue ≤ 1,5 ou évaluation
          manquante.{" "}
          {closesAt ? `Saisie ouverte aux étudiant·e·s jusqu'au ${formatDateTime(closesAt)}.` : "Saisie ouverte sans limite (jalon sans échéance)."}
        </p>
        {groups.length > 0 && (
          <p className="text-sm">
            <strong>{flaggedCount}</strong> groupe{flaggedCount > 1 ? "s" : ""} à vérifier
          </p>
        )}
      </div>

      {groups.length === 0 ? (
        <p className="text-muted">Aucun groupe dans cette SAÉ pour l&apos;instant.</p>
      ) : (
        analysed.map(({ group, rows, valid, expected, flagged }) => (
          <div key={group.id} className="card flex flex-col gap-3">
            <h3 className="flex flex-wrap items-center gap-2 font-semibold">
              <span className="break-words">{group.name}</span>
              {group.members.length > 1 &&
                (flagged ? (
                  <span className="badge badge-warn">À vérifier</span>
                ) : (
                  <span className="badge badge-ok">Complet</span>
                ))}
            </h3>

            {group.members.length < 2 ? (
              <p className="text-sm text-muted">Moins de deux membres : pas d&apos;évaluation entre pairs.</p>
            ) : (
              <>
                {/* Mobile : cartes */}
                <ul className="flex flex-col gap-2 md:hidden">
                  {rows.map((row) => (
                    <li key={row.userId} className="rounded-md border border-line p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium break-words">{row.name}</span>
                        {row.reasons.length > 0 && <span className="badge badge-warn">À vérifier</span>}
                      </div>
                      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                        <dt className="text-muted">Moyenne reçue</dt>
                        <dd>{formatAverage(row.avg)}</dd>
                        <dt className="text-muted">Évaluations reçues</dt>
                        <dd>
                          {row.received}/{expected}
                        </dd>
                        <dt className="text-muted">Évaluations données</dt>
                        <dd>
                          {row.given}/{expected}
                        </dd>
                      </dl>
                      {row.reasons.length > 0 && <p className="mt-2 text-sm text-warn">{row.reasons.join(" · ")}</p>}
                    </li>
                  ))}
                </ul>

                {/* Tablette et plus : tableau */}
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full border-collapse text-left text-sm">
                    <caption className="sr-only">Contribution entre pairs — {group.name}</caption>
                    <thead>
                      <tr className="border-b border-line text-muted">
                        <th scope="col" className="py-2 pr-3 font-medium">Membre</th>
                        <th scope="col" className="py-2 pr-3 font-medium">Moyenne reçue</th>
                        <th scope="col" className="py-2 pr-3 font-medium">Reçues</th>
                        <th scope="col" className="py-2 pr-3 font-medium">Données</th>
                        <th scope="col" className="py-2 font-medium">Vigilance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.userId} className="border-b border-line align-top">
                          <th scope="row" className="py-2 pr-3 font-medium break-words">{row.name}</th>
                          <td className="py-2 pr-3 font-mono tabular-nums">{formatAverage(row.avg)}</td>
                          <td className="py-2 pr-3 font-mono tabular-nums">
                            {row.received}/{expected}
                          </td>
                          <td className="py-2 pr-3 font-mono tabular-nums">
                            {row.given}/{expected}
                          </td>
                          <td className="py-2">
                            {row.reasons.length > 0 ? (
                              <span className="flex flex-col items-start gap-1">
                                <span className="badge badge-warn">À vérifier</span>
                                <span className="text-warn">{row.reasons.join(" · ")}</span>
                              </span>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {canSeeDetails && (
                  <details className="rounded-md border border-line">
                    <summary className="flex min-h-11 cursor-pointer items-center px-3 text-sm font-medium">
                      Détail : qui a évalué qui ({valid.length})
                    </summary>
                    {valid.length === 0 ? (
                      <p className="border-t border-line p-3 text-sm text-muted">Aucune évaluation enregistrée.</p>
                    ) : (
                      <ul className="flex flex-col divide-y divide-line border-t border-line">
                        {valid.map((r) => (
                          <li key={`${r.reviewerId}-${r.revieweeId}`} className="flex flex-col gap-1 p-3 text-sm">
                            <span>
                              <span className="font-medium">{nameById.get(r.reviewerId) ?? "—"}</span>
                              <span aria-hidden="true"> → </span>
                              <span className="sr-only"> a évalué </span>
                              <span className="font-medium">{nameById.get(r.revieweeId) ?? "—"}</span> :{" "}
                              {r.contribution}/4 — {contributionLabel(r.contribution)}
                            </span>
                            {r.comment && <span className="break-words whitespace-pre-line text-muted">{r.comment}</span>}
                            <span className="text-xs text-muted">modifié le {formatDateTime(r.updatedAt)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </details>
                )}
              </>
            )}
          </div>
        ))
      )}
    </section>
  );
}
