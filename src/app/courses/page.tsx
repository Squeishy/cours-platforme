import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { canCreateCourse, canEditCourse, canViewCourse, isAdmin } from "@/lib/permissions";

export const metadata: Metadata = { title: "Cours" };

export default async function CoursesPage() {
  const user = await requireUser();

  const courses = await db.course.findMany({
    where: isAdmin(user)
      ? undefined
      : { OR: [{ published: true }, { ownerId: user.id }, { editors: { some: { id: user.id } } }] },
    include: {
      editors: { select: { id: true } },
      owner: { select: { name: true } },
      _count: { select: { pages: true } },
    },
    orderBy: [{ title: "asc" }],
  });
  const visible = courses.filter((c) => canViewCourse(user, c));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Cours</h1>
        {canCreateCourse(user) && (
          <Link href="/courses/new" className="btn btn-primary">
            Nouveau cours
          </Link>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="card text-muted">
          <p>Aucun cours disponible pour l&apos;instant.</p>
          {canCreateCourse(user) && (
            <p className="mt-2">
              <Link href="/courses/new" className="underline">
                Créer votre premier cours
              </Link>
            </p>
          )}
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {visible.map((course) => (
            <li key={course.id} className="card flex min-w-0 flex-col gap-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h2 className="min-w-0 text-lg font-semibold break-words">
                  <Link href={`/courses/${course.slug}`} className="hover:underline">
                    {course.title}
                  </Link>
                </h2>
                {!course.published && <span className="badge">Brouillon</span>}
              </div>
              {course.summary && <p className="line-clamp-3 text-muted break-words">{course.summary}</p>}
              <p className="mt-auto text-sm text-muted">
                {course._count.pages} page{course._count.pages > 1 ? "s" : ""} · {course.owner.name}
                {canEditCourse(user, course) ? " · vous pouvez modifier" : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
