import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { canViewCourse, canViewSae, isAdmin, type Actor } from "@/lib/permissions";
import { likePattern, makeSnippet, type SearchPlan, type SnippetPart } from "./query";

export const SEARCH_LIMITS = { pages: 50, courses: 20, saes: 20 } as const;

// Passage extrait en SQL autour de la première occurrence de l'ancre (évite de rapatrier des Mo de Markdown)
const EXCERPT_BEFORE = 240;
const EXCERPT_LENGTH = 800;

type PageRow = {
  id: string;
  title: string;
  courseId: string;
  courseSlug: string;
  courseTitle: string;
  updatedAt: Date | string;
  excerpt: string | null;
};
type CourseRow = { id: string; slug: string; title: string; excerpt: string | null };
type SaeRow = { id: string; code: string | null; title: string; semester: number | null; excerpt: string | null };

export type PageHit = { id: string; title: string; href: string; courseTitle: string; updatedAt: Date; snippet: SnippetPart[] };
export type CourseHit = { id: string; title: string; href: string; snippet: SnippetPart[] };
export type SaeHit = { id: string; title: string; code: string | null; semester: number | null; href: string; snippet: SnippetPart[] };
export type SearchResults = { pages: PageHit[]; courses: CourseHit[]; saes: SaeHit[]; failed: boolean };

// Noms de colonnes/tables : constantes du code, jamais de saisie utilisateur dans Prisma.raw
const raw = Prisma.raw;

/** Visibilité en SQL (publié, ou responsable/co-éditeur) — revérifiée ensuite avec canViewCourse */
function courseVisibleSql(user: Actor) {
  if (isAdmin(user)) return Prisma.sql`1 = 1`;
  return Prisma.sql`(c.published = 1 OR c.ownerId = ${user.id}
    OR EXISTS (SELECT 1 FROM _CourseEditors ce WHERE ce.A = c.id AND ce.B = ${user.id}))`;
}

function saeVisibleSql(user: Actor) {
  if (isAdmin(user)) return Prisma.sql`1 = 1`;
  return Prisma.sql`(s.published = 1 OR s.ownerId = ${user.id}
    OR EXISTS (SELECT 1 FROM _SaeTeachers st WHERE st.A = s.id AND st.B = ${user.id}))`;
}

function excerptSql(column: string, anchor: string) {
  const col = raw(`COALESCE(${column}, '')`);
  return Prisma.sql`SUBSTRING(${col}, GREATEST(1, LOCATE(${anchor}, ${col}) - ${raw(String(EXCERPT_BEFORE))}), ${raw(String(EXCERPT_LENGTH))})`;
}

/** Condition de correspondance : MATCH … AGAINST (mode booléen) ou LIKE échappé (mots courts) */
function matchSql(plan: Exclude<SearchPlan, { kind: "empty" }>, fulltextColumns: string, likeColumns: string[]) {
  if (plan.kind === "fulltext") {
    return Prisma.sql`MATCH(${raw(fulltextColumns)}) AGAINST (${plan.boolean} IN BOOLEAN MODE)`;
  }
  return Prisma.join(
    plan.terms.map((term) => {
      const pattern = likePattern(term);
      return Prisma.sql`(${Prisma.join(
        likeColumns.map((c) => Prisma.sql`${raw(c)} LIKE ${pattern} ESCAPE '!'`),
        " OR ",
      )})`;
    }),
    " AND ",
  );
}

function orderSql(plan: Exclude<SearchPlan, { kind: "empty" }>, fulltextColumns: string, fallback: string) {
  if (plan.kind === "fulltext") {
    return Prisma.sql`MATCH(${raw(fulltextColumns)}) AGAINST (${plan.boolean} IN BOOLEAN MODE) DESC, ${raw(fallback)}`;
  }
  return raw(fallback);
}

/**
 * Recherche dans les pages, cours et SAÉ visibles par l'utilisateur.
 * Requêtes paramétrées uniquement (tagged templates / Prisma.sql), résultats bornés par type.
 */
