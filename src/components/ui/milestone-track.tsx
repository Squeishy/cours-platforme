import Link from "next/link";
import type { ReactNode } from "react";
import { deadline, formatDate, formatDateShort } from "@/lib/format";
import { DeadlineChip } from "./deadline-chip";
import { Icon, type IconName } from "./icon";
import { StatusBadge, type StatusTone } from "./status-badge";
import { cx } from "./cx";

/**
 * MilestoneTrack — la « piste de montage » (signature visuelle, docs/DESIGN.md).
 *
 * Chaque jalon est un clip posé sur une timeline : le clip couvre la période de travail
 * (du jalon précédent — ou du début — jusqu'à son échéance), son bord droit est l'échéance.
 * La tête de lecture (accent) marque aujourd'hui, avec un timecode mono « S04 · J-3 ».
 *
 * - Conteneur ≥ 42rem (≥ 36rem en `compact`) : piste horizontale. En dessous : liste verticale.
 *   Bascule par container query : le composant s'adapte à la colonne où on le pose.
 * - Accessible : une liste ordonnée, chaque jalon porte son titre, sa date et son statut en texte ;
 *   un résumé « Aujourd'hui… prochaine échéance… » est lu avant la liste.
 * - Aucune animation (statique par construction, y compris sous prefers-reduced-motion).
 * - Pur (ni hook ni état) : utilisable en composant serveur ou client. Dans un composant client,
 *   passer `now` depuis le serveur pour éviter un écart d'hydratation.
 *
 *   <MilestoneTrack
 *     label="Jalons de la SAÉ 2.03"
 *     start={sae.startsAt} end={sae.endsAt}
 *     milestones={sae.milestones.map((m) => ({
 *       id: m.id, title: m.title, dueAt: m.dueAt,
 *       href: `/saes/${sae.id}/milestones/${m.id}`,
 *       status: submitted.has(m.id) ? "done" : m.dueAt && m.dueAt < now ? "late" : m.dueAt ? "pending" : "none",
 *     }))}
 *   />
 *
 * Statuts : done (fait / rendu), pending (à venir), late (échéance dépassée sans rendu),
 * none (pas de statut personnel — ex. vue enseignant). Libellés surchargeables via `statusLabels`.
 * Sans `start`, la règle affiche des dates (12/10) au lieu des semaines de SAÉ (S01, S02…).
 */
export type MilestoneStatus = "done" | "pending" | "late" | "none";

export type TrackMilestone = {
  id: string;
  title: string;
  dueAt: Date | null;
  href?: string;
  status: MilestoneStatus;
};

export type MilestoneTrackProps = {
  milestones: TrackMilestone[];
  /** Début de la SAÉ (sinon : 14 jours avant le premier jalon) */
  start?: Date | null;
  /** Fin de la SAÉ (sinon : 3 jours après le dernier jalon) */
  end?: Date | null;
  now?: Date;
  /** Nom accessible de la liste, ex. « Jalons de la SAÉ 2.03 » */
  label?: string;
  statusLabels?: Partial<Record<MilestoneStatus, string>>;
  /** Version réduite (accueil) : clips sur une ligne, sans règle ni légende */
  compact?: boolean;
  className?: string;
};

const DAY = 86_400_000;
const WEEK = 7 * DAY;
const TZ = "Europe/Paris";

const DEFAULT_LABELS: Record<MilestoneStatus, string> = {
  done: "Terminé",
  pending: "À venir",
  late: "En retard",
  none: "",
};

const STATUS_TONE: Record<MilestoneStatus, StatusTone> = {
  done: "ok",
  pending: "neutral",
  late: "danger",
  none: "neutral",
};

const STATUS_ICON: Record<MilestoneStatus, IconName | null> = {
  done: "check",
  pending: "clock",
  late: "alert",
  none: null,
};

