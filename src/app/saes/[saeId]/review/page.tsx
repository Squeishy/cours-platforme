import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { assertAllowed, requireUser } from "@/lib/session";
import { canEvaluateAssessment } from "@/lib/permissions";
import { PROVIDER_LABELS } from "@/lib/deposit";
import {
  criterionSelect,
  feedbackStatus,
  formatDateTime,
  toCriterionView,
} from "@/app/assessments/_lib/shared";
import { BackLink, FeedbackStatusBadge, LinkStatusBadge } from "@/app/assessments/_lib/ui";
import { CriteriaComparison } from "@/app/assessments/_lib/comparison";
import { ConfirmActionButton } from "@/app/assessments/_lib/confirm-action-button";
import { TeacherFeedbackForm } from "@/app/assessments/_lib/teacher-feedback-form";
import { listMySnippets } from "@/app/assessments/_lib/snippets";
import { saveTeacherFeedback, unpublishFeedback } from "@/app/assessments/[assessmentId]/actions";
import { QueueNav } from "./queue-nav";

export const metadata: Metadata = { title: "File de correction", robots: { index: false } };

type Filter = "all" | "unpublished";

function pick(value: string | string[] | undefined) {
  return typeof value === "string" ? value : Array.isArray(value) ? value[0] : undefined;
}

const isHttpUrl = (url: string) => /^https?:\/\//i.test(url);

