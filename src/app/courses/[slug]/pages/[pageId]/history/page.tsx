import type { Metadata } from "next";
import { visiblePageForMetadata } from "@/app/courses/_lib/metadata";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { assertAllowed, requireUser } from "@/lib/session";
import { canEditCourse } from "@/lib/permissions";
import { formatDateTime, timeAgo } from "@/lib/format";
import { BlockEditor } from "@/components/editor";
import { getPeertubeHosts } from "@/components/editor/peertube";
import { ActionButton } from "../../../../_components/action-button";
import { restorePageRevision } from "./actions";

const MAX_REVISIONS = 100;

export async function generateMetadata({ params }: PageProps<"/courses/[slug]/pages/[pageId]/history">): Promise<Metadata> {
  const { pageId } = await params;
  const page = await visiblePageForMetadata(pageId);
  return { title: page ? `Historique — ${page.title}` : "Historique" };
}

export default async function PageHistory({ params, searchParams }: PageProps<"/courses/[slug]/pages/[pageId]/history">) {
  const user = await requireUser();
  const { slug, pageId } = await params;
  const { rev } = await searchParams;

  const course = await db.course.findUnique({ where: { slug }, include: { editors: { select: { id: true } } } });
  if (!course) notFound();
  assertAllowed(canEditCourse(user, course));

  const page = await db.page.findUnique({
    where: { id: pageId },
    select: { id: true, title: true, courseId: true, updatedAt: true, updatedBy: { select: { name: true } } },
  });
  if (!page || page.courseId !== course.id) notFound();

  const revisions = await db.pageRevision.findMany({
    where: { pageId: page.id },
    orderBy: { createdAt: "desc" },
    take: MAX_REVISIONS,
    select: { id: true, title: true, createdAt: true, author: { select: { name: true } } },
  });

  const requested = typeof rev === "string" && rev.length <= 64 ? rev : undefined;
  const selectedId = requested ?? revisions[0]?.id;
  const selected = selectedId
    ? await db.pageRevision.findFirst({
        where: { id: selectedId, pageId: page.id },
        select: { id: true, title: true, content: true, markdown: true, createdAt: true, author: { select: { name: true } } },
      })
    : null;
  const pageHref = `/courses/${course.slug}/pages/${page.id}`;
  const historyHref = `${pageHref}/history`;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Link href={pageHref} className="inline-flex min-h-11 items-center self-start text-sm underline">
          ← Retour à la page
        </Link>
        <p className="eyebrow">{course.title}</p>
        <h1 className="text-2xl font-semibold text-balance break-words">Historique — {page.title}</h1>
        <p className="max-w-prose text-sm text-muted">
          Une version est conservée avant chaque série de modifications (au plus une toutes les 10 minutes par
          auteur, 100 versions par page). Restaurer une version conserve d&apos;abord l&apos;état actuel.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <nav aria-labelledby="versions-title" className="flex min-w-0 flex-col gap-2">
          <h2 id="versions-title" className="text-sm font-semibold text-muted">
            Versions ({revisions.length})
          </h2>
          <ol className="card flex flex-col divide-y divide-line p-0">
            <li>
              <Link href={pageHref} className="flex min-h-11 flex-col justify-center px-3 py-2 hover:bg-sunken">
                <span className="font-medium">Version actuelle</span>
                <span className="text-sm text-muted">
                  {timeAgo(page.updatedAt)}
                  {page.updatedBy ? ` · ${page.updatedBy.name}` : ""}
                </span>
              </Link>
            </li>
            {revisions.map((r) => {
              const current = r.id === selected?.id;
              return (
                <li key={r.id}>
                  <Link
                    href={`${historyHref}?rev=${r.id}#apercu`}
                    aria-current={current ? "true" : undefined}
                    className={`flex min-h-11 flex-col justify-center px-3 py-2 hover:bg-sunken ${current ? "bg-accent-soft" : ""}`}
                  >
                    <span className={current ? "font-semibold text-accent" : "font-medium"}>
                      <time dateTime={r.createdAt.toISOString()}>{formatDateTime(r.createdAt)}</time>
                    </span>
                    <span className="text-sm text-muted break-words">
                      {r.author?.name ?? "Auteur inconnu"} · {timeAgo(r.createdAt)}
                      {r.title !== page.title ? ` · « ${r.title} »` : ""}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
          {revisions.length === 0 && (
            <p className="text-sm text-muted">
              Aucune version antérieure : l&apos;historique se remplit au fil des modifications de la page.
            </p>
          )}
        </nav>

        <section id="apercu" aria-labelledby="apercu-title" className="flex min-w-0 max-w-[70ch] scroll-mt-4 flex-col gap-4">
          {selected ? (
            <>
              <div className="flex flex-col gap-3">
                <h2 id="apercu-title" className="text-lg font-semibold break-words">
                  Version du {formatDateTime(selected.createdAt)}
                </h2>
                <p className="text-sm text-muted break-words">
                  {selected.author?.name ?? "Auteur inconnu"} · titre : « {selected.title} » · aperçu en lecture seule
                </p>
                <ActionButton
                  action={restorePageRevision.bind(null, selected.id)}
                  label="Restaurer cette version"
                  pendingLabel="Restauration…"
                  variant="primary"
                  className="self-start"
                  confirmMessage={`Restaurer la version du ${formatDateTime(selected.createdAt)} ? Le contenu actuel sera conservé dans l'historique.`}
                />
              </div>
              {selected.content == null && !selected.markdown ? (
                <p className="card text-muted">Cette version est vide.</p>
              ) : (
                <BlockEditor
                  key={selected.id}
                  initialContent={selected.content}
                  initialMarkdown={selected.markdown}
                  editable={false}
                  peertubeHosts={getPeertubeHosts()}
                />
              )}
            </>
          ) : (
            <>
              <h2 id="apercu-title" className="text-lg font-semibold">
                Aperçu
              </h2>
              <p className="card text-muted">
                {requested ? "Cette version n'existe plus." : "Aucune version à prévisualiser pour l'instant."}
              </p>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
