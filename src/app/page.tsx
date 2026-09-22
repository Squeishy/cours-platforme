import Link from "next/link";
import type { ReactNode } from "react";
import { db } from "@/lib/db";
import { getCurrentUser, type CurrentUser } from "@/lib/session";
import { canViewSae, isStaff } from "@/lib/permissions";

const dateFormat = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

type SaeSummary = { id: string; code: string | null; title: string; semester: number | null; published: boolean };
type SaeEntry = { sae: SaeSummary; group?: { id: string; name: string } };

const saeSelect = {
  id: true,
  code: true,
  title: true,
  semester: true,
  published: true,
  ownerId: true,
} as const;

async function loadDashboard(user: CurrentUser) {
  const staff = isStaff(user);
  const now = new Date();

  const coursesPromise = db.course.findMany({
    where: staff ? { OR: [{ ownerId: user.id }, { editors: { some: { id: user.id } } }] } : { published: true },
    select: { id: true, slug: true, title: true, published: true, summary: true },
    orderBy: staff ? [{ updatedAt: "desc" }] : [{ title: "asc" }],
    take: 12,
  });

  let saes: SaeEntry[];
  if (staff) {
    const managed = await db.sae.findMany({
      where: { OR: [{ ownerId: user.id }, { teachers: { some: { id: user.id } } }] },
      select: saeSelect,
      orderBy: [{ updatedAt: "desc" }],
    });
    saes = managed.map((sae) => ({ sae }));
  } else {
    const memberships = await db.groupMember.findMany({
      where: { userId: user.id },
      select: { group: { select: { id: true, name: true, sae: { select: saeSelect } } } },
      orderBy: { joinedAt: "desc" },
    });
    saes = memberships
      .filter((m) => canViewSae(user, m.group.sae))
      .map((m) => ({ sae: m.group.sae, group: { id: m.group.id, name: m.group.name } }));
  }
  const saeIds = [...new Set(saes.map((s) => s.sae.id))];

  const [courses, milestones, assessments] = await Promise.all([
    coursesPromise,
    saeIds.length === 0
      ? Promise.resolve([])
      : db.milestone.findMany({
          where: { saeId: { in: saeIds }, dueAt: { gte: now } },
          select: {
            id: true,
            title: true,
            dueAt: true,
            sae: { select: { id: true, code: true, title: true } },
          },
          orderBy: [{ dueAt: "asc" }],
          take: 10,
        }),
    !staff || saeIds.length === 0
      ? Promise.resolve([])
      : db.selfAssessment.findMany({
          where: { status: "SUBMITTED", milestone: { saeId: { in: saeIds } } },
          select: {
            id: true,
            submittedAt: true,
            user: { select: { name: true } },
            group: { select: { name: true } },
            milestone: { select: { title: true, sae: { select: { code: true, title: true } } } },
          },
          orderBy: [{ submittedAt: "desc" }],
          take: 10,
        }),
  ]);

  return { staff, courses, saes, milestones, assessments };
}