const CLIP_CLASS: Record<MilestoneStatus | "active", string> = {
  done: "border-ok bg-ok-soft",
  late: "border-danger bg-danger-soft",
  pending: "border-line-strong bg-surface",
  none: "border-line-strong bg-sunken",
  active: "border-accent bg-accent-soft",
};

const ICON_CLASS: Record<MilestoneStatus | "active", string> = {
  done: "text-ok",
  late: "text-danger",
  pending: "text-muted",
  none: "text-muted",
  active: "text-accent",
};

function shortDate(d: Date) {
  return d.toLocaleDateString("fr-FR", { timeZone: TZ, day: "2-digit", month: "2-digit" });
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function spoken(label: string) {
  const m = /^J-(\d+)$/.exec(label);
  return m ? `dans ${m[1]} jours` : label.toLowerCase();
}

type Dated = TrackMilestone & { dueAt: Date };
type Segment = { from: number; to: number; clip: Dated | null; index: number };

/** Géométrie : segments contigus, largeur minimale par clip, projection temps → position (0..1) */
function buildGeometry(dated: Dated[], start: Date | null | undefined, end: Date | null | undefined) {
  const first = dated[0].dueAt.getTime();
  const last = dated[dated.length - 1].dueAt.getTime();
  const s = Math.min(start ? start.getTime() : first - 14 * DAY, first);
  let e = Math.max(end ? end.getTime() : last + 3 * DAY, last);
  if (e - s < 7 * DAY) e = s + 7 * DAY;
  const span = e - s;

  const segments: Segment[] = dated.map((m, i) => ({
    from: i === 0 ? s : dated[i - 1].dueAt.getTime(),
    to: m.dueAt.getTime(),
    clip: m,
    index: i,
  }));
  if (e > last) segments.push({ from: last, to: e, clip: null, index: -1 });

  // Largeur minimale d'un clip, redistribuée sur les segments plus larges
  const min = Math.min(0.05, 0.8 / dated.length);
  const floor = segments.map((g) => (g.clip ? min : 0));
  const bumped = segments.map((g, i) => Math.max((g.to - g.from) / span, floor[i]));
  const excess = bumped.reduce((a, b) => a + b, 0) - 1;
  const flexible = bumped.map((b, i) => b > floor[i] && (segments[i].clip === null || b > min));
  const surplus = bumped.reduce((a, b, i) => a + (flexible[i] ? b - floor[i] : 0), 0);
  const scale = surplus > 0 ? Math.max(0, (surplus - excess) / surplus) : 1;
  const widths = bumped.map((b, i) => (flexible[i] ? floor[i] + (b - floor[i]) * scale : b));
  const lefts: number[] = [];
  widths.reduce((acc, w, i) => {
    lefts[i] = acc;
    return acc + w;
  }, 0);

  const x = (t: number) => {
    if (t <= s) return 0;
    if (t >= e) return 1;
    const i = segments.findIndex((g) => t <= g.to);
    if (i < 0) return 1;
    const g = segments[i];
    const local = g.to > g.from ? (t - g.from) / (g.to - g.from) : 1;
    return Math.min(1, lefts[i] + local * widths[i]);
  };

  return { s, e, segments, widths, lefts, x };
}

function pct(v: number) {
  return `${(v * 100).toFixed(3)}%`;
}

export function MilestoneTrack({
  milestones,
  start,
  end,
  now: nowProp,
  label = "Jalons",
  statusLabels,
  compact = false,
  className,
}: MilestoneTrackProps) {
  if (milestones.length === 0) {
    return <p className={cx("text-muted", className)}>Aucun jalon pour l&apos;instant.</p>;
  }

  const now = nowProp ?? new Date();
  const labels = { ...DEFAULT_LABELS, ...statusLabels };
  const dated = milestones
    .filter((m): m is Dated => m.dueAt instanceof Date)
    .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
  const undated = milestones.filter((m) => !(m.dueAt instanceof Date));
  const ordered: TrackMilestone[] = [...dated, ...undated];
  const total = ordered.length;
  const nowT = now.getTime();

  const next = dated.find((m) => m.dueAt.getTime() > nowT && m.status !== "done") ?? dated.find((m) => m.dueAt.getTime() > nowT);
  const nextDeadline = next ? deadline(next.dueAt, now) : null;
  const geo = dated.length > 0 ? buildGeometry(dated, start, end) : null;

  // Timecode de la tête de lecture
  let timecode = nextDeadline?.label ?? "Aujourd'hui";
  let weekText = "";
  if (geo) {
    if (nowT < geo.s) {
      timecode = `Début ${deadline(new Date(geo.s), now).label}`;
    } else if (nowT > geo.e) {
      timecode = "Terminée";
    } else if (start) {
      const week = Math.floor((nowT - geo.s) / WEEK) + 1;
      weekText = `semaine ${week} de la SAÉ`;
      timecode = `S${pad2(week)}${nextDeadline ? ` · ${nextDeadline.label}` : ""}`;
    }
  }

  const summary =
    `Aujourd'hui ${formatDate(now)}${weekText ? `, ${weekText}` : ""}. ` +
    (next && nextDeadline
      ? `Prochaine échéance : « ${next.title} », ${spoken(nextDeadline.label)} (${formatDateShort(next.dueAt)}).`
      : "Aucune échéance à venir.");

  // Index du premier jalon daté après aujourd'hui (position du repère « Aujourd'hui » dans la liste)
  const firstFuture = dated.findIndex((m) => m.dueAt.getTime() > nowT);
  const markerAt = firstFuture === -1 ? dated.length : firstFuture;

  const srItem = (m: TrackMilestone, i: number) =>
    `, jalon ${i + 1} sur ${total}` +
    (m.dueAt ? `, échéance ${formatDateShort(m.dueAt)}` : ", sans date") +
    (labels[m.status] ? `, ${labels[m.status].toLowerCase()}` : "");

  const horizontalShow = compact ? "hidden @xl:block" : "hidden @2xl:block";
  const verticalShow = geo ? (compact ? "@xl:hidden" : "@2xl:hidden") : "";

  return (
    <div className={cx("@container", className)}>
      <p className="sr-only">{summary}</p>

      {geo && (
        <div className={horizontalShow}>
          <HorizontalTrack
            geo={geo}
            now={now}
            timecode={timecode}
            compact={compact}
            label={label}
            srItem={srItem}
            showWeeks={!!start}
            end={end}
          />
          {undated.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="eyebrow">Sans date</span>
              <ul className="flex flex-wrap gap-2">
                {undated.map((m, i) => (
                  <li key={m.id}>
                    <ClipLink href={m.href} className="inline-flex min-h-11 items-center rounded-sm border border-line bg-sunken px-2 text-sm">
                      {m.title}
                      <span className="sr-only">{srItem(m, dated.length + i)}</span>
                    </ClipLink>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-sm">
            {next && nextDeadline ? (
              <p className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="text-muted">Prochain :</span>
                {next.href ? (
                  <Link href={next.href} className="min-w-0 font-semibold break-words hover:underline">
                    {next.title}
                  </Link>
                ) : (
                  <span className="min-w-0 font-semibold break-words">{next.title}</span>
                )}
                <DeadlineChip due={next.dueAt} now={now} />
              </p>
            ) : (
              <p className="text-muted">Aucune échéance à venir.</p>
            )}
            {!compact && <Legend labels={labels} />}
          </div>
        </div>
      )}

      <ol aria-label={label} className={cx("flex flex-col", verticalShow)}>
        {ordered.map((m, i) => (
          <li key={m.id} className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-3">
            {geo && i === markerAt && <NowRow timecode={timecode} />}
            <VerticalRail status={m.status} last={i === ordered.length - 1 && markerAt < ordered.length} />
            <div className="flex min-w-0 flex-col gap-1 pb-5">
              <ClipLink href={m.href} className="min-w-0 self-start font-semibold break-words hover:underline">
                {m.title}
                <span className="sr-only">{srItem(m, i)}</span>
              </ClipLink>
              <div aria-hidden="true" className="flex flex-wrap items-center gap-2">
                <ItemMeta m={m} now={now} labels={labels} />
              </div>
            </div>
          </li>
        ))}
        {geo && markerAt === ordered.length && (
          <li aria-hidden="true" className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-3">
            <NowRow timecode={timecode} />
          </li>
        )}
      </ol>
    </div>
  );
}

/* ── Horizontal ─────────────────────────────────────────────── */

type Geo = NonNullable<ReturnType<typeof buildGeometry>>;

function HorizontalTrack({
  geo,
  now,
  timecode,
  compact,
  label,
  srItem,
  showWeeks,
  end,
}: {
  geo: Geo;
  now: Date;
  timecode: string;
  compact: boolean;
  label: string;
  srItem: (m: TrackMilestone, i: number) => string;
  showWeeks: boolean;
  end?: Date | null;
}) {
  const nowT = now.getTime();
  const head = geo.x(nowT);
  const flagAlign = head < 0.12 ? "translate-x-0" : head > 0.88 ? "-translate-x-full" : "-translate-x-1/2";

  // Règle : une graduation par semaine (ou 2 / 4 semaines si la SAÉ est longue)
  const weeks = Math.ceil((geo.e - geo.s) / WEEK);
  const step = weeks <= 12 ? 1 : weeks <= 24 ? 2 : 4;
  const ticks: { x: number; text: string }[] = [];
  for (let k = 0; k < weeks; k += step) {
    const t = geo.s + k * WEEK;
    const x = geo.x(t);
    if (x > 0.94) break;
    ticks.push({ x, text: showWeeks ? `S${pad2(k + 1)}` : shortDate(new Date(t)) });
  }

  return (
    <div className="relative pt-7">
      {/* Tête de lecture : trait + timecode (décoratifs, résumé lu plus haut) */}
      <div aria-hidden="true" className="pointer-events-none absolute top-0 bottom-0 z-10 w-0" style={{ left: pct(head) }}>
        <span
          className={cx(
            "absolute top-0 rounded-sm bg-accent px-1.5 py-0.5 font-mono text-xs font-medium whitespace-nowrap text-accent-ink tabular-nums",
            flagAlign,
          )}
        >
          {timecode}
        </span>
        <span className="absolute top-5 bottom-0 -left-px w-0.5 bg-accent" />
      </div>

      {!compact && (
        <div aria-hidden="true" className="relative h-5 border-b border-line">
          {ticks.map((t, i) => (
            <span
              key={i}
              className="absolute bottom-0 h-full border-l border-line pl-1 font-mono text-xs leading-4 text-muted tabular-nums"
              style={{ left: pct(t.x) }}
            >
              {t.text}
            </span>
          ))}
        </div>
      )}

      <ol aria-label={label} className={cx("relative mt-1.5", compact ? "h-11" : "h-14")}>
        {geo.segments.map((g, i) => {
          const style = { left: `calc(${pct(geo.lefts[i])} + 1px)`, width: `calc(${pct(geo.widths[i])} - 2px)` };
          if (!g.clip) {
            return (
              <li key="tail" aria-hidden="true" className="track-hatch absolute top-0 bottom-0 overflow-hidden rounded-sm" style={style}>
                {end && !compact && (
                  <span className="absolute right-1.5 bottom-1 font-mono text-xs text-muted">Fin {shortDate(end)}</span>
                )}
              </li>
            );
          }
          const m = g.clip;
          const active = g.from < nowT && nowT <= g.to && (m.status === "pending" || m.status === "none");
          const key = active ? "active" : m.status;
          const icon = active ? "clock" : STATUS_ICON[m.status];
          return (
            <li key={m.id} className="absolute top-0 bottom-0" style={style}>
              <ClipLink
                href={m.href}
                title={`${m.title} — ${formatDateShort(m.dueAt)}`}
                className={cx(
                  "group flex h-full min-w-0 overflow-hidden rounded-sm border border-l-3 px-2 text-ink",
                  compact ? "items-center gap-1.5" : "flex-col justify-center gap-0.5",
                  CLIP_CLASS[key],
                )}
              >
                <span aria-hidden="true" className="flex shrink-0 items-center gap-1 font-mono text-xs text-muted tabular-nums">
                  {icon && <Icon name={icon} size={14} strokeWidth={2} className={ICON_CLASS[key]} />}
                  {shortDate(m.dueAt)}
                </span>
                <span className="line-clamp-2 min-w-0 text-sm font-semibold break-words group-hover:underline">{m.title}</span>
                <span className="sr-only">
                  {srItem(m, g.index)}
                  {active ? ", en cours" : ""}
                </span>
              </ClipLink>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Legend({ labels }: { labels: Record<MilestoneStatus, string> }) {
  const items = (["done", "late", "pending"] as const).filter((s) => labels[s]);
  return (
    <ul aria-label="Légende" className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
      {items.map((s) => (
        <li key={s} className="flex items-center gap-1.5">
          <span aria-hidden="true" className={cx("inline-flex size-4 items-center justify-center rounded-sm border border-l-3", CLIP_CLASS[s])}>
            {STATUS_ICON[s] && <Icon name={STATUS_ICON[s]} size={10} strokeWidth={2.5} className={ICON_CLASS[s]} />}
          </span>
          {labels[s]}
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <span aria-hidden="true" className="h-3.5 w-0.5 bg-accent" />
        Aujourd&apos;hui
      </li>
    </ul>
  );
}

/* ── Vertical ───────────────────────────────────────────────── */

function NowRow({ timecode }: { timecode: string }) {
  return (
    <div aria-hidden="true" className="col-span-2 grid grid-cols-[1.5rem_minmax(0,1fr)] items-center gap-x-3 pb-4">
      <span className="flex justify-center">
        <span className="size-2.5 rounded-full bg-accent ring-4 ring-accent-soft" />
      </span>
      <span className="flex items-center gap-2">
        <span className="rounded-sm bg-accent px-1.5 py-0.5 font-mono text-xs font-medium text-accent-ink tabular-nums">
          {timecode}
        </span>
        <span className="h-0.5 flex-1 bg-accent/30" />
      </span>
    </div>
  );
}

function VerticalRail({ status, last }: { status: MilestoneStatus; last: boolean }) {
  const icon = STATUS_ICON[status];
  return (
    <span aria-hidden="true" className="relative flex justify-center">
      {!last && <span className="absolute top-6 bottom-0 w-px bg-line" />}
      <span
        className={cx(
          "relative mt-0.5 flex size-5 items-center justify-center rounded-full border border-l-3",
          CLIP_CLASS[status],
        )}
      >
        {icon && <Icon name={icon} size={12} strokeWidth={2.25} className={ICON_CLASS[status]} />}
      </span>
    </span>
  );
}

function ItemMeta({ m, now, labels }: { m: TrackMilestone; now: Date; labels: Record<MilestoneStatus, string> }) {
  if (!m.dueAt) {
    return <span className="font-mono text-xs text-muted">Sans date</span>;
  }
  if (m.status === "pending") return <DeadlineChip due={m.dueAt} now={now} />;
  return (
    <>
      {labels[m.status] && <StatusBadge tone={STATUS_TONE[m.status]}>{labels[m.status]}</StatusBadge>}
      <span className="text-sm text-muted">{formatDateShort(m.dueAt)}</span>
    </>
  );
}

function ClipLink({
  href,
  className,
  title,
  children,
}: {
  href?: string;
  className?: string;
  title?: string;
  children: ReactNode;
}) {
  if (!href) {
    return (
      <span className={className} title={title}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} className={className} title={title}>
      {children}
    </Link>
  );
}
