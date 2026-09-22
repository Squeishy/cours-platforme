import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { assertAllowed, requireUser } from "@/lib/session";
import { canManageSae, canViewCourse, canViewSae, isGroupMember } from "@/lib/permissions";
import { BlockEditor } from "@/components/editor";
import { saveSaeContent } from "../actions";
import { formatDateRange, formatDateTime } from "../_lib/dates";

export const metadata: Metadata = { title: "SAÉ" };

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
      milestones: {
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          title: true,
          dueAt: true,
          requiresDepositUrl: true,
          _count: { select: { criteria: true } },
        },
      },
      groups: {
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          members: {
            orderBy: { joinedAt: "asc" },
            select: { userId: true, user: { select: { name: true } } },
          },
        },
      },
    },
  });
  if (!sae) notFound();
  assertAllowed(canViewSae(user, sae));

  const canManage = canManageSae(user, sae);
  const myGroup = sae.groups.find((g) => isGroupMember(user, g));
  const range = formatDateRange(sae.startsAt, sae.endsAt);
  const hasSubject = (Array.isArray(sae.content) && sae.content.length > 0) || !!sae.markdown;
  const now = new Date();

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <Link href="/saes" className="inline-flex min-h-11 items-center text-sm text-muted hover:underline">
          ← Toutes les SAÉ
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {sae.code && <span className="text-sm font-semibold text-accent">{sae.code}</span>}
              {sae.semester && <span className="badge">Semestre {sae.semester}</span>}
              {!sae.published && <span className="badge">Brouillon</span>}
            </div>
            <h1 className="mt-1 text-2xl font-semibold break-words md:text-3xl">{sae.title}</h1>
          </div>
          {canManage && (
            <Link href={`/saes/${sae.id}/manage`} className="btn">
              Gérer
            </Link>
          )}
        </div>

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
        </dl>
      </header>

      {myGroup && (
        <Link
          href={`/saes/${sae.id}/groups/${myGroup.id}`}
          className="block rounded-md border-2 border-accent bg-surface p-4 transition-colors hover:bg-bg"
        >
          <p className="text-sm text-muted">Mon groupe</p>
          <p className="text-lg font-semibold">Mon groupe : {myGroup.name}</p>
          <p className="mt-1 text-sm text-muted">
            {myGroup.members.map((m) => m.user.name).join(", ")} · Espace de travail, dépôts et auto-évaluations →
          </p>
        </Link>
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
            />
          </div>
        ) : (
          <p className="card text-muted">Le sujet n&apos;a pas encore été rédigé.</p>
        )}
      </section>

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
                return (
                  <li key={m.id}>
                    <Link
                      href={`/saes/${sae.id}/milestones/${m.id}`}
                      className="card block min-h-11 transition-colors hover:border-accent"
                    >
                      <p className="font-medium break-words">
                        <span className="text-muted">{index + 1}. </span>
                        {m.title}
                      </p>
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
                      {m.requiresDepositUrl && <span className="badge mt-2">Dépôt d&apos;URL requis</span>}
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
