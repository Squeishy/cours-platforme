import Link from "next/link";
import type { ReactNode } from "react";
import { getFavorites } from "@/components/app-shell";
import {
  AssessmentStatusBadge,
  DeadlineChip,
  EmptyState,
  Icon,
  MilestoneTrack,
  ProgressRing,
  StatusBadge,
  type AssessmentStatusValue,
  type TrackMilestone,
} from "@/components/ui";
import { db } from "@/lib/db";
import { formatDateShort, formatTime, timeAgo } from "@/lib/format";
import { isStaff } from "@/lib/permissions";
import { getCurrentUser, type CurrentUser } from "@/lib/session";

const DAY = 86_400_000;
const TZ = "Europe/Paris";

const saeSelect = {
  id: true,
  code: true,
  title: true,
  semester: true,
  published: true,
  startsAt: true,
  endsAt: true,
} as const;

type SaeLite = {
  id: string;
  code: string | null;
  title: string;
  semester: number | null;
  published: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
};
type MySae = { sae: SaeLite; group?: { id: string; name: string } };
type MilestoneLite = { id: string; title: string; dueAt: Date | null; saeId: string };

// ─────────────────────────────────────────────────────────────
// Données
// ─────────────────────────────────────────────────────────────

/** SAÉ de l'utilisateur : groupes (étudiant, SAÉ publiées) ou SAÉ gérées (équipe pédagogique) */
async function loadMySaes(user: CurrentUser, staff: boolean): Promise<MySae[]> {
  if (staff) {
    const managed = await db.sae.findMany({
      where: { OR: [{ ownerId: user.id }, { teachers: { some: { id: user.id } } }] },
      select: saeSelect,
      orderBy: [{ updatedAt: "desc" }],
      take: 20,
    });
    return managed.map((sae) => ({ sae }));
  }
  const memberships = await db.groupMember.findMany({
    where: { userId: user.id, group: { sae: { published: true } } },
    select: { group: { select: { id: true, name: true, sae: { select: saeSelect } } } },
    orderBy: { joinedAt: "desc" },
    take: 20,
  });
  const seen = new Set<string>();
  const out: MySae[] = [];
  for (const m of memberships) {
    if (seen.has(m.group.sae.id)) continue;
    seen.add(m.group.sae.id);
    out.push({ sae: m.group.sae, group: { id: m.group.id, name: m.group.name } });
  }
  return out;
}

