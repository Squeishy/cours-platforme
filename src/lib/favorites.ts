import "server-only";
import { db } from "@/lib/db";
import { canViewCourse, canViewSae, type Role } from "@/lib/permissions";

export type ResolvedFavorite = { id: string; kind: "COURSE" | "PAGE" | "SAE"; label: string; href: string; context?: string };

/**
 * Favoris d'un utilisateur, résolus en libellés + liens. Les cibles supprimées disparaissent, et celles
 * redevenues invisibles (cours/SAÉ repassés en brouillon) sont masquées — pas de fuite de titre.
 */
export async function listFavorites(userId: string): Promise<ResolvedFavorite[]> {
  const [favs, me] = await Promise.all([
    db.favorite.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 50 }),
    db.user.findUnique({ where: { id: userId }, select: { id: true, role: true } }),
  ]);
  if (!me) return [];
  const actor = { id: me.id, role: me.role as Role };
  const ids = (k: string) => favs.filter((f) => f.kind === k).map((f) => f.targetId);
  const [courses, pages, saes] = await Promise.all([
    db.course.findMany({
      where: { id: { in: ids("COURSE") } },
      select: { id: true, slug: true, title: true, ownerId: true, published: true, editors: { select: { id: true } } },
    }),
    db.page.findMany({
      where: { id: { in: ids("PAGE") } },
      select: {
        id: true,
        title: true,
        course: { select: { slug: true, title: true, ownerId: true, published: true, editors: { select: { id: true } } } },
      },
    }),
    db.sae.findMany({
      where: { id: { in: ids("SAE") } },
      select: { id: true, code: true, title: true, ownerId: true, published: true, teachers: { select: { id: true } } },
    }),
  ]);
  const out: ResolvedFavorite[] = [];
  for (const f of favs) {
    if (f.kind === "COURSE") {
      const c = courses.find((x) => x.id === f.targetId && canViewCourse(actor, x));
      if (c) out.push({ id: f.id, kind: "COURSE", label: c.title, href: `/courses/${c.slug}` });
    } else if (f.kind === "PAGE") {
      const p = pages.find((x) => x.id === f.targetId && canViewCourse(actor, x.course));
      if (p) out.push({ id: f.id, kind: "PAGE", label: p.title, href: `/courses/${p.course.slug}/pages/${p.id}`, context: p.course.title });
    } else {
      const s = saes.find((x) => x.id === f.targetId && canViewSae(actor, x));
      if (s) out.push({ id: f.id, kind: "SAE", label: s.code ? `${s.code} — ${s.title}` : s.title, href: `/saes/${s.id}` });
    }
  }
  return out;
}

export async function isFavorite(userId: string, kind: "COURSE" | "PAGE" | "SAE", targetId: string) {
  return !!(await db.favorite.findUnique({ where: { userId_kind_targetId: { userId, kind, targetId } }, select: { id: true } }));
}
