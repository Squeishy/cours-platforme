import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { assertAllowed, requireUser } from "@/lib/session";
import { canDeleteCourse, canEditCourse, canViewCourse, canViewSae } from "@/lib/permissions";
import { buildPageTree } from "../_lib/tree";
import { PageTree } from "../_components/page-tree";
import { TitleForm } from "../_components/title-form";
import { CourseSettingsForm } from "../_components/course-settings-form";
import { AddEditorForm } from "../_components/add-editor-form";
import { ActionButton } from "../_components/action-button";
import { addCourseEditor, createPage, deleteCourse, removeCourseEditor, updateCourseSettings } from "../actions";

async function loadCourse(slug: string) {
  return db.course.findUnique({
    where: { slug },
    include: {
      owner: { select: { id: true, name: true } },
      editors: { select: { id: true, name: true, email: true }, orderBy: { name: "asc" } },
      pages: { select: { id: true, title: true, parentId: true, position: true } },
    },
  });
}

export async function generateMetadata({ params }: PageProps<"/courses/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const course = await db.course.findUnique({ where: { slug }, select: { title: true } });
  return { title: course?.title ?? "Cours" };
}

export default async function CoursePage({ params }: PageProps<"/courses/[slug]">) {
  const user = await requireUser();
  const { slug } = await params;
  const course = await loadCourse(slug);
  if (!course) notFound();
  assertAllowed(canViewCourse(user, course));

  const canEdit = canEditCourse(user, course);
  const canDelete = canDeleteCourse(user, course);
  const tree = buildPageTree(course.pages);

  const saes = (
    await db.sae.findMany({
      where: { courseId: course.id },
      include: { teachers: { select: { id: true } } },
      orderBy: [{ semester: "asc" }, { title: "asc" }],
    })
  ).filter((s) => canViewSae(user, s));

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <Link href="/courses" className="inline-flex min-h-11 items-center self-start text-sm underline">
          ← Tous les cours
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="min-w-0 text-2xl font-semibold break-words">{course.title}</h1>
          {!course.published && <span className="badge">Brouillon</span>}
        </div>
        {course.summary && <p className="max-w-prose whitespace-pre-line text-muted break-words">{course.summary}</p>}
        <p className="text-sm text-muted">Responsable : {course.owner.name}</p>
      </header>

      <section aria-labelledby="sommaire" className="flex flex-col gap-3">
        <h2 id="sommaire" className="text-lg font-semibold">
          Sommaire
        </h2>
        {tree.length === 0 ? (
          <p className="card text-muted">
            Aucune page pour l&apos;instant.{canEdit ? " Créez la première page ci-dessous." : ""}
          </p>
        ) : (
          <nav aria-label="Sommaire du cours" className="card">
            <PageTree nodes={tree} slug={course.slug} />
          </nav>
        )}
        {canEdit && (
          <div className="card">
            <TitleForm
              action={createPage.bind(null, course.id, null)}
              label="Nouvelle page"
              submitLabel="Créer la page"
              placeholder="Titre de la page"
            />
          </div>
        )}
      </section>

      <section aria-labelledby="saes-liees" className="flex flex-col gap-3">
        <h2 id="saes-liees" className="text-lg font-semibold">
          SAÉ liées
        </h2>
        {saes.length === 0 ? (
          <p className="text-muted">Aucune SAÉ n&apos;est rattachée à ce cours.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {saes.map((sae) => (
              <li key={sae.id}>
                <Link href={`/saes/${sae.id}`} className="card flex min-h-11 flex-wrap items-center gap-2 hover:bg-bg">
                  {sae.code && <span className="badge">{sae.code}</span>}
                  <span className="min-w-0 font-medium break-words">{sae.title}</span>
                  {sae.semester != null && <span className="text-sm text-muted">Semestre {sae.semester}</span>}
                  {!sae.published && <span className="badge">Brouillon</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {canEdit && (
        <section aria-labelledby="reglages" className="flex flex-col gap-4">
          <h2 id="reglages" className="text-lg font-semibold">
            Réglages du cours
          </h2>
          <div className="card">
            <CourseSettingsForm
              action={updateCourseSettings.bind(null, course.id)}
              course={{ title: course.title, summary: course.summary, published: course.published }}
            />
          </div>

          <div className="card flex flex-col gap-4">
            <h3 className="font-semibold">Co-éditeurs</h3>
            {course.editors.length === 0 ? (
              <p className="text-muted">Aucun co-éditeur : seul le responsable modifie ce cours.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-line">
                {course.editors.map((editor) => (
                  <li key={editor.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span className="min-w-0 break-words">
                      {editor.name} <span className="text-sm text-muted break-all">({editor.email})</span>
                    </span>
                    <ActionButton
                      action={removeCourseEditor.bind(null, course.id, editor.id)}
                      label="Retirer"
                      pendingLabel="Retrait…"
                      ariaLabel={`Retirer ${editor.name} des co-éditeurs`}
                      confirmMessage={`Retirer ${editor.name} des co-éditeurs ?`}
                    />
                  </li>
                ))}
              </ul>
            )}
            <AddEditorForm action={addCourseEditor.bind(null, course.id)} />
          </div>

          {canDelete && (
            <div className="card flex flex-col gap-2 border-danger/40">
              <h3 className="font-semibold text-danger">Zone dangereuse</h3>
              <p className="text-sm text-muted">
                Supprimer le cours efface définitivement toutes ses pages. Les SAÉ liées sont conservées mais
                détachées du cours.
              </p>
              <ActionButton
                action={deleteCourse.bind(null, course.id)}
                label="Supprimer le cours"
                pendingLabel="Suppression…"
                variant="danger"
                confirmMessage={`Supprimer définitivement le cours « ${course.title} » et toutes ses pages ?`}
              />
            </div>
          )}
        </section>
      )}
    </div>
  );
}