function Section({ id, title, action, children }: { id: string; title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={id} className="text-lg font-semibold">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="card text-muted">{children}</p>;
}

function saeLabel(sae: { code: string | null; title: string }) {
  return sae.code ? `${sae.code} — ${sae.title}` : sae.title;
}

export default async function Home() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="flex max-w-2xl flex-col gap-4 py-6">
        <h1 className="text-3xl font-semibold text-balance">Cours, SAÉ et auto-évaluations</h1>
        <p className="text-muted">
          Consultez les supports de cours, retrouvez les sujets de SAÉ et votre groupe, déposez vos liens de rendu et
          auto-évaluez-vous à chaque jalon. Les enseignants suivent l&apos;avancement et commentent.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link href="/login" className="btn btn-primary">
            Se connecter
          </Link>
          <Link href="/register" className="btn">
            Créer un compte
          </Link>
        </div>
      </div>
    );
  }

  const { staff, courses, saes, milestones, assessments } = await loadDashboard(user);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">Bonjour {user.name}</h1>

      <div className="grid gap-8 md:grid-cols-2">
        <Section
          id="mes-cours"
          title="Mes cours"
          action={
            <Link href="/courses" className="inline-flex min-h-11 items-center text-sm underline">
              Tous les cours
            </Link>
          }
        >
          {courses.length === 0 ? (
            <Empty>
              {staff ? (
                <>
                  Vous n&apos;avez encore aucun cours.{" "}
                  <Link href="/courses/new" className="underline">
                    Créer un cours
                  </Link>
                </>
              ) : (
                "Aucun cours publié pour l'instant."
              )}
            </Empty>
          ) : (
            <ul className="card flex flex-col divide-y divide-line py-1">
              {courses.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/courses/${c.slug}`}
                    className="flex min-h-11 flex-wrap items-center gap-2 py-2 hover:underline"
                  >
                    <span className="min-w-0 font-medium break-words">{c.title}</span>
                    {!c.published && <span className="badge">Brouillon</span>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section
          id="mes-saes"
          title="Mes SAÉ"
          action={
            <Link href="/saes" className="inline-flex min-h-11 items-center text-sm underline">
              Toutes les SAÉ
            </Link>
          }
        >
          {saes.length === 0 ? (
            <Empty>
              {staff
                ? "Vous ne gérez encore aucune SAÉ."
                : "Vous n'êtes membre d'aucun groupe de SAÉ pour l'instant."}
            </Empty>
          ) : (
            <ul className="card flex flex-col divide-y divide-line py-1">
              {saes.map(({ sae, group }) => (
                <li key={group ? group.id : sae.id} className="flex flex-col gap-1 py-2">
                  <Link href={`/saes/${sae.id}`} className="flex min-h-11 flex-wrap items-center gap-2 hover:underline">
                    <span className="min-w-0 font-medium break-words">{saeLabel(sae)}</span>
                    {sae.semester != null && <span className="text-sm text-muted">S{sae.semester}</span>}
                    {!sae.published && <span className="badge">Brouillon</span>}
                  </Link>
                  {group && (
                    <Link
                      href={`/saes/${sae.id}/groups/${group.id}`}
                      className="inline-flex min-h-11 items-center self-start text-sm text-accent underline"
                    >
                      Mon groupe : {group.name}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section id="prochains-jalons" title="Prochains jalons">
          {milestones.length === 0 ? (
            <Empty>Aucun jalon à venir.</Empty>
          ) : (
            <ol className="card flex flex-col divide-y divide-line py-1">
              {milestones.map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/saes/${m.sae.id}/milestones/${m.id}`}
                    className="flex min-h-11 flex-col gap-0.5 py-2 hover:underline"
                  >
                    <span className="font-medium break-words">{m.title}</span>
                    <span className="text-sm text-muted break-words">
                      {m.dueAt && <time dateTime={m.dueAt.toISOString()}>{dateFormat.format(m.dueAt)}</time>} ·{" "}
                      {saeLabel(m.sae)}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </Section>

        {staff && (
          <Section id="auto-evaluations" title="Auto-évaluations récentes">
            {assessments.length === 0 ? (
              <Empty>Aucune auto-évaluation soumise sur vos SAÉ.</Empty>
            ) : (
              <ul className="card flex flex-col divide-y divide-line py-1">
                {assessments.map((a) => (
                  <li key={a.id}>
                    <Link href={`/assessments/${a.id}`} className="flex min-h-11 flex-col gap-0.5 py-2 hover:underline">
                      <span className="font-medium break-words">
                        {a.user.name}
                        {a.group ? ` (${a.group.name})` : ""}
                      </span>
                      <span className="text-sm text-muted break-words">
                        {a.milestone.title} · {saeLabel(a.milestone.sae)}
                        {a.submittedAt && (
                          <>
                            {" "}
                            · <time dateTime={a.submittedAt.toISOString()}>{dateFormat.format(a.submittedAt)}</time>
                          </>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        )}
      </div>
    </div>
  );
}