async function loadDashboard(user: CurrentUser, now: Date) {
  const staff = isStaff(user);
  const mySaes = await loadMySaes(user, staff);
  const saeIds = mySaes.map((s) => s.sae.id);
  const hasSaes = saeIds.length > 0;

  const [milestones, myAssessments, announcements, favorites, toReview, showcaseRequests, openQuestions, groups] =
    await Promise.all([
      hasSaes
        ? db.milestone.findMany({
            where: { saeId: { in: saeIds } },
            select: { id: true, title: true, dueAt: true, saeId: true },
            orderBy: [{ position: "asc" }],
            take: 300,
          })
        : Promise.resolve([] as MilestoneLite[]),
      !staff && hasSaes
        ? db.selfAssessment.findMany({
            where: { userId: user.id, milestone: { saeId: { in: saeIds } } },
            select: { milestoneId: true, status: true },
            take: 300,
          })
        : Promise.resolve([]),
      db.announcement.findMany({
        where: {
          OR: [
            { scope: "GLOBAL" },
            { scope: "COHORT", cohort: { members: { some: { userId: user.id } } } },
            { scope: "SAE", saeId: { in: saeIds } },
            {
              scope: "COURSE",
              course: { OR: [{ ownerId: user.id }, { editors: { some: { id: user.id } } }] },
            },
          ],
        },
        select: {
          id: true,
          scope: true,
          title: true,
          body: true,
          pinned: true,
          createdAt: true,
          author: { select: { name: true } },
          cohort: { select: { name: true } },
          sae: { select: { id: true, code: true, title: true } },
          course: { select: { slug: true, title: true } },
        },
        orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
        take: 5,
      }),
      getFavorites(user.id),
      staff && hasSaes
        ? db.selfAssessment.count({
            where: { status: "SUBMITTED", feedbackPublishedAt: null, milestone: { saeId: { in: saeIds } } },
          })
        : Promise.resolve(0),
      staff && hasSaes
        ? db.group.count({ where: { saeId: { in: saeIds }, showcaseStatus: "PENDING" } })
        : Promise.resolve(0),
      staff
        ? db.pageQuestion.count({
            where: {
              resolved: false,
              answers: { none: {} },
              page: { course: { OR: [{ ownerId: user.id }, { editors: { some: { id: user.id } } }] } },
            },
          })
        : Promise.resolve(0),
      staff && hasSaes
        ? db.group.findMany({
            where: { saeId: { in: saeIds } },
            select: { saeId: true, _count: { select: { members: true } } },
            take: 500,
          })
        : Promise.resolve([]),
    ]);

  const statusByMilestone = new Map<string, AssessmentStatusValue>(
    myAssessments.map((a) => [a.milestoneId, a.status]),
  );

  // Échéances : étudiant = à venir + retards non soumis (14 j) ; équipe = à venir
  const saeById = new Map(mySaes.map((s) => [s.sae.id, s]));
  const due = milestones
    .filter((m): m is MilestoneLite & { dueAt: Date } => m.dueAt instanceof Date)
    .filter((m) => {
      if (m.dueAt >= now) return true;
      if (staff) return false;
      return m.dueAt.getTime() >= now.getTime() - 14 * DAY && statusByMilestone.get(m.id) !== "SUBMITTED";
    })
    .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())
    .slice(0, 8);

  // Suivi enseignant : auto-évaluations soumises par jalon / effectif de la SAÉ
  let submittedByMilestone = new Map<string, number>();
  if (staff && due.length > 0) {
    const counts = await db.selfAssessment.groupBy({
      by: ["milestoneId"],
      where: { milestoneId: { in: due.map((m) => m.id) }, status: "SUBMITTED" },
      _count: { _all: true },
    });
    submittedByMilestone = new Map(counts.map((c) => [c.milestoneId, c._count._all]));
  }
  const studentsBySae = new Map<string, number>();
  for (const g of groups) studentsBySae.set(g.saeId, (studentsBySae.get(g.saeId) ?? 0) + g._count.members);

  return {
    staff,
    mySaes,
    milestones,
    due,
    saeById,
    statusByMilestone,
    submittedByMilestone,
    studentsBySae,
    announcements,
    favorites,
    todo: { toReview, showcaseRequests, openQuestions },
  };
}

type Dashboard = Awaited<ReturnType<typeof loadDashboard>>;

