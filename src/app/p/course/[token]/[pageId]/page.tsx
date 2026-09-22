import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { BlockEditor } from "@/components/editor";
import { getPeertubeHosts } from "@/components/editor/peertube";
import { buildPageTree, pageAncestors, readingOrder } from "@/app/courses/_lib/tree";
import { PageTree } from "@/app/courses/_components/page-tree";
import { Chevron } from "@/app/courses/_components/chevron";
import { loadSharedCourse } from "../../_lib/load";

function loadSharedPage(courseId: string, pageId: string) {
  if (pageId.length > 64) return null;
  return db.page.findFirst({
    where: { id: pageId, courseId },
    select: { id: true, title: true, content: true, markdown: true, updatedAt: true },
  });
}

export async function generateMetadata({ params }: PageProps<"/p/course/[token]/[pageId]">): Promise<Metadata> {
  const { token, pageId } = await params;
  const course = await loadSharedCourse(token);
  const page = course ? course.pages.find((p) => p.id === pageId) : undefined;
  return {
    title: page && course ? `${page.title} — ${course.title}` : "Cours partagé",
    robots: { index: false, follow: false },
  };
}

/** Page d'un cours partagé : uniquement les pages de CE cours, en lecture seule */
export default async function SharedCoursePageView({ params }: PageProps<"/p/course/[token]/[pageId]">) {
  await connection();
  const { token, pageId } = await params;
  const course = await loadSharedCourse(token);
  if (!course) notFound();
  const page = await loadSharedPage(course.id, pageId);
  if (!page) notFound();

  const base = `/p/course/${token}`;
  const tree = buildPageTree(course.pages);
  const ancestors = pageAncestors(course.pages, page.id);
  const order = readingOrder(tree);
  const index = order.findIndex((p) => p.id === page.id);
  const prev = index > 0 ? order[index - 1] : undefined;
  const next = index >= 0 && index < order.length - 1 ? order[index + 1] : undefined;

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Fil d'Ariane" className="text-sm">
        <ol className="flex flex-wrap items-center gap-x-1 gap-y-0">
          <li className="flex items-center">
            <Link href={base} className="inline-flex min-h-11 items-center underline break-words">
              {course.title}
            </Link>
          </li>
          {ancestors.map((a) => (
            <li key={a.id} className="flex min-w-0 items-center gap-1">
              <span aria-hidden="true" className="text-muted">
                /
              </span>
              <Link href={`${base}/${a.id}`} className="inline-flex min-h-11 min-w-0 items-center underline break-words">
                {a.title}
              </Link>
            </li>
          ))}
        </ol>
      </nav>

      <details className="group card md:hidden">
        <summary className="flex min-h-11 cursor-pointer items-center gap-2 font-semibold list-none [&::-webkit-details-marker]:hidden">
          <Chevron />
          Sommaire du cours
        </summary>
        <nav aria-label="Sommaire du cours" className="pt-2">
          <PageTree nodes={tree} slug="" basePath={base} currentId={page.id} />
        </nav>
      </details>

      <div className="grid gap-6 md:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="hidden min-w-0 md:block">
          <nav aria-label="Sommaire du cours" className="card md:sticky md:top-4">
            <h2 className="mb-2 text-sm font-semibold text-muted">Sommaire</h2>
            <PageTree nodes={tree} slug="" basePath={base} currentId={page.id} />
          </nav>
        </aside>

        <article className="flex min-w-0 max-w-[70ch] flex-col gap-4">
          <header className="flex flex-col gap-1">
            <p className="eyebrow">Lecture seule</p>
            <h1 className="text-2xl font-semibold text-balance break-words">{page.title}</h1>
            <p className="text-sm text-muted">
              Mis à jour le <time dateTime={page.updatedAt.toISOString()}>{formatDate(page.updatedAt)}</time>
            </p>
          </header>

          {page.content || page.markdown ? (
            <BlockEditor
              key={page.id}
              initialContent={page.content}
              initialMarkdown={page.markdown}
              editable={false}
              peertubeHosts={getPeertubeHosts()}
            />
          ) : (
            <p className="text-muted">Cette page est encore vide.</p>
          )}

          {(prev || next) && (
            <nav aria-label="Pages voisines" className="flex flex-col gap-2 sm:flex-row sm:justify-between">
              {prev ? (
                <Link href={`${base}/${prev.id}`} className="btn justify-start">
                  <span aria-hidden="true">←</span>
                  <span className="min-w-0 truncate">
                    <span className="sr-only">Page précédente : </span>
                    {prev.title}
                  </span>
                </Link>
              ) : (
                <span />
              )}
              {next && (
                <Link href={`${base}/${next.id}`} className="btn justify-end">
                  <span className="min-w-0 truncate">
                    <span className="sr-only">Page suivante : </span>
                    {next.title}
                  </span>
                  <span aria-hidden="true">→</span>
                </Link>
              )}
            </nav>
          )}
        </article>
      </div>
    </div>
  );
}
