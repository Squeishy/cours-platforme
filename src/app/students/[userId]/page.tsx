import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { assertAllowed, requireUser } from "@/lib/session";
import { ROLE_LABELS, canManageSae, canViewAssessment, canViewPortfolio, canViewSae, isStaff } from "@/lib/permissions";
import { formatDate } from "@/lib/format";
import { CompetenceRadar } from "@/components/competence-radar";
import { loadPortfolio, loadStudentParcours } from "@/app/me/portfolio/_lib/profile";
import { PortfolioSections } from "@/app/me/portfolio/_components/portfolio-sections";
import { PrintButton } from "@/app/me/portfolio/_components/share-tools";
import { AssessmentStatusBadge, BackLink } from "@/app/me/portfolio/_components/ui";

export const metadata: Metadata = { title: "Fiche étudiant", robots: { index: false, follow: false } };

const SHOWCASE_LABELS = { NONE: null, PENDING: "Vitrine : en attente", PUBLISHED: "Vitrine : publié" } as const;

export default async function StudentPage({ params }: PageProps<"/students/[userId]">) {
  const { userId } = await params;
  const user = await requireUser();
  if (userId.length > 64) notFound();
  assertAllowed(canViewPortfolio(user, userId));

  const student = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true },
  });
  if (!student) notFound();

  const saeAccess = { ownerId: true, published: true, teachers: { select: { id: true } } } as const;
  const [portfolio, info, memberships, assessments] = await Promise.all([
    loadPortfolio(student.id, { includeTeacher: true }),
    loadStudentParcours(student.id),
    db.groupMember.findMany({
      where: { userId: student.id },
      orderBy: { joinedAt: "desc" },
      take: 50,
      select: {
        group: {
          select: {
            id: true,
            name: true,
            showcaseStatus: true,
            sae: { select: { id: true, code: true, title: true, semester: true, ...saeAccess } },
          },
        },
      },
    }),
    db.selfAssessment.findMany({
      where: { userId: student.id },
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: {
        id: true,
        status: true,
        submittedAt: true,
        updatedAt: true,
        feedbackPublishedAt: true,
        milestone: {
          select: { title: true, sae: { select: { id: true, code: true, title: true, ...saeAccess } } },
        },
      },
    }),
  ]);

  const isSelf = user.id === student.id;
  const title = isSelf ? "Ma fiche" : student.name;

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-3">
        {isStaff(user) && <BackLink href="/students">Étudiants</BackLink>}
        <p className="eyebrow font-mono">{ROLE_LABELS[student.role]} · fiche de suivi</p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-2xl font-semibold text-balance break-words">{title}</h1>
          <PrintButton />
        </div>
        <p className="text-sm break-all text-muted">{student.email}</p>
        {info.cohorts.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label="Promos">
            {info.cohorts.map((c) => (
              <li key={c.id} className="badge text-ink">
                {c.name} · {c.academicYear}
                {c.parcours ? ` · ${c.parcours}` : ""}
              </li>
            ))}
          </ul>
        )}
      </header>

      <section aria-labelledby="st-radar" className="flex flex-col gap-3">
        <h2 id="st-radar" className="text-lg font-semibold">
          Profil de compétences
        </h2>
        <div className="card">
          <CompetenceRadar id="student-radar" scores={portfolio.scores} title={`Profil de compétences de ${student.name}`} />
        </div>
        <p className="text-sm text-muted">Seuls les positionnements enseignants publiés sont pris en compte.</p>
      </section>

      <section aria-labelledby="st-groups" className="flex flex-col gap-3">
        <h2 id="st-groups" className="text-lg font-semibold">
          SAÉ et groupes ({memberships.length})
        </h2>
        {memberships.length === 0 ? (
          <p className="text-muted">Aucun groupe de SAÉ.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line rounded-md border border-line bg-surface">
            {memberships.map(({ group }) => {
              const canOpen = canManageSae(user, group.sae) || (isSelf && canViewSae(user, group.sae));
              const showcase = SHOWCASE_LABELS[group.showcaseStatus];
              return (
                <li key={group.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
                  <span className="font-mono text-xs text-muted">
                    {group.sae.code ?? "SAÉ"}
                    {group.sae.semester ? ` · S${group.sae.semester}` : ""}
                  </span>
                  <span className="min-w-0 break-words sm:flex-1">
                    {group.sae.title} — <span className="font-medium">{group.name}</span>
                  </span>
                  {showcase && <span className="badge badge-accent self-start">{showcase}</span>}
                  {canOpen && (
                    <Link
                      href={`/saes/${group.sae.id}/groups/${group.id}`}
                      className="inline-flex min-h-11 items-center self-start text-sm text-accent underline sm:self-auto"
                    >
                      Espace du groupe<span className="sr-only"> {group.name}</span>
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="st-assessments" className="flex flex-col gap-3">
        <h2 id="st-assessments" className="text-lg font-semibold">
          Auto-évaluations ({assessments.length}
          {assessments.length === 100 ? "+" : ""})
        </h2>
        {assessments.length === 0 ? (
          <p className="text-muted">Aucune auto-évaluation.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line rounded-md border border-line bg-surface">
            {assessments.map((a) => {
              const allowed = canViewAssessment(
                user,
                { userId: student.id, status: a.status, group: null },
                a.milestone.sae,
              );
              return (
                <li key={a.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
                  <span className="font-mono text-xs text-muted">{a.milestone.sae.code ?? "SAÉ"}</span>
                  <span className="min-w-0 break-words sm:flex-1">
                    {a.milestone.title}
                    <span className="text-muted"> · {a.milestone.sae.title}</span>
                  </span>
                  <span className="flex flex-wrap items-center gap-2">
                    <AssessmentStatusBadge status={a.status} />
                    {a.feedbackPublishedAt && <span className="badge badge-ok">Retour publié</span>}
                    <span className="text-xs text-muted">
                      {a.submittedAt ? `soumise le ${formatDate(a.submittedAt)}` : `modifiée le ${formatDate(a.updatedAt)}`}
                    </span>
                  </span>
                  {allowed && (
                    <Link
                      href={`/assessments/${a.id}`}
                      className="inline-flex min-h-11 items-center self-start text-sm text-accent underline sm:self-auto"
                    >
                      Ouvrir<span className="sr-only"> l&apos;auto-évaluation {a.milestone.title}</span>
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="st-portfolio" className="flex flex-col gap-4">
        <h2 id="st-portfolio" className="text-lg font-semibold">
          Portfolio
        </h2>
        <PortfolioSections
          portfolio={portfolio}
          mode="staff"
          canOpenAssessment={(t) => isSelf || canManageSae(user, t.saeAccess)}
          emptyMessage="Aucune trace ni auto-évaluation rattachée à un apprentissage critique."
        />
      </section>
    </div>
  );
}
