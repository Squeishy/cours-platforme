import type { Metadata } from "next";
import Link from "next/link";
import { after } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { formatDateTime, timeAgo } from "@/lib/format";
import { EmptyState, PageHeader } from "@/components/ui";
import { markAllRead, openNotification } from "./actions";
import { MarkAllReadButton, OpenNotificationButton } from "./_components/notification-buttons";
import { cleanupReadNotifications } from "./_lib/cleanup";
import {
  NOTIFICATIONS_PAGE_SIZE,
  READ_RETENTION_DAYS,
  notificationTypeLabel,
  pageCount,
  pageSlices,
  parsePage,
  safeInternalPath,
} from "./_lib/notifications";

export const metadata: Metadata = { title: "Notifications" };

const select = { id: true, type: true, title: true, body: true, link: true, readAt: true, createdAt: true } as const;

type Item = { id: string; type: string; title: string; body: string | null; link: string | null; readAt: Date | null; createdAt: Date };

function pageHref(page: number) {
  return page > 1 ? `/notifications?page=${page}` : "/notifications";
}

function ItemContent({ n, now }: { n: Item; now: Date }) {
  const unread = !n.readAt;
  return (
    <span className="flex min-w-0 flex-1 gap-3">
      <span aria-hidden="true" className={`mt-2 size-2 shrink-0 rounded-full ${unread ? "bg-accent" : "bg-transparent"}`} />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-mono text-xs tracking-wide text-muted uppercase">{notificationTypeLabel(n.type)}</span>
          {unread && <span className="sr-only">(non lue)</span>}
          <time dateTime={n.createdAt.toISOString()} title={formatDateTime(n.createdAt)} className="font-mono text-xs text-muted">
            {timeAgo(n.createdAt, now)}
          </time>
        </span>
        <span className={`break-words ${unread ? "font-semibold" : "font-medium"}`}>{n.title}</span>
        {n.body && <span className="line-clamp-3 text-sm break-words whitespace-pre-line text-muted">{n.body}</span>}
      </span>
    </span>
  );
}

const rowClass = "flex min-h-11 w-full gap-3 px-4 py-3 text-left hover:bg-sunken";

function NotificationRow({ n, now }: { n: Item; now: Date }) {
  const link = safeInternalPath(n.link);
  if (!n.readAt) {
    return (
      <form action={openNotification.bind(null, n.id)}>
        <OpenNotificationButton className={`${rowClass} cursor-pointer`}>
          <ItemContent n={n} now={now} />
          <span className="sr-only">{link ? "Ouvrir" : "Marquer comme lue"}</span>
        </OpenNotificationButton>
      </form>
    );
  }
  if (link) {
    return (
      <Link href={link} className={rowClass}>
        <ItemContent n={n} now={now} />
      </Link>
    );
  }
  return (
    <div className="flex w-full gap-3 px-4 py-3">
      <ItemContent n={n} now={now} />
    </div>
  );
}

function Group({ id, title, items, now }: { id: string; title: string; items: Item[]; now: Date }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h2 id={id} className="eyebrow">
        {title}
      </h2>
      <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-md border border-line bg-surface">
        {items.map((n) => (
          <li key={n.id}>
            <NotificationRow n={n} now={now} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function NotificationsPage({ searchParams }: PageProps<"/notifications">) {
  const user = await requireUser();
  const { page: rawPage } = await searchParams;
  const page = parsePage(rawPage);

  // Nettoyage borné après la réponse : notifications lues de plus de 90 jours
  const userId = user.id;
  after(() => cleanupReadNotifications(userId));

  const [unreadCount, total] = await Promise.all([
    db.notification.count({ where: { userId, readAt: null } }),
    db.notification.count({ where: { userId } }),
  ]);
  const pages = pageCount(total, NOTIFICATIONS_PAGE_SIZE);
  const current = Math.min(page, pages);
  const slices = pageSlices(current, NOTIFICATIONS_PAGE_SIZE, unreadCount);

  const [unread, read] = await Promise.all([
    slices.unread.take > 0
      ? db.notification.findMany({
          where: { userId, readAt: null },
          select,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          skip: slices.unread.skip,
          take: slices.unread.take,
        })
      : Promise.resolve([]),
    slices.read.take > 0
      ? db.notification.findMany({
          where: { userId, readAt: { not: null } },
          select,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          skip: slices.read.skip,
          take: slices.read.take,
        })
      : Promise.resolve([]),
  ]);

  const now = new Date();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeader
        eyebrow="Suivi"
        title="Notifications"
        meta={<span aria-live="polite">{unreadCount === 0 ? "Tout est lu" : `${unreadCount} non lue${unreadCount > 1 ? "s" : ""}`}</span>}
        actions={unreadCount > 0 ? <MarkAllReadButton action={markAllRead} /> : undefined}
      />

      {total === 0 ? (
        <EmptyState
          title="Aucune notification."
          action={
            <Link href="/todo" className="btn">
              Voir ce qu&apos;il reste à faire
            </Link>
          }
        >
          Vous serez prévenu·e ici des commentaires sur vos auto-évaluations, des retours enseignants, des annonces et des
          créneaux de soutenance.
        </EmptyState>
      ) : (
        <>
          <Group id="notif-unread" title="Non lues" items={unread} now={now} />
          <Group id="notif-read" title="Plus anciennes" items={read} now={now} />
          <p className="text-xs text-muted">
            Les notifications lues sont effacées automatiquement après {READ_RETENTION_DAYS} jours.
          </p>
        </>
      )}

      {pages > 1 && (
        <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-2">
          {current > 1 ? (
            <Link href={pageHref(current - 1)} className="btn" rel="prev">
              ← Plus récentes
            </Link>
          ) : (
            <span />
          )}
          <span className="font-mono text-sm text-muted">
            {current} / {pages}
          </span>
          {current < pages ? (
            <Link href={pageHref(current + 1)} className="btn" rel="next">
              Plus anciennes →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