// ─────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) return <Landing />;

  const now = new Date();
  const data = await loadDashboard(user, now);
  const { staff } = data;

  const firstName = user.name.trim().split(/\s+/)[0] || user.name;
  const hour = Number(new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, hour: "numeric", hourCycle: "h23" }).format(now));
  const greeting = hour >= 18 || hour < 5 ? "Bonsoir" : "Bonjour";
  const today = now.toLocaleDateString("fr-FR", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-2">
        <p className="eyebrow">{today}</p>
        <h1 className="text-2xl font-semibold break-words md:text-4xl">
          {greeting} {firstName}
        </h1>
        <p className="max-w-prose text-muted">{summaryLine(data, now)}</p>
      </header>

      {staff && <ToProcess {...data.todo} />}

      <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_20rem] xl:gap-12">
        <div className="flex min-w-0 flex-col gap-10">
          <DueSection data={data} now={now} />
          <NextSaeTrack data={data} now={now} />
          <Announcements items={data.announcements} now={now} staff={staff} />
        </div>
        <div className="flex min-w-0 flex-col gap-10">
          <MySaesSection data={data} now={now} />
          <FavoritesSection favorites={data.favorites} />
        </div>
      </div>
    </div>
  );
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n > 1 ? many : one}`;
}

function summaryLine(data: Dashboard, now: Date) {
  if (data.staff) {
    const n = data.todo.toReview;
    return n > 0
      ? `${plural(n, "auto-évaluation attend", "auto-évaluations attendent")} votre retour.`
      : "Aucune auto-évaluation n'attend de retour de votre part.";
  }
  const open = data.due.filter((m) => data.statusByMilestone.get(m.id) !== "SUBMITTED");
  const late = open.filter((m) => m.dueAt < now).length;
  const week = open.filter((m) => m.dueAt >= now && m.dueAt.getTime() < now.getTime() + 7 * DAY).length;
  const parts = [week > 0 ? `${plural(week, "rendu", "rendus")} dans les 7 prochains jours` : "Rien à rendre dans les 7 prochains jours"];
  if (late > 0) parts.push(`${late} en retard`);
  return `${parts.join(" · ")}.`;
}

// ─────────────────────────────────────────────────────────────
// Sections
// ─────────────────────────────────────────────────────────────

function Section({
  id,
  title,
  count,
  action,
  children,
}: {
  id: string;
  title: string;
  count?: number;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 border-b border-line pb-1">
        <h2 id={id} className="flex min-h-11 items-center gap-2 text-lg font-semibold">
          {title}
          {count != null && count > 0 && (
            <span className="font-mono text-xs font-medium text-muted tabular-nums">
              <span className="sr-only">(</span>
              {count}
              <span className="sr-only">)</span>
            </span>
          )}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function SectionLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex min-h-11 items-center gap-1 text-sm text-accent hover:underline">
      {children}
      <Icon name="arrowRight" size={16} />
    </Link>
  );
}

/** Équipe pédagogique : ce qui attend une action */
function ToProcess({
  toReview,
  showcaseRequests,
  openQuestions,
}: {
  toReview: number;
  showcaseRequests: number;
  openQuestions: number;
}) {
  const items = [
    { n: toReview, one: "auto-évaluation sans retour publié", many: "auto-évaluations sans retour publié" },
    { n: showcaseRequests, one: "demande de vitrine à valider", many: "demandes de vitrine à valider" },
    { n: openQuestions, one: "question sans réponse sur vos cours", many: "questions sans réponse sur vos cours" },
  ];
  return (
    <section aria-labelledby="a-traiter" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4">
        <h2 id="a-traiter" className="text-lg font-semibold">
          À traiter
        </h2>
        <SectionLink href="/todo">Tout voir</SectionLink>
      </div>
      <ul className="grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3">
        {items.map((it) => (
          <li key={it.one} className="bg-surface">
            <Link
              href="/todo"
              className="flex h-full min-h-11 items-baseline gap-3 p-4 transition-colors hover:bg-sunken sm:flex-col sm:gap-1"
            >
              <span
                className={`font-mono text-2xl font-medium tabular-nums ${it.n > 0 ? "text-ink" : "text-muted"}`}
              >
                {it.n}
              </span>
              <span className="text-sm text-muted">{it.n > 1 ? it.many : it.one}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Liste « À rendre » (étudiant) / « Échéances » (équipe), triée par date */
function DueSection({ data, now }: { data: Dashboard; now: Date }) {
  const { staff, due } = data;
  const title = staff ? "Échéances de mes SAÉ" : "À rendre";

  if (due.length === 0) {
    return (
      <Section id="a-rendre" title={title}>
        {data.mySaes.length === 0 ? (
          staff ? (
            <EmptyState
              icon="track"
              title="Vous ne gérez encore aucune SAÉ."
              action={
                <Link href="/saes/new" className="btn btn-primary">
                  Créer une SAÉ
                </Link>
              }
            >
              Créez une SAÉ, posez ses jalons datés : ils apparaîtront ici avec le nombre d&apos;auto-évaluations
              soumises.
            </EmptyState>
          ) : (
            <EmptyState
              icon="track"
              title="Vous n'êtes dans aucun groupe de SAÉ."
              action={
                <Link href="/saes" className="btn">
                  Voir les SAÉ
                </Link>
              }
            >
              Votre enseignant vous ajoute à un groupe au lancement de la SAÉ ; vos jalons s&apos;afficheront ici,
              triés par date.
            </EmptyState>
          )
        ) : (
          <EmptyState icon="check" title={staff ? "Aucune échéance à venir." : "Rien à rendre pour le moment."}>
            {staff
              ? "Ajoutez des jalons datés à vos SAÉ pour que les étudiants voient la piste."
              : "Les prochains jalons de vos SAÉ apparaîtront ici dès qu'ils seront datés."}
          </EmptyState>
        )}
      </Section>
    );
  }

  return (
    <Section id="a-rendre" title={title} count={due.length} action={<SectionLink href="/todo">À faire</SectionLink>}>
      <ol className="flex flex-col divide-y divide-line">
        {due.map((m) => {
          const entry = data.saeById.get(m.saeId);
          const sae = entry?.sae;
          const href = `/saes/${m.saeId}/milestones/${m.id}`;
          const status = data.statusByMilestone.get(m.id) ?? "NONE";
          const submitted = data.submittedByMilestone.get(m.id) ?? 0;
          const expected = data.studentsBySae.get(m.saeId) ?? 0;
          return (
            <li
              key={m.id}
              className="grid gap-x-4 gap-y-1.5 py-3 sm:grid-cols-[5.5rem_minmax(0,1fr)_auto] sm:items-center"
            >
              <div>
                <DeadlineChip due={m.dueAt} now={now} done={!staff && status === "SUBMITTED"} showDate={false} />
              </div>
              <div className="flex min-w-0 flex-col">
                <Link href={href} className="self-start font-semibold break-words hover:underline">
                  {m.title}
                </Link>
                <p className="text-sm break-words text-muted">
                  {sae && (
                    <>
                      <span className="font-mono text-xs">{sae.code ?? "SAÉ"}</span> {sae.title}
                    </>
                  )}
                  {entry?.group && <> · {entry.group.name}</>}
                  {" · "}
                  <time dateTime={m.dueAt.toISOString()}>
                    {formatDateShort(m.dueAt)}, {formatTime(m.dueAt)}
                  </time>
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {staff ? (
                  <ProgressRing value={submitted} max={expected} label="auto-évaluations soumises" hideLabel />
                ) : (
                  <>
                    <AssessmentStatusBadge status={status} />
                    {status !== "SUBMITTED" && (
                      <Link
                        href={`${href}/assess`}
                        className="inline-flex min-h-11 items-center text-sm font-semibold text-accent hover:underline"
                      >
                        {status === "DRAFT" ? "Reprendre" : "S'auto-évaluer"}
                        <span className="sr-only"> : {m.title}</span>
                      </Link>
                    )}
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </Section>
  );
}

/** Piste de montage de la SAÉ dont l'échéance est la plus proche */
function NextSaeTrack({ data, now }: { data: Dashboard; now: Date }) {
  const upcoming = data.milestones
    .filter((m) => m.dueAt && m.dueAt >= now)
    .sort((a, b) => (a.dueAt as Date).getTime() - (b.dueAt as Date).getTime())[0];
  const saeId = upcoming?.saeId ?? data.mySaes.find((s) => data.milestones.some((m) => m.saeId === s.sae.id))?.sae.id;
  const entry = saeId ? data.saeById.get(saeId) : undefined;
  if (!entry) return null;

  const { sae } = entry;
  const track: TrackMilestone[] = data.milestones
    .filter((m) => m.saeId === sae.id)
    .map((m) => {
      const past = !!m.dueAt && m.dueAt < now;
      const submitted = data.statusByMilestone.get(m.id) === "SUBMITTED";
      const status: TrackMilestone["status"] = data.staff
        ? past
          ? "done"
          : m.dueAt
            ? "pending"
            : "none"
        : submitted
          ? "done"
          : past
            ? "late"
            : m.dueAt
              ? "pending"
              : "none";
      return { id: m.id, title: m.title, dueAt: m.dueAt, href: `/saes/${sae.id}/milestones/${m.id}`, status };
    });

  return (
    <Section id="piste" title="Piste de la SAÉ" action={<SectionLink href={`/saes/${sae.id}`}>Ouvrir la SAÉ</SectionLink>}>
      <p className="text-sm break-words text-muted">
        <span className="font-mono text-xs">{sae.code ?? "SAÉ"}</span> {sae.title}
        {entry.group && <> · {entry.group.name}</>}
      </p>
      <MilestoneTrack
        compact
        label={`Jalons de ${sae.code ?? sae.title}`}
        milestones={track}
        start={sae.startsAt}
        end={sae.endsAt}
        now={now}
        statusLabels={data.staff ? { done: "Échéance passée" } : { done: "Soumise" }}
      />
    </Section>
  );
}

const SCOPE_LABEL = { GLOBAL: "Tout le département", COHORT: "Promo", COURSE: "Cours", SAE: "SAÉ" } as const;
const BODY_PREVIEW = 420;

function Announcements({ items, now, staff }: { items: Dashboard["announcements"]; now: Date; staff: boolean }) {
  return (
    <Section
      id="annonces"
      title="Annonces"
      action={staff ? <SectionLink href="/admin/announcements">Publier</SectionLink> : undefined}
    >
      {items.length === 0 ? (
        <EmptyState icon="megaphone">
          Aucune annonce pour l&apos;instant. Les messages du département, de votre promo et de vos SAÉ s&apos;affichent
          ici.
        </EmptyState>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {items.map((a) => {
            const where =
              a.scope === "COHORT"
                ? a.cohort?.name
                : a.scope === "SAE"
                  ? (a.sae?.code ?? a.sae?.title)
                  : a.scope === "COURSE"
                    ? a.course?.title
                    : undefined;
            const cut = a.body.length > BODY_PREVIEW ? a.body.lastIndexOf(" ", BODY_PREVIEW) : -1;
            const head = cut > 0 ? a.body.slice(0, cut) : a.body;
            const rest = cut > 0 ? a.body.slice(cut + 1) : "";
            return (
              <li key={a.id} className="flex flex-col gap-1.5 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  {a.pinned && <StatusBadge tone="accent">Épinglée</StatusBadge>}
                  <span className="eyebrow">
                    {SCOPE_LABEL[a.scope]}
                    {where ? ` · ${where}` : ""}
                  </span>
                </div>
                <h3 className="text-base font-semibold break-words">{a.title}</h3>
                <p className="max-w-prose break-words whitespace-pre-line">
                  {head}
                  {rest && "…"}
                </p>
                {rest && (
                  <details className="group max-w-prose">
                    <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-semibold text-accent hover:underline">
                      <span className="group-open:hidden">Lire la suite</span>
                      <span className="hidden group-open:inline">Réduire</span>
                    </summary>
                    <p className="break-words whitespace-pre-line">{rest}</p>
                  </details>
                )}
                <p className="text-sm text-muted">
                  {a.author.name} · <time dateTime={a.createdAt.toISOString()}>{timeAgo(a.createdAt, now)}</time>
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

function MySaesSection({ data, now }: { data: Dashboard; now: Date }) {
  const { mySaes, milestones, staff } = data;
  return (
    <Section id="mes-saes" title="Mes SAÉ" action={<SectionLink href="/saes">Toutes</SectionLink>}>
      {mySaes.length === 0 ? (
        <p className="text-muted">
          {staff ? "Aucune SAÉ gérée pour l'instant." : "Aucun groupe de SAÉ pour l'instant."}
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          {mySaes.slice(0, 6).map(({ sae, group }) => {
            const own = milestones.filter((m) => m.saeId === sae.id);
            const past = own.filter((m) => m.dueAt && m.dueAt < now).length;
            const next = own
              .filter((m): m is MilestoneLite & { dueAt: Date } => !!m.dueAt && m.dueAt >= now)
              .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())[0];
            return (
              <li key={sae.id} className="min-w-0">
                <Link
                  href={`/saes/${sae.id}`}
                  className="card flex h-full flex-col gap-1.5 transition-colors hover:border-line-strong"
                >
                  <span className="eyebrow">
                    {sae.code ?? "SAÉ"}
                    {sae.semester != null ? ` · S${sae.semester}` : ""}
                  </span>
                  <span className="font-display leading-snug font-semibold break-words">{sae.title}</span>
                  {group && <span className="text-sm text-muted">Groupe : {group.name}</span>}
                  <span className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
                    <ProgressRing value={past} max={own.length} label="jalons passés" />
                    {next && <DeadlineChip due={next.dueAt} now={now} showDate={false} />}
                    {!sae.published && <StatusBadge>Brouillon</StatusBadge>}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {mySaes.length > 6 && <SectionLink href="/saes">{`${mySaes.length - 6} autres SAÉ`}</SectionLink>}
    </Section>
  );
}

const FAV_TAG = { COURSE: "Cours", PAGE: "Page", SAE: "SAÉ" } as const;

function FavoritesSection({ favorites }: { favorites: Dashboard["favorites"] }) {
  return (
    <Section id="favoris" title="Favoris" count={favorites.length}>
      {favorites.length === 0 ? (
        <p className="text-muted">
          L&apos;étoile « Favori » d&apos;un cours, d&apos;une page ou d&apos;une SAÉ l&apos;épingle ici et dans le menu.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {favorites.slice(0, 20).map((f) => (
            <li key={f.id}>
              <Link href={f.href} className="flex min-h-11 items-center gap-3 py-2 hover:underline">
                <span className="w-10 shrink-0 font-mono text-xs text-muted">{FAV_TAG[f.kind]}</span>
                <span className="flex min-w-0 flex-col">
                  <span className="break-words">{f.label}</span>
                  {f.context && <span className="text-sm text-muted">{f.context}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

// ─────────────────────────────────────────────────────────────
// Visiteur non connecté
// ─────────────────────────────────────────────────────────────

const POINTS = [
  {
    title: "Les cours, lisibles comme une doc",
    body: "Supports rédigés dans un éditeur par blocs, avec sommaire, recherche, et questions posées directement sur la page.",
  },
  {
    title: "Les SAÉ, jalon par jalon",
    body: "Sujet, groupe, échéances et liens de rendu au même endroit. La piste montre où en est le projet et ce qui vient ensuite.",
  },
  {
    title: "Une auto-évaluation qui sert",
    body: "À chaque jalon, vous vous positionnez sur les apprentissages critiques ; l'enseignant compare, commente et publie son retour.",
  },
];

function Landing() {
  const now = new Date();
  const at = (days: number) => new Date(now.getTime() + days * DAY);
  const demo: TrackMilestone[] = [
    { id: "d1", title: "Cahier des charges", dueAt: at(-19), status: "done" },
    { id: "d2", title: "Maquettes validées", dueAt: at(-6), status: "done" },
    { id: "d3", title: "Prototype fonctionnel", dueAt: at(2), status: "pending" },
    { id: "d4", title: "Mise en ligne", dueAt: at(16), status: "pending" },
    { id: "d5", title: "Soutenance", dueAt: at(23), status: "pending" },
  ];

  return (
    <div className="flex flex-col gap-12 md:gap-16">
      <div className="flex max-w-2xl flex-col gap-5">
        <p className="eyebrow">BUT MMI · Métiers du multimédia et de l&apos;internet</p>
        <h1 className="text-2xl font-semibold md:text-4xl">Les cours, les SAÉ et vos jalons, au même endroit.</h1>
        <p className="max-w-prose text-muted">
          La plateforme du département : lire les supports, suivre les projets de groupe et s&apos;auto-évaluer à chaque
          rendu. Les enseignants suivent l&apos;avancement sans tableur.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link href="/login" className="btn btn-primary">
            Se connecter
          </Link>
          <Link href="/register" className="btn">
            Créer un compte étudiant
          </Link>
        </div>
      </div>

      <figure className="flex flex-col gap-3">
        <figcaption className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="eyebrow">Exemple · données fictives</span>
          <span className="text-sm text-muted">
            SAÉ 2.03 — la piste d&apos;une SAÉ : chaque jalon est un clip, la tête de lecture marque aujourd&apos;hui.
          </span>
        </figcaption>
        <div className="card md:p-6">
          <MilestoneTrack
            label="Exemple de jalons d'une SAÉ"
            milestones={demo}
            start={at(-33)}
            end={at(28)}
            now={now}
            statusLabels={{ done: "Soumis" }}
          />
        </div>
      </figure>

      <ol className="grid gap-x-10 border-t border-line md:grid-cols-3">
        {POINTS.map((p, i) => (
          <li key={p.title} className="flex flex-col gap-1.5 border-b border-line py-5 md:border-b-0">
            <span className="font-mono text-xs text-muted">{String(i + 1).padStart(2, "0")}</span>
            <h2 className="text-lg font-semibold">{p.title}</h2>
            <p className="text-muted">{p.body}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
