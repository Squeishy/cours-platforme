import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { isStaff } from "@/lib/permissions";
import { LEVELS } from "@/lib/assessment";
import { isSignificantGap } from "@/lib/competences";
import { CompetenceRadar } from "@/components/competence-radar";
import { loadPortfolio, loadStudentParcours } from "@/app/me/portfolio/_lib/profile";
import { formatScore } from "@/app/me/portfolio/_lib/shared";
import { BackLink, CompetenceDot, LevelPill } from "@/app/me/portfolio/_components/ui";

export const metadata: Metadata = { title: "Mes compétences" };

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CompetencesPage({ searchParams }: PageProps<"/me/competences">) {
  const user = await requireUser();

  if (isStaff(user)) {
    return (
      <div className="flex flex-col gap-4">
        <BackLink href="/me">Mon espace</BackLink>
        <h1 className="text-2xl font-semibold">Compétences</h1>
        <div className="card flex flex-col gap-2">
          <p>Le profil de compétences se construit à partir des auto-évaluations et des traces des étudiants.</p>
          <p className="text-muted">
            Consultez le radar et le portfolio d&apos;un étudiant depuis la{" "}
            <Link href="/students" className="text-accent underline">
              liste des étudiants
            </Link>
            .
          </p>
        </div>
      </div>
    );
  }

  const sp = await searchParams;
  const showAll = one(sp.parcours) === "tous";

  const [portfolio, student] = await Promise.all([
    loadPortfolio(user.id, { includeTeacher: true }),
    loadStudentParcours(user.id),
  ]);
  const parcours = showAll ? null : student.parcours;
  const openLevel = student.year && student.year >= 1 && student.year <= 3 ? student.year : 1;
  const scoreByCode = new Map(portfolio.scores.map((s) => [s.code, s]));
  const hasData = portfolio.scores.some((s) => s.self != null || s.teacher != null);

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-3">
        <BackLink href="/me">Mon espace</BackLink>
        <p className="eyebrow font-mono">Référentiel BUT MMI · 5 compétences</p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-2xl font-semibold text-balance">Mes compétences</h1>
          <Link href="/me/portfolio" className="btn">
            Mon portfolio
          </Link>
        </div>
        <p className="max-w-prose text-muted">
          Votre radar agrège, pour chaque apprentissage critique (AC), votre dernier auto-positionnement — issu des
          auto-évaluations de SAÉ et des traces de votre portfolio — et le positionnement de l&apos;enseignant une fois
          publié.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-start">
        <section aria-labelledby="radar-title" className="card flex flex-col gap-3">
          <h2 id="radar-title" className="text-lg font-semibold">
            Profil
          </h2>
          <CompetenceRadar id="me-radar" scores={portfolio.scores} title="Mon profil de compétences" />
          {!hasData && (
            <p className="text-sm">
              <Link href="/me/portfolio#nouvelle-trace" className="text-accent underline">
                Ajouter une première trace
              </Link>{" "}
              ou soumettez une auto-évaluation de SAÉ.
            </p>
          )}
        </section>

        <section aria-labelledby="scale-title" className="card flex flex-col gap-3">
          <h2 id="scale-title" className="text-lg font-semibold">
            Lire l&apos;échelle
          </h2>
          <dl className="flex flex-col gap-2 text-sm">
            {LEVELS.map((l) => (
              <div key={l.value} className="flex gap-3">
                <dt className="w-6 shrink-0 font-mono font-semibold tabular-nums">{l.value}</dt>
                <dd>
                  <span className="font-medium">{l.label}</span> — <span className="text-muted">{l.hint}</span>
                </dd>
              </div>
            ))}
          </dl>
          <p className="text-sm text-muted">
            Les niveaux de compétence 1, 2 et 3 du référentiel correspondent à peu près aux trois années de BUT. Un
            écart d&apos;au moins 2 points entre vous et l&apos;enseignant est signalé : c&apos;est un bon sujet
            d&apos;échange.
          </p>
          <Link href="/aide" className="inline-flex min-h-11 items-center self-start text-sm text-accent underline">
            En savoir plus dans l&apos;aide
          </Link>
        </section>
      </div>

      <section aria-labelledby="ac-title" className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h2 id="ac-title" className="text-xl font-semibold">
            Apprentissages critiques
          </h2>
          <p className="text-sm text-muted">
            {student.parcours ? (
              showAll ? (
                <>
                  Tous les parcours sont affichés.{" "}
                  <Link href="/me/competences" className="text-accent underline">
                    N&apos;afficher que le parcours {student.parcours}
                  </Link>
                </>
              ) : (
                <>
                  Tronc commun et parcours {student.parcours} (d&apos;après votre promo).{" "}
                  <Link href="/me/competences?parcours=tous" className="text-accent underline">
                    Afficher tous les parcours
                  </Link>
                </>
              )
            ) : (
              "Tous les AC du référentiel (tronc commun et parcours)."
            )}
          </p>
        </div>

        {portfolio.referentiel.length === 0 && (
          <p className="card text-muted">Le référentiel de compétences n&apos;est pas encore chargé.</p>
        )}

        {portfolio.referentiel.map((c) => {
          const score = scoreByCode.get(c.code);
          const learnings = c.learnings.filter((l) => !parcours || !l.parcours || l.parcours === parcours);
          const levels = [...new Set(learnings.map((l) => l.level))].sort((a, b) => a - b);
          const gap = isSignificantGap(score?.self, score?.teacher);
          return (
            <section key={c.id} aria-labelledby={`comp-${c.code}`} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1 border-b border-line pb-2">
                <h3 id={`comp-${c.code}`} className="flex flex-wrap items-center gap-2 text-lg font-semibold">
                  <CompetenceDot color={c.color} />
                  <span className="font-mono text-base">{c.code}</span>
                  <span>{c.name}</span>
                </h3>
                {c.description && <p className="max-w-prose text-sm text-muted">{c.description}</p>}
                <p className="flex flex-wrap items-center gap-2 font-mono text-xs text-muted tabular-nums">
                  <span>
                    moyenne auto {formatScore(score?.self)} · ens. {formatScore(score?.teacher)} ·{" "}
                    {score?.learnings ?? 0} AC observé{(score?.learnings ?? 0) > 1 ? "s" : ""}
                  </span>
                  {gap && <span className="badge badge-warn">Écart auto / enseignant ≥ 2</span>}
                </p>
              </div>

              {levels.map((level) => {
                const list = learnings.filter((l) => l.level === level);
                const observed = list.filter((l) => portfolio.latestByLearning.has(l.id)).length;
                const levelLabel = c.levelLabels[level - 1];
                return (
                  <details key={level} open={level === openLevel} className="rounded-md border border-line bg-surface">
                    <summary className="flex min-h-11 cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2">
                      <span className="font-mono text-sm font-semibold">Niveau {level}</span>
                      {levelLabel && <span className="text-sm">{levelLabel}</span>}
                      <span className="ml-auto font-mono text-xs text-muted tabular-nums">
                        {observed}/{list.length} AC observés
                      </span>
                    </summary>
                    <ul className="flex flex-col divide-y divide-line border-t border-line">
                      {list.map((l) => {
                        const latest = portfolio.latestByLearning.get(l.id);
                        const evidenceCount = portfolio.evidencesByLearning.get(l.id)?.length ?? 0;
                        const traceCount = portfolio.tracesByLearning.get(l.id)?.length ?? 0;
                        const total = evidenceCount + traceCount;
                        return (
                          <li key={l.id} className="flex flex-col gap-2 px-4 py-3">
                            <p className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-sm font-semibold">{l.code}</span>
                              {l.parcours && <span className="badge">{l.parcours}</span>}
                            </p>
                            <p className="text-sm">{l.label}</p>
                            <div className="flex flex-wrap items-center gap-2">
                              <LevelPill level={latest?.self?.level ?? null} />
                              <LevelPill level={latest?.teacher?.level ?? null} who="Ens." />
                              {total > 0 ? (
                                <Link
                                  href={`/me/portfolio#ac-${l.code}`}
                                  className="inline-flex min-h-11 items-center px-1 font-mono text-xs text-accent underline tabular-nums"
                                >
                                  {total} trace{total > 1 ? "s" : ""}
                                  <span className="sr-only"> pour {l.code}</span>
                                </Link>
                              ) : (
                                <span className="font-mono text-xs text-muted">aucune trace</span>
                              )}
                              <Link
                                href={`/me/portfolio?ac=${encodeURIComponent(l.code)}#nouvelle-trace`}
                                className="ml-auto inline-flex min-h-11 items-center px-1 text-sm text-accent underline"
                              >
                                Ajouter une trace<span className="sr-only"> pour {l.code}</span>
                              </Link>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </details>
                );
              })}
            </section>
          );
        })}
      </section>
    </div>
  );
}
