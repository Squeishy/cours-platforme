import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { canCreateCourse, canViewCourse, isAdmin } from "@/lib/permissions";
import { EmptyState, PageHeader, StatusBadge, Swatch } from "@/components/ui";

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
    <div className="flex flex-col gap-10">
      <PageHeader
        title="Cours"
        actions={
          canCreateCourse(user) && (
            <Link href="/courses/new" className="btn btn-primary">
              Nouveau cours
            </Link>
          )
        }
      />

      {visible.length === 0 ? (
        <EmptyState>Aucun cours.</EmptyState>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {visible.map((course) => (
            <li key={course.id}>
              <Link
                href={`/courses/${course.slug}`}
                className="card flex h-full min-h-11 items-start gap-4 transition-colors hover:border-ink"
              >
                <Swatch seed={course.id} text={course.title} />
                <div className="flex min-w-0 flex-col gap-1">
                  <h2 className="text-lg break-words">{course.title}</h2>
                  {course.summary && <p className="line-clamp-2 text-muted break-words">{course.summary}</p>}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
                    <span>
                      {course._count.pages} page{course._count.pages > 1 ? "s" : ""}
                    </span>
                    <span>{course.owner.name}</span>
                    {!course.published && <StatusBadge tone="warn">Brouillon</StatusBadge>}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
