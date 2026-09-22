import { db } from "@/lib/db";
import { buildIcs } from "@/lib/ics";
import { isStaff } from "@/lib/permissions";
import {
  calendarWindow,
  defenseEvent,
  milestoneEvent,
  parseCalendarToken,
  resolveBaseUrl,
  type CalendarMilestone,
  type CalendarSlot,
} from "../_lib/calendar";

// Flux personnel : jamais mis en cache côté serveur (le client agenda rafraîchit seul)
export const dynamic = "force-dynamic";

const MAX_MILESTONES = 500;
const MAX_SLOTS = 300;

const saeSelect = { id: true, code: true, title: true } as const;

function notFound() {
  return new Response("Calendrier introuvable.", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/**
 * GET /api/calendar/<jeton>[.ics] — flux iCalendar des échéances et soutenances.
 * Authentification par jeton secret (pas de session : les agendas s'abonnent sans cookie).
 */
export async function GET(request: Request, ctx: RouteContext<"/api/calendar/[token]">) {
  const { token: raw } = await ctx.params;
  const token = parseCalendarToken(raw);
  if (!token) return notFound();

  const user = await db.user.findUnique({ where: { calendarToken: token }, select: { id: true, role: true } });
  if (!user) return notFound();

  const actor = { id: user.id, role: user.role };
  const now = new Date();
  const { from, to } = calendarWindow(now);
  const staff = isStaff(actor);

  let saeIds: string[];
  let groupIds: string[] = [];
  if (staff) {
    // SAÉ gérées explicitement (responsable ou co-enseignant), y compris non publiées
    const managed = await db.sae.findMany({
      where: { OR: [{ ownerId: actor.id }, { teachers: { some: { id: actor.id } } }] },
      select: { id: true },
      take: 200,
    });
    saeIds = managed.map((s) => s.id);
  } else {
    // SAÉ publiées où l'étudiant est membre d'un groupe
    const memberships = await db.groupMember.findMany({
      where: { userId: actor.id, group: { sae: { published: true } } },
      select: { groupId: true, group: { select: { saeId: true } } },
      take: 200,
    });
    saeIds = [...new Set(memberships.map((m) => m.group.saeId))];
    groupIds = memberships.map((m) => m.groupId);
  }

  let milestones: CalendarMilestone[] = [];
  let slots: CalendarSlot[] = [];
  if (saeIds.length > 0) {
    const [rawMilestones, rawSlots] = await Promise.all([
      db.milestone.findMany({
        where: { saeId: { in: saeIds }, dueAt: { gte: from, lte: to } },
        select: { id: true, title: true, dueAt: true, sae: { select: saeSelect } },
        orderBy: { dueAt: "asc" },
        take: MAX_MILESTONES,
      }),
      db.defenseSlot.findMany({
        where: staff
          ? { saeId: { in: saeIds }, groupId: { not: null }, startsAt: { gte: from, lte: to } }
          : { groupId: { in: groupIds }, startsAt: { gte: from, lte: to } },
        select: {
          id: true,
          startsAt: true,
          durationMin: true,
          location: true,
          sae: { select: saeSelect },
          group: { select: { name: true } },
        },
        orderBy: { startsAt: "asc" },
        take: MAX_SLOTS,
      }),
    ]);
    milestones = rawMilestones.flatMap((m) => (m.dueAt ? [{ ...m, dueAt: m.dueAt }] : []));
    slots = rawSlots;
  }

  const baseUrl = resolveBaseUrl(process.env.BETTER_AUTH_URL, new URL(request.url).origin);
  const events = [
    ...milestones.map((m) => milestoneEvent(m, baseUrl)),
    ...slots.map((s) => defenseEvent(s, baseUrl, staff)),
  ];

  const body = buildIcs("Cours & SAÉ — échéances", events, now);
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="cours-sae.ics"',
      "Cache-Control": "private, max-age=900",
      "X-Robots-Tag": "noindex, nofollow",
      "Referrer-Policy": "no-referrer",
    },
  });
}
