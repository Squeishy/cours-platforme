import type { Metadata } from "next";
import { visibleCourseForMetadata } from "@/app/courses/_lib/metadata";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { assertAllowed, requireUser } from "@/lib/session";
import {
  canAnnounce,
  canCreateCourse,
  canDeleteCourse,
  canEditCourse,
  canViewCourse,
  canViewSae,
} from "@/lib/permissions";
import { formatDateTime, timeAgo } from "@/lib/format";
import { isFavorite } from "@/lib/favorites";
import { FavoriteButton } from "@/components/favorite-button";
import { buildPageTree } from "../_lib/tree";
import { PageTree } from "../_components/page-tree";
import { TitleForm } from "../_components/title-form";
import { CourseSettingsForm } from "../_components/course-settings-form";
import { AddEditorForm } from "../_components/add-editor-form";
import { ActionButton } from "../_components/action-button";
import { Chevron } from "../_components/chevron";
import { AnnouncementForm } from "../_components/announcement-form";
import { CopyLinkField } from "../_components/copy-link-field";
import {
  addCourseEditor,
  createCourseAnnouncement,
  createPage,
  deleteCourse,
  deleteCourseAnnouncement,
  duplicateCourse,
  enableCourseShareLink,
  removeCourseEditor,
  revokeCourseShareLink,
  updateCourseSettings,
} from "../actions";

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
  const course = await visibleCourseForMetadata({ slug });
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
  const canDuplicate = canEdit && canCreateCourse(user);
  const announce = canAnnounce(user, { scope: "COURSE", course });
  const tree = buildPageTree(course.pages);

  const [saes, favorite, recentPages, announcements, faqCount] = await Promise.all([
    db.sae
      .findMany({
        where: { courseId: course.id },
        include: { teachers: { select: { id: true } } },
        orderBy: [{ semester: "asc" }, { title: "asc" }],
      })
      .then((list) => list.filter((s) => canViewSae(user, s))),
    isFavorite(user.id, "COURSE", course.id),
    db.page.findMany({
      where: { courseId: course.id },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { id: true, title: true, updatedAt: true, updatedBy: { select: { name: true } } },
    }),
    db.announcement.findMany({
      where: { scope: "COURSE", courseId: course.id },
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      take: 5,
      select: { id: true, title: true, body: true, pinned: true, createdAt: true, author: { select: { name: true } } },
    }),
    db.pageQuestion.count({ where: { inFaq: true, page: { courseId: course.id } } }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <Link href="/courses" className="inline-flex min-h-11 items-center self-start text-sm underline">
          ← Tous les cours
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h1 className="min-w-0 text-2xl font-semibold text-balance break-words">{course.title}</h1>
            {!course.published && <span className="badge badge-warn">Brouillon</span>}
          </div>
          <FavoriteButton kind="COURSE" targetId={course.id} initial={favorite} label="ce cours" />
        </div>
        {course.summary && <p className="max-w-prose whitespace-pre-line text-muted break-words">{course.summary}</p>}
        <p className="text-sm text-muted">Responsable : {course.owner.name}</p>
        <p>
          <Link href={`/courses/${course.slug}/faq`} className="inline-flex min-h-11 items-center underline">
            FAQ du cours{faqCount > 0 ? ` (${faqCount})` : ""}
          </Link>
        </p>
      </header>

      {(announcements.length > 0 || announce) && (
        <section aria-labelledby="annonces" className="flex flex-col gap-3">
          <h2 id="annonces" className="text-lg font-semibold">
            Annonces
          </h2>
          {announcements.length === 0 ? (
            <p className="text-muted">Aucune annonce pour ce cours.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {announcements.map((a) => (
                <li key={a.id} className="card flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {a.pinned && <span className="badge badge-accent">Épinglée</span>}
                    <h3 className="min-w-0 font-semibold break-words">{a.title}</h3>
                  </div>
                  <p className="max-w-prose whitespace-pre-line break-words">{a.body}</p>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-muted">
                      {a.author.name} ·{" "}
                      <time dateTime={a.createdAt.toISOString()} title={formatDateTime(a.createdAt)}>
                        {timeAgo(a.createdAt)}
                      </time>
                    </p>
                    {announce && (
                      <ActionButton
                        action={deleteCourseAnnouncement.bind(null, a.id)}
                        label="Supprimer"
                        ariaLabel={`Supprimer l'annonce « ${a.title} »`}
                        pendingLabel="Suppression…"
                        variant="ghost"
                        confirmMessage={`Supprimer l'annonce « ${a.title} » ?`}
                      />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {announce && (
            <details className="group card">
              <summary className="flex min-h-11 cursor-pointer items-center gap-2 font-semibold list-none [&::-webkit-details-marker]:hidden">
                <Chevron />
                Nouvelle annonce
              </summary>
              <div className="pt-3">
                <AnnouncementForm action={createCourseAnnouncement.bind(null, course.id)} />
              </div>
            </details>
          )}
        </section>
      )}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <section aria-labelledby="sommaire" className="flex min-w-0 flex-col gap-3">
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

        <section aria-labelledby="recentes" className="flex min-w-0 flex-col gap-3">
          <h2 id="recentes" className="text-lg font-semibold">
            Récemment modifiées
          </h2>
          {recentPages.length === 0 ? (
            <p className="text-muted">Aucune page modifiée pour l&apos;instant.</p>
          ) : (
            <ul className="card flex flex-col divide-y divide-line p-0">
              {recentPages.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/courses/${course.slug}/pages/${p.id}`}
                    className="flex min-h-11 flex-col justify-center px-3 py-2 hover:bg-sunken"
                  >
                    <span className="font-medium break-words">{p.title}</span>
                    <span className="text-sm text-muted">
                      <time dateTime={p.updatedAt.toISOString()} title={formatDateTime(p.updatedAt)}>
                        {timeAgo(p.updatedAt)}
                      </time>
                      {p.updatedBy ? ` · ${p.updatedBy.name}` : ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

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
                <Link href={`/saes/${sae.id}`} className="card flex min-h-11 flex-wrap items-center gap-2 hover:bg-sunken">
                  {sae.code && <span className="badge">{sae.code}</span>}
                  <span className="min-w-0 font-medium break-words">{sae.title}</span>
                  {sae.semester != null && <span className="text-sm text-muted">Semestre {sae.semester}</span>}
                  {!sae.published && <span className="badge badge-warn">Brouillon</span>}
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

          <div className="card flex flex-col gap-3">
            <h3 className="font-semibold">Lien public en lecture seule</h3>
            <p className="max-w-prose text-sm text-muted">
              Toute personne disposant du lien peut lire le cours et ses pages sans compte (jury, intervenant,
              partenaire), même s&apos;il n&apos;est pas publié. Le lien n&apos;est pas référencé par les moteurs de
              recherche ; le régénérer ou le désactiver coupe l&apos;accès à l&apos;ancien lien.
            </p>
            {course.shareToken ? (
              <>
                <CopyLinkField path={`/p/course/${course.shareToken}`} label="Adresse du lien public" />
                <div className="flex flex-wrap gap-2">
                  <ActionButton
                    action={enableCourseShareLink.bind(null, course.id)}
                    label="Régénérer le lien"
                    pendingLabel="Régénération…"
                    confirmMessage="Régénérer le lien ? L'ancien lien cessera de fonctionner."
                  />
                  <ActionButton
                    action={revokeCourseShareLink.bind(null, course.id)}
                    label="Désactiver le lien"
                    pendingLabel="Désactivation…"
                    variant="danger"
                    confirmMessage="Désactiver le lien public ? Les personnes qui l'ont reçu ne pourront plus lire le cours."
                  />
                </div>
              </>
            ) : (
              <ActionButton
                action={enableCourseShareLink.bind(null, course.id)}
                label="Créer un lien public"
                pendingLabel="Création…"
                className="self-start"
              />
            )}
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

          {canDuplicate && (
            <div className="card flex flex-col gap-2">
              <h3 className="font-semibold">Dupliquer le cours</h3>
              <p className="max-w-prose text-sm text-muted">
                Crée une copie non publiée dont vous êtes responsable, avec toutes les pages et leur contenu (sans
                questions, historique, annonces ni lien public). Pratique pour reconduire le cours l&apos;année suivante.
              </p>
              <ActionButton
                action={duplicateCourse.bind(null, course.id)}
                label="Dupliquer le cours"
                pendingLabel="Duplication…"
                className="self-start"
                confirmMessage={`Créer une copie de « ${course.title} » ?`}
              />
            </div>
          )}

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
                className="self-start"
                confirmMessage={`Supprimer définitivement le cours « ${course.title} » et toutes ses pages ?`}
              />
            </div>
          )}
        </section>
      )}
    </div>
  );
}