export default async function ReviewQueuePage({ params, searchParams }: PageProps<"/saes/[saeId]/review">) {
  const { saeId } = await params;
  const query = await searchParams;
  const user = await requireUser();

  const sae = await db.sae.findUnique({
    where: { id: saeId },
    select: {
      id: true,
      code: true,
      title: true,
      ownerId: true,
      published: true,
      teachers: { select: { id: true } },
      milestones: {
        orderBy: [{ position: "asc" }, { dueAt: "asc" }],
        take: 100,
        select: { id: true, title: true, dueAt: true, requiresDepositUrl: true },
      },
    },
  });
  if (!sae) notFound();
  assertAllowed(canEvaluateAssessment(user, sae));

  const saeLabel = `${sae.code ? `${sae.code} — ` : ""}${sae.title}`;
  const milestone = sae.milestones.find((m) => m.id === pick(query.milestone));
  const filter: Filter = pick(query.filter) === "unpublished" ? "unpublished" : "all";

  // ── Pas de jalon choisi : liste des jalons avec leur avancement ──
  if (!milestone) {
    const [submittedByMilestone, unpublishedByMilestone] = await Promise.all([
      db.selfAssessment.groupBy({
        by: ["milestoneId"],
        where: { milestone: { saeId: sae.id }, status: "SUBMITTED" },
        _count: { _all: true },
      }),
      db.selfAssessment.groupBy({
        by: ["milestoneId"],
        where: { milestone: { saeId: sae.id }, status: "SUBMITTED", feedbackPublishedAt: null },
        _count: { _all: true },
      }),
    ]);
    const submitted = new Map(submittedByMilestone.map((g) => [g.milestoneId, g._count._all]));
    const unpublished = new Map(unpublishedByMilestone.map((g) => [g.milestoneId, g._count._all]));

    return (
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          <BackLink href={`/saes/${sae.id}`}>{saeLabel}</BackLink>
          <p className="eyebrow">File de correction</p>
          <h1 className="text-2xl font-semibold text-balance">Choisir un jalon</h1>
          <p className="max-w-prose text-sm text-muted">
            La file présente une à une les auto-évaluations soumises du jalon, par groupe puis par nom, avec votre
            formulaire de positionnement.
          </p>
        </header>
        {sae.milestones.length === 0 ? (
          <p className="card text-muted">Aucun jalon dans cette SAÉ pour l&apos;instant.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {sae.milestones.map((m) => {
              const total = submitted.get(m.id) ?? 0;
              const todo = unpublished.get(m.id) ?? 0;
              return (
                <li key={m.id} className="card flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-col gap-1">
                    <span className="font-semibold break-words">{m.title}</span>
                    <span className="text-sm text-muted">
                      {m.dueAt ? `Échéance : ${formatDateTime(m.dueAt)}` : "Pas d'échéance"} · {total} soumise
                      {total > 1 ? "s" : ""} · {todo} sans retour publié
                    </span>
                  </div>
                  <Link
                    href={`/saes/${sae.id}/review?milestone=${m.id}${todo > 0 ? "&filter=unpublished" : ""}`}
                    className="btn w-full sm:w-auto"
                  >
                    Corriger
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  }

  // ── File du jalon ──
  const requestedId = pick(query.a);
  const baseWhere = { milestoneId: milestone.id, status: "SUBMITTED" as const };
  const [totalSubmitted, unpublishedCount, list, criteriaRows, snippets] = await Promise.all([
    db.selfAssessment.count({ where: baseWhere }),
    db.selfAssessment.count({ where: { ...baseWhere, feedbackPublishedAt: null } }),
    db.selfAssessment.findMany({
      where:
        filter === "unpublished"
          ? // L'auto-évaluation affichée reste dans la file même une fois publiée (navigation stable)
            { ...baseWhere, OR: [{ feedbackPublishedAt: null }, ...(requestedId ? [{ id: requestedId }] : [])] }
          : baseWhere,
      orderBy: [{ group: { name: "asc" } }, { user: { name: "asc" } }],
      select: { id: true },
      take: 1000,
    }),
    db.criterion.findMany({
      where: { milestoneId: milestone.id },
      orderBy: { position: "asc" },
      select: criterionSelect,
    }),
    listMySnippets(user),
  ]);

  const found = requestedId ? list.findIndex((x) => x.id === requestedId) : -1;
  const index = found >= 0 ? found : 0;
  const currentId = list[index]?.id;

  const hrefFor = (id: string) =>
    `/saes/${sae.id}/review?milestone=${milestone.id}${filter === "unpublished" ? "&filter=unpublished" : ""}&a=${id}`;
  const filterHref = (f: Filter) =>
    `/saes/${sae.id}/review?milestone=${milestone.id}${f === "unpublished" ? "&filter=unpublished" : ""}${currentId ? `&a=${currentId}` : ""}`;
  const prevHref = index > 0 ? hrefFor(list[index - 1].id) : null;
  const nextHref = index < list.length - 1 ? hrefFor(list[index + 1].id) : null;

  const current = currentId
    ? await db.selfAssessment.findUnique({
        where: { id: currentId },
        select: {
          id: true,
          submittedAt: true,
          feedbackPublishedAt: true,
          reflection: true,
          feedbackBy: { select: { name: true } },
          user: { select: { name: true } },
          group: {
            select: { id: true, name: true, members: { select: { userId: true, user: { select: { name: true } } } } },
          },
          items: {
            select: { criterionId: true, level: true, justification: true, teacherLevel: true, teacherComment: true },
          },
          _count: { select: { comments: true } },
        },
      })
    : null;

  const depositLinks = current?.group
    ? await db.depositLink.findMany({
        where: { groupId: current.group.id, milestoneId: milestone.id },
        orderBy: { createdAt: "asc" },
        take: 50,
        select: {
          id: true,
          url: true,
          label: true,
          provider: true,
          checkStatus: true,
          checkedAt: true,
          checkNote: true,
        },
      })
    : [];

  const itemByCriterion = new Map((current?.items ?? []).map((i) => [i.criterionId, i]));
  const criteria = criteriaRows.map((c) => {
    const item = itemByCriterion.get(c.id);
    return {
      ...toCriterionView(c),
      self: item ? { level: item.level, justification: item.justification } : null,
      teacher: null,
      teacherLevel: item?.teacherLevel ?? null,
      teacherComment: item?.teacherComment ?? null,
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <BackLink href={`/saes/${sae.id}/milestones/${milestone.id}`}>{milestone.title}</BackLink>
        <p className="eyebrow">File de correction · {saeLabel}</p>
        <h1 className="text-2xl font-semibold text-balance break-words">{milestone.title}</h1>

        <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end md:justify-between">
          <form method="get" action={`/saes/${sae.id}/review`} className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="sm:min-w-64">
              <label htmlFor="milestone-select" className="label">
                Jalon
              </label>
              <select id="milestone-select" name="milestone" defaultValue={milestone.id} className="input">
                {sae.milestones.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </select>
            </div>
            {filter === "unpublished" && <input type="hidden" name="filter" value="unpublished" />}
            <button type="submit" className="btn">
              Afficher
            </button>
          </form>

          <div role="group" aria-label="Filtrer la file" className="flex flex-wrap gap-2">
            <Link
              href={filterHref("all")}
              aria-current={filter === "all" ? "page" : undefined}
              className={`btn ${filter === "all" ? "border-accent bg-accent-soft text-accent" : ""}`}
            >
              Toutes les soumises ({totalSubmitted})
            </Link>
            <Link
              href={filterHref("unpublished")}
              aria-current={filter === "unpublished" ? "page" : undefined}
              className={`btn ${filter === "unpublished" ? "border-accent bg-accent-soft text-accent" : ""}`}
            >
              Sans retour publié ({unpublishedCount})
            </Link>
          </div>
        </div>
      </header>

      {!current ? (
        <div className="card flex flex-col items-start gap-3">
          {totalSubmitted === 0 ? (
            <p>Aucune auto-évaluation soumise pour ce jalon pour l&apos;instant.</p>
          ) : (
            <>
              <p>Tous les retours de ce jalon sont publiés.</p>
              <Link href={filterHref("all")} className="btn">
                Revoir toutes les auto-évaluations soumises
              </Link>
            </>
          )}
          <Link href={`/saes/${sae.id}/milestones/${milestone.id}`} className="text-sm text-accent underline">
            Retour au suivi du jalon
          </Link>
        </div>
      ) : (
        <>
          <QueueNav
            prevHref={prevHref}
            nextHref={nextHref}
            position={index + 1}
            total={list.length}
            label="Navigation dans la file (haut)"
            shortcuts
          />

          <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
            <section aria-labelledby="student-title" className="flex flex-col gap-5">
              <div className="card flex flex-col gap-2">
                <p className="eyebrow">Étudiant·e</p>
                <h2 id="student-title" className="text-xl font-semibold break-words">
                  {current.user.name}
                </h2>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                  <dt className="text-muted">Groupe</dt>
                  <dd className="break-words">
                    {current.group ? (
                      <Link href={`/saes/${sae.id}/groups/${current.group.id}`} className="text-accent underline">
                        {current.group.name}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </dd>
                  {current.group && (
                    <>
                      <dt className="text-muted">Membres</dt>
                      <dd className="break-words">{current.group.members.map((m) => m.user.name).join(", ")}</dd>
                    </>
                  )}
                  <dt className="text-muted">Soumise le</dt>
                  <dd>{current.submittedAt ? formatDateTime(current.submittedAt) : "—"}</dd>
                  <dt className="text-muted">Commentaires</dt>
                  <dd>{current._count.comments}</dd>
                </dl>
                <Link href={`/assessments/${current.id}`} className="inline-flex min-h-11 items-center text-sm text-accent underline">
                  Ouvrir la page complète (commentaires, réouverture)
                </Link>
              </div>

              <div className="flex flex-col gap-2">
                <h3 className="font-semibold">Dépôts du groupe pour ce jalon</h3>
                {depositLinks.length === 0 ? (
                  <p className={`text-sm ${milestone.requiresDepositUrl ? "rounded-md bg-danger-soft p-3 text-danger" : "text-muted"}`}>
                    Aucune URL déposée pour ce jalon{milestone.requiresDepositUrl ? " alors qu'un dépôt est requis" : ""}.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {depositLinks.map((link) => (
                      <li key={link.id} className="flex flex-col gap-1 rounded-md border border-line bg-surface p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="badge">{PROVIDER_LABELS[link.provider]}</span>
                          <LinkStatusBadge status={link.checkStatus} checkedAt={link.checkedAt} />
                        </div>
                        {isHttpUrl(link.url) ? (
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer nofollow"
                            className="inline-flex min-h-11 items-center break-all text-accent underline"
                          >
                            {link.label ?? link.url}
                            <span className="sr-only"> (nouvel onglet)</span>
                          </a>
                        ) : (
                          <span className="break-all">{link.label ?? link.url}</span>
                        )}
                        {link.checkNote && link.checkStatus && link.checkStatus !== "OK" && (
                          <p className="text-sm text-muted">{link.checkNote}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <h3 className="font-semibold">Auto-positionnement</h3>
                <CriteriaComparison criteria={criteria} showTeacher={false} headingLevel={4} />
              </div>

              <div className="flex flex-col gap-2">
                <h3 className="font-semibold">Réflexion globale</h3>
                {current.reflection ? (
                  <p className="card max-w-prose break-words whitespace-pre-line">{current.reflection}</p>
                ) : (
                  <p className="text-sm text-muted">Aucune réflexion rédigée.</p>
                )}
              </div>
            </section>

            <section aria-labelledby="teacher-title" className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id="teacher-title" className="text-xl font-semibold">
                  Positionnement enseignant
                </h2>
                <FeedbackStatusBadge status={feedbackStatus(current)} />
              </div>
              {current.feedbackPublishedAt && (
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
                  <span>
                    Publié le {formatDateTime(current.feedbackPublishedAt)}
                    {current.feedbackBy ? ` par ${current.feedbackBy.name}` : ""}
                  </span>
                  <ConfirmActionButton
                    action={unpublishFeedback.bind(null, current.id)}
                    label="Dépublier"
                    pendingLabel="Dépublication…"
                    confirmMessage="Dépublier ce retour ? L'étudiant·e ne le verra plus jusqu'à la prochaine publication."
                    className="text-ink"
                  />
                </div>
              )}
              <TeacherFeedbackForm
                key={current.id}
                action={saveTeacherFeedback.bind(null, current.id)}
                criteria={criteria}
                snippets={snippets}
                published={!!current.feedbackPublishedAt}
                afterPublishHref={nextHref}
              />
            </section>
          </div>

          <QueueNav
            prevHref={prevHref}
            nextHref={nextHref}
            position={index + 1}
            total={list.length}
            label="Navigation dans la file (bas)"
          />
        </>
      )}
    </div>
  );
}
