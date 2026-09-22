import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { assertAllowed, requireUser } from "@/lib/session";
import { canEditCourse, canViewCourse } from "@/lib/permissions";
import { BlockEditor } from "@/components/editor";
import { buildPageTree, pageAncestors } from "../../../_lib/tree";
import { PageTree } from "../../../_components/page-tree";
import { TitleForm } from "../../../_components/title-form";
import { ActionButton } from "../../../_components/action-button";
import { createPage, deletePage, movePage, renamePage, savePageContent } from "../../../actions";

const dateFormat = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});

export async function generateMetadata({ params }: PageProps<"/courses/[slug]/pages/[pageId]">): Promise<Metadata> {
  const { pageId } = await params;
  const page = await db.page.findUnique({ where: { id: pageId }, select: { title: true } });
  return { title: page?.title ?? "Page" };
}

export default async function CoursePageView({ params }: PageProps<"/courses/[slug]/pages/[pageId]">) {
  const user = await requireUser();
  const { slug, pageId } = await params;

  const course = await db.course.findUnique({
    where: { slug },
    include: {
      editors: { select: { id: true } },
      pages: { select: { id: true, title: true, parentId: true, position: true } },
    },
  });
  if (!course) notFound();
  assertAllowed(canViewCourse(user, course));

  const page = await db.page.findUnique({
    where: { id: pageId },
    include: { updatedBy: { select: { name: true } } },
  });
  if (!page || page.courseId !== course.id) notFound();

  const canEdit = canEditCourse(user, course);
  const tree = buildPageTree(course.pages);
  const ancestors = pageAncestors(course.pages, page.id);
  const siblings = course.pages
    .filter((p) => p.parentId === page.parentId)
    .sort((a, b) => a.position - b.position || a.title.localeCompare(b.title, "fr"));
  const index = siblings.findIndex((p) => p.id === page.id);
  const childCount = course.pages.filter((p) => p.parentId === page.id).length;

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Fil d'Ariane" className="text-sm">
        <ol className="flex flex-wrap items-center gap-x-1 gap-y-0">
          <li className="flex items-center">
            <Link href={`/courses/${course.slug}`} className="inline-flex min-h-11 items-center underline break-words">
              {course.title}
            </Link>
          </li>
          {ancestors.map((a) => (
            <li key={a.id} className="flex min-w-0 items-center gap-1">
              <span aria-hidden="true" className="text-muted">
                /
              </span>
              <Link
                href={`/courses/${course.slug}/pages/${a.id}`}
                className="inline-flex min-h-11 min-w-0 items-center underline break-words"
              >
                {a.title}
              </Link>
            </li>
          ))}
          <li className="flex min-w-0 items-center gap-1">
            <span aria-hidden="true" className="text-muted">
              /
            </span>
            <span aria-current="page" className="min-w-0 text-muted break-words">
              {page.title}
            </span>
          </li>
        </ol>
      </nav>

      <div className="grid gap-6 md:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="min-w-0">
          <nav aria-label="Sommaire du cours" className="card md:sticky md:top-4">
            <h2 className="mb-2 text-sm font-semibold text-muted">Sommaire</h2>
            <PageTree nodes={tree} slug={course.slug} currentId={page.id} />
          </nav>
        </aside>

        <article className="flex min-w-0 flex-col gap-4">
          <header className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold break-words">{page.title}</h1>
            <p className="text-sm text-muted">
              Modifié le {dateFormat.format(page.updatedAt)}
              {page.updatedBy ? ` par ${page.updatedBy.name}` : ""}
            </p>
          </header>

          <BlockEditor
            key={page.id}
            initialContent={page.content}
            initialMarkdown={page.markdown}
            editable={canEdit}
            onSave={canEdit ? savePageContent.bind(null, page.id) : undefined}
          />

          {!canEdit && !page.content && !page.markdown && (
            <p className="text-muted">Cette page est encore vide.</p>
          )}

          {canEdit && (
            <section aria-labelledby="page-actions" className="card flex flex-col gap-5">
              <h2 id="page-actions" className="font-semibold">
                Gérer la page
              </h2>
              <TitleForm
                action={renamePage.bind(null, page.id)}
                label="Titre de la page"
                submitLabel="Renommer"
                defaultValue={page.title}
                successMessage="Titre mis à jour."
              />
              <TitleForm
                action={createPage.bind(null, course.id, page.id)}
                label="Nouvelle sous-page"
                submitLabel="Créer la sous-page"
                placeholder="Titre de la sous-page"
              />
              <div className="flex flex-wrap items-start gap-2">
                {index > 0 && (
                  <ActionButton
                    action={movePage.bind(null, page.id, "up")}
                    label="↑ Monter"
                    ariaLabel="Monter la page d'un cran"
                    pendingLabel="Déplacement…"
                  />
                )}
                {index >= 0 && index < siblings.length - 1 && (
                  <ActionButton
                    action={movePage.bind(null, page.id, "down")}
                    label="↓ Descendre"
                    ariaLabel="Descendre la page d'un cran"
                    pendingLabel="Déplacement…"
                  />
                )}
                <ActionButton
                  action={deletePage.bind(null, page.id)}
                  label="Supprimer la page"
                  pendingLabel="Suppression…"
                  variant="danger"
                  className="ml-auto"
                  confirmMessage={
                    childCount > 0
                      ? `Supprimer « ${page.title} » et ses ${childCount} sous-page(s) ? Cette action est définitive.`
                      : `Supprimer « ${page.title} » ? Cette action est définitive.`
                  }
                />
              </div>
            </section>
          )}
        </article>
      </div>
    </div>
  );
}