export async function searchContent(user: Actor, plan: Exclude<SearchPlan, { kind: "empty" }>): Promise<SearchResults> {
  try {
    const [pageRows, courseRows, saeRows] = await Promise.all([
      db.$queryRaw<PageRow[]>`
        SELECT p.id, p.title, p.courseId, c.slug AS courseSlug, c.title AS courseTitle, p.updatedAt,
               ${excerptSql("p.markdown", plan.anchor)} AS excerpt
        FROM Page p
        INNER JOIN Course c ON c.id = p.courseId
        WHERE ${matchSql(plan, "p.title, p.markdown", ["p.title", "p.markdown"])}
          AND ${courseVisibleSql(user)}
        ORDER BY ${orderSql(plan, "p.title, p.markdown", "p.updatedAt DESC")}
        LIMIT ${raw(String(SEARCH_LIMITS.pages))}`,
      db.$queryRaw<CourseRow[]>`
        SELECT c.id, c.slug, c.title, ${excerptSql("c.summary", plan.anchor)} AS excerpt
        FROM Course c
        WHERE ${matchSql(plan, "c.title, c.summary", ["c.title", "c.summary"])}
          AND ${courseVisibleSql(user)}
        ORDER BY ${orderSql(plan, "c.title, c.summary", "c.title ASC")}
        LIMIT ${raw(String(SEARCH_LIMITS.courses))}`,
      db.$queryRaw<SaeRow[]>`
        SELECT s.id, s.code, s.title, s.semester, ${excerptSql("s.markdown", plan.anchor)} AS excerpt
        FROM Sae s
        WHERE ${matchSql(plan, "s.title, s.markdown", ["s.title", "s.markdown", "s.code"])}
          AND ${saeVisibleSql(user)}
        ORDER BY ${orderSql(plan, "s.title, s.markdown", "s.updatedAt DESC")}
        LIMIT ${raw(String(SEARCH_LIMITS.saes))}`,
    ]);

    // Revérification exacte avec les règles de permissions.ts (ex. co-éditeur redevenu étudiant)
    const courseIds = [...new Set([...pageRows.map((r) => r.courseId), ...courseRows.map((r) => r.id)])];
    const [courses, saes] = await Promise.all([
      courseIds.length
        ? db.course.findMany({
            where: { id: { in: courseIds } },
            select: { id: true, ownerId: true, published: true, editors: { select: { id: true } } },
          })
        : [],
      saeRows.length
        ? db.sae.findMany({
            where: { id: { in: saeRows.map((r) => r.id) } },
            select: { id: true, ownerId: true, published: true, teachers: { select: { id: true } } },
          })
        : [],
    ]);
    const visibleCourses = new Set(courses.filter((c) => canViewCourse(user, c)).map((c) => c.id));
    const visibleSaes = new Set(saes.filter((s) => canViewSae(user, s)).map((s) => s.id));

    return {
      failed: false,
      pages: pageRows
        .filter((r) => visibleCourses.has(r.courseId))
        .map((r) => ({
          id: r.id,
          title: r.title,
          href: `/courses/${r.courseSlug}/pages/${r.id}`,
          courseTitle: r.courseTitle,
          updatedAt: new Date(r.updatedAt),
          snippet: makeSnippet(r.excerpt ?? "", plan.terms),
        })),
      courses: courseRows
        .filter((r) => visibleCourses.has(r.id))
        .map((r) => ({
          id: r.id,
          title: r.title,
          href: `/courses/${r.slug}`,
          snippet: makeSnippet(r.excerpt ?? "", plan.terms),
        })),
      saes: saeRows
        .filter((r) => visibleSaes.has(r.id))
        .map((r) => ({
          id: r.id,
          title: r.title,
          code: r.code,
          semester: r.semester == null ? null : Number(r.semester),
          href: `/saes/${r.id}`,
          snippet: makeSnippet(r.excerpt ?? "", plan.terms),
        })),
    };
  } catch (err) {
    console.error("Recherche : échec de la requête", err);
    return { failed: true, pages: [], courses: [], saes: [] };
  }
}
