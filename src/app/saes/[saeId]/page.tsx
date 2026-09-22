import type { Metadata } from "next";
import { MilestoneTrack } from "@/components/ui";
import { getPeertubeHosts } from "@/components/editor/peertube";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { assertAllowed, requireUser } from "@/lib/session";
import { canManageSae, canViewCourse, canViewSae, isGroupMember } from "@/lib/permissions";
import { deadline, formatDateTime as formatDateTimeFr, timeAgo, type DeadlineTone } from "@/lib/format";
import { isFavorite } from "@/lib/favorites";
import { BlockEditor } from "@/components/editor";
import { FavoriteButton } from "@/components/favorite-button";
import { saveSaeContent } from "../actions";
import { formatDateRange, formatDateTime } from "../_lib/dates";
import { safeColor } from "../_lib/criteria";

export const metadata: Metadata = { title: "SAÉ" };

const TONE_BADGE: Record<DeadlineTone, string> = {
  overdue: "badge-danger",
  soon: "badge-warn",
  later: "",
  done: "badge-ok",
};

export default async function SaePage({ params }: PageProps<"/saes/[saeId]">) {
  const { saeId } = await params;
  const user = await requireUser();

  const sae = await db.sae.findUnique({
    where: { id: saeId },
    include: {
      owner: { select: { id: true, name: true } },
      teachers: { select: { id: true, name: true }, orderBy: { name: "asc" } },
      course: {
        select: { slug: true, title: true, published: true, ownerId: true, editors: { select: { id: true } } },
      },
      cohort: { select: { name: true, academicYear: true } },
      milestones: {
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        take: 200,
        select: {
          id: true,
          title: true,
          dueAt: true,
          requiresDepositUrl: true,
          peerReviewEnabled: true,
          _count: { select: { criteria: true } },
          criteria: {
            where: { learningId: { not: null } },
            take: 200,
            select: {
              learning: { select: { competence: { select: { code: true, name: true, color: true, position: true } } } },
            },
          },
        },
      },
      groups: {
        orderBy: { name: "asc" },
        take: 500,
        select: {
          id: true,
          name: true,
          members: {
            orderBy: { joinedAt: "asc" },
            select: { userId: true, user: { select: { name: true } } },
          },
        },
      },
      announcements: {
        orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
        take: 5,
        select: { id: true, title: true, body: true, pinned: true, createdAt: true, author: { select: { name: true } } },
      },
      _count: { select: { defenseSlots: true } },
    },
  });
  if (!sae) notFound();
  assertAllowed(canViewSae(user, sae));

  const canManage = canManageSae(user, sae);
  const myGroup = sae.groups.find((g) => isGroupMember(user, g));
  const range = formatDateRange(sae.startsAt, sae.endsAt);
  const hasSubject = (Array.isArray(sae.content) && sae.content.length > 0) || !!sae.markdown;
  const now = new Date();

  const [favorite, mySubmissions, submittedCounts, mySlot, takenSlots] = await Promise.all([
    isFavorite(user.id, "SAE", sae.id),
    db.selfAssessment.findMany({
      where: { userId: user.id, status: "SUBMITTED", milestone: { saeId: sae.id } },
      select: { milestoneId: true },
      take: 200,
    }),
    canManage
      ? db.selfAssessment.groupBy({
          by: ["milestoneId"],
          where: { status: "SUBMITTED", milestone: { saeId: sae.id } },
          _count: { _all: true },
        })
      : Promise.resolve([]),
    myGroup
      ? db.defenseSlot.findUnique({
          where: { groupId: myGroup.id },
          select: { startsAt: true, durationMin: true, location: true },
        })
      : Promise.resolve(null),
    canManage && sae._count.defenseSlots > 0
      ? db.defenseSlot.count({ where: { saeId: sae.id, groupId: { not: null } } })
      : Promise.resolve(0),
  ]);

  const submittedByMe = new Set(mySubmissions.map((s) => s.milestoneId));
  const submittedByMilestone = new Map(submittedCounts.map((c) => [c.milestoneId, c._count._all]));
  const studentCount = new Set(sae.groups.flatMap((g) => g.members.map((m) => m.userId))).size;

  // Compétences couvertes : celles des AC rattachés aux critères
  const competences = [
    ...new Map(
      sae.milestones
        .flatMap((m) => m.criteria)
        .flatMap((c) => (c.learning ? [c.learning.competence] : []))
        .map((c) => [c.code, c] as const),
    ).values(),
  ].sort((a, b) => a.position - b.position || a.code.localeCompare(b.code));

  return (
    <div className="space-y-8">
      <header className="space-y-4">
        <Link href="/saes" className="inline-flex min-h-11 items-center text-sm text-muted hover:underline">
          ← Toutes les SAÉ
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow font-mono">
              {[sae.code ?? "SAÉ", sae.semester ? `S${sae.semester}` : null, sae.cohort?.name].filter(Boolean).join(" · ")}
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-balance break-words md:text-3xl">{sae.title}</h1>
            {!sae.published && <span className="badge badge-warn mt-2">Brouillon — invisible pour les étudiants</span>}
          </div>
          <div className="flex flex-wrap gap-2">
            <FavoriteButton kind="SAE" targetId={sae.id} initial={favorite} label="cette SAÉ" />
            {canManage && (
              <>
                {/* Téléchargement servi par un route handler : lien natif */}
                <a href={`/saes/${sae.id}/export`} className="btn" download>
                  Exporter le suivi (CSV)
                </a>
                <Link href={`/saes/${sae.id}/manage`} className="btn btn-primary">
                  Gérer
                </Link>
              </>
            )}
          </div>
        </div>

        {competences.length > 0 && (
          <ul aria-label="Compétences couvertes" className="flex flex-wrap gap-2">
            {competences.map((c) => (
              <li key={c.code} className="badge gap-1.5 text-ink">
                <span
                  aria-hidden="true"
                  className="inline-block size-2.5 rounded-full bg-muted"
                  style={{ backgroundColor: safeColor(c.color) }}
                />
                <span className="font-mono">{c.code}</span> {c.name}
              </li>
            ))}
          </ul>
        )}

        <dl className="grid gap-x-6 gap-y-2 text-sm md:grid-cols-2">
          {sae.competences && (
            <div className="md:col-span-2">
              <dt className="font-medium">Compétences visées</dt>
              <dd className="text-muted break-words whitespace-pre-line">{sae.competences}</dd>
            </div>
          )}
          {range && (
            <div>
              <dt className="font-medium">Période</dt>
              <dd className="text-muted">{range}</dd>
            </div>
          )}
          <div>
            <dt className="font-medium">Équipe pédagogique</dt>
            <dd className="text-muted">{[sae.owner.name, ...sae.teachers.map((t) => t.name)].join(", ")}</dd>
          </div>
          {sae.course && (
            <div>
              <dt className="font-medium">Cours lié</dt>
              <dd>
                {canViewCourse(user, sae.course) ? (
                  <Link href={`/courses/${sae.course.slug}`} className="underline">
                    {sae.course.title}
                  </Link>
                ) : (
                  <span className="text-muted">{sae.course.title}</span>
                )}
              </dd>
            </div>
          )}
          {sae.cohort && (
            <div>
              <dt className="font-medium">Promo</dt>
              <dd className="text-muted">
                {sae.cohort.name} · {sae.cohort.academicYear}
              </dd>
            </div>
          )}
        </dl>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {myGroup && (
          <Link
            href={`/saes/${sae.id}/groups/${myGroup.id}`}
            className="block rounded-md border-2 border-accent bg-surface p-4 transition-colors hover:bg-bg"
          >
            <p className="eyebrow">Mon groupe</p>
            <p className="text-lg font-semibold break-words">Mon groupe : {myGroup.name}</p>
            <p className="mt-1 text-sm text-muted break-words">
              {myGroup.members.map((m) => m.user.name).join(", ")} · Espace de travail, dépôts et auto-évaluations →
            </p>
          </Link>
        )}

        {(sae._count.defenseSlots > 0 || canManage) && (
          <Link
            href={`/saes/${sae.id}/defenses`}
            className="card block min-h-11 transition-colors hover:border-accent"
          >
            <p className="eyebrow">Soutenances</p>
            {canManage ? (
              <p className="mt-1">
                {sae._count.defenseSlots === 0 ? (
                  "Aucun créneau. Générez les créneaux de passage →"
                ) : (
                  <>
                    <span className="font-mono tabular-nums">
                      {takenSlots}/{sae._count.defenseSlots}
                    </span>{" "}
                    créneaux attribués · Gérer les soutenances →
                  </>
                )}
              </p>
            ) : mySlot ? (
              <p className="mt-1">
                <span className="font-medium">
                  <time dateTime={mySlot.startsAt.toISOString()}>{formatDateTimeFr(mySlot.startsAt)}</time>
                </span>
                <span className="text-muted">
                  {" "}
                  · {mySlot.durationMin} min{mySlot.location ? ` · ${mySlot.location}` : ""}
                </span>
              </p>
            ) : (
              <p className="mt-1">
                {myGroup ? "Votre groupe n'a pas encore de créneau. Réserver →" : "Voir les créneaux →"}
              </p>
            )}
          </Link>
        )}
      </div>

      {(sae.announcements.length > 0 || canManage) && (
        <section aria-labelledby="annonces" className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="annonces" className="text-xl font-semibold">
              Annonces
            </h2>
            {canManage && (
              <Link href={`/saes/${sae.id}/manage#annonces`} className="inline-flex min-h-11 items-center text-sm underline">
                Publier une annonce
              </Link>
            )}
          </div>
          {sae.announcements.length === 0 ? (
            <p className="card text-muted">Aucune annonce pour l&apos;instant.</p>
          ) : (
            <ul className="space-y-2">
              {sae.announcements.map((a) => (
                <li key={a.id} className={`card space-y-1 ${a.pinned ? "border-accent" : ""}`}>
                  <p className="font-medium break-words">
                    {a.pinned && <span className="badge badge-accent mr-2">Épinglée</span>}
                    {a.title}
                  </p>
                  <p className="text-xs text-muted">
                    {a.author.name} ·{" "}
                    <time dateTime={a.createdAt.toISOString()} title={formatDateTimeFr(a.createdAt)}>
                      {timeAgo(a.createdAt, now)}
                    </time>
                  </p>
                  <p className="max-w-prose text-sm break-words whitespace-pre-line">{a.body}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section aria-labelledby="sujet" className="space-y-3">
        <h2 id="sujet" className="text-xl font-semibold">
          Sujet
        </h2>
        {canManage && (
          <p className="text-sm text-muted">
            Tapez « / » pour insérer un bloc. Le Markdown est reconnu à la frappe et au collage. Enregistrement
            automatique.
          </p>
        )}
        {hasSubject || canManage ? (
          <div className="card px-0 md:px-2">
            <BlockEditor
              initialContent={sae.content}
              initialMarkdown={sae.markdown}
              editable={canManage}
              onSave={canManage ? saveSaeContent.bind(null, sae.id) : undefined}
              peertubeHosts={getPeertubeHosts()}
            />
          </div>
        ) : (
          <p className="card text-muted">Le sujet n&apos;a pas encore été rédigé.</p>
        )}
      </section>

      {sae.milestones.some((m) => m.dueAt) && (
        <section aria-labelledby="calendrier" className="space-y-3">
          <h2 id="calendrier" className="text-xl font-semibold">
            Calendrier
          </h2>
          <MilestoneTrack
            label={`Jalons de ${sae.code ?? "la SAÉ"}`}
            start={sae.startsAt ?? undefined}
            end={sae.endsAt ?? undefined}
            now={now}
            milestones={sae.milestones.map((m) => ({
              id: m.id,
              title: m.title,
              dueAt: m.dueAt,
              href: `/saes/${sae.id}/milestones/${m.id}`,
              status: canManage
                ? "none"
                : submittedByMe.has(m.id)
                  ? "done"
                  : m.dueAt && m.dueAt < now
                    ? "late"
                    : m.dueAt
                      ? "pending"
                      : "none",
            }))}
          />
        </section>
      )}

      <div className="grid gap-8 md:grid-cols-2">
        <section aria-labelledby="jalons" className="space-y-3">
          <h2 id="jalons" className="text-xl font-semibold">
            Jalons
          </h2>
          {sae.milestones.length === 0 ? (
            <p className="card text-muted">Aucun jalon pour l&apos;instant.</p>
          ) : (
            <ol className="space-y-2">
              {sae.milestones.map((m, index) => {
                const overdue = !!m.dueAt && m.dueAt < now;
                const due = m.dueAt ? deadline(m.dueAt, now, submittedByMe.has(m.id)) : null;
                const submitted = submittedByMilestone.get(m.id) ?? 0;
                return (
                  <li key={m.id}>
                    <Link
                      href={`/saes/${sae.id}/milestones/${m.id}`}
                      className="card block min-h-11 transition-colors hover:border-accent"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 font-medium break-words">
                          <span className="font-mono text-muted">{index + 1}. </span>
                          {m.title}
                        </p>
                        {due && <span className={`badge shrink-0 font-mono ${TONE_BADGE[due.tone]}`}>{due.label}</span>}
                      </div>
                      <p className="mt-1 text-sm text-muted">
                        {m.dueAt ? (
                          <>
                            {overdue ? "Échéance passée : " : "À rendre le "}
                            <time dateTime={m.dueAt.toISOString()}>{formatDateTime(m.dueAt)}</time>
                          </>
                        ) : (
                          "Sans échéance"
                        )}
                        {" · "}
                        {m._count.criteria === 0
                          ? "aucun critère"
                          : `${m._count.criteria} critère${m._count.criteria > 1 ? "s" : ""}`}
                      </p>
                      {(m.requiresDepositUrl || m.peerReviewEnabled) && (
                        <p className="mt-2 flex flex-wrap gap-2">
                          {m.requiresDepositUrl && <span className="badge">Dépôt d&apos;URL requis</span>}
                          {m.peerReviewEnabled && <span className="badge">Contribution entre pairs</span>}
                        </p>
                      )}
                      {canManage && m._count.criteria > 0 && (
                        <div className="mt-3 space-y-1">
                          <p className="flex justify-between text-xs text-muted">
                            <span>Auto-évaluations soumises</span>
                            <span className="font-mono tabular-nums">
                              {submitted}/{studentCount}
                            </span>
                          </p>
                          <div className="h-1.5 overflow-hidden rounded-full bg-sunken" aria-hidden="true">
                            <div
                              className="h-full rounded-full bg-accent"
                              style={{ width: `${studentCount > 0 ? Math.min(100, (submitted / studentCount) * 100) : 0}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <section aria-labelledby="groupes" className="space-y-3">
          <h2 id="groupes" className="text-xl font-semibold">
            Groupes
          </h2>
          {sae.groups.length === 0 ? (
            <p className="card text-muted">Aucun groupe pour l&apos;instant.</p>
          ) : (
            <ul className="space-y-2">
              {sae.groups.map((g) => {
                const members =
                  g.members.length === 0 ? "Aucun membre" : g.members.map((m) => m.user.name).join(", ");
                const canOpen = canManage || isGroupMember(user, g);
                return (
                  <li key={g.id}>
                    {canOpen ? (
                      <Link
                        href={`/saes/${sae.id}/groups/${g.id}`}
                        className={`card block min-h-11 transition-colors hover:border-accent ${
                          g.id === myGroup?.id ? "border-accent" : ""
                        }`}
                      >
                        <p className="font-medium break-words">{g.name}</p>
                        <p className="mt-1 text-sm text-muted break-words">{members}</p>
                      </Link>
                    ) : (
                      <div className="card">
                        <p className="font-medium break-words">{g.name}</p>
                        <p className="mt-1 text-sm text-muted break-words">{members}</p>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
