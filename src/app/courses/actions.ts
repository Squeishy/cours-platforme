"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { canCreateCourse, canDeleteCourse, canEditCourse, isStaff } from "@/lib/permissions";
import { editorContentSchema, slugify } from "@/lib/content";
import type { ActionState } from "./_lib/action-state";
import type { SaveResult } from "@/components/editor";

// ── Schémas ──────────────────────────────────────────────────
const idSchema = z.string().min(1).max(64);

const courseFieldsSchema = z.object({
  title: z.string().trim().min(1, "Le titre est obligatoire.").max(200, "Titre trop long (200 caractères max)."),
  summary: z
    .string()
    .trim()
    .max(5000, "Résumé trop long (5000 caractères max).")
    .transform((s) => (s.length > 0 ? s : null)),
});

const pageTitleSchema = z
  .string()
  .trim()
  .min(1, "Le titre est obligatoire.")
  .max(200, "Titre trop long (200 caractères max).");

const emailSchema = z.email("Adresse e-mail invalide.").max(320);

const directionSchema = z.enum(["up", "down"]);

// ── Utilitaires ──────────────────────────────────────────────
function str(formData: FormData, key: string) {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
}

function firstError(error: z.ZodError) {
  return error.issues[0]?.message ?? "Données invalides.";
}

async function loadCourse(courseId: string) {
  return db.course.findUnique({
    where: { id: courseId },
    include: { editors: { select: { id: true } } },
  });
}

async function loadPageWithCourse(pageId: string) {
  return db.page.findUnique({
    where: { id: pageId },
    include: { course: { include: { editors: { select: { id: true } } } } },
  });
}

function revalidateCourse(slug: string) {
  revalidatePath("/courses");
  revalidatePath(`/courses/${slug}`, "layout");
  revalidatePath("/");
}

async function uniqueSlug(title: string) {
  const base = slugify(title) || "cours";
  const taken = new Set(
    (await db.course.findMany({ where: { slug: { startsWith: base } }, select: { slug: true } })).map((c) => c.slug),
  );
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

function isUniqueViolation(err: unknown) {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

// ── Cours ────────────────────────────────────────────────────
export async function createCourse(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (!canCreateCourse(user)) return { ok: false, error: "Seuls les enseignants peuvent créer un cours." };

  const parsed = courseFieldsSchema.safeParse({ title: str(formData, "title"), summary: str(formData, "summary") });
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  let slug: string | null = null;
  for (let attempt = 0; attempt < 3 && !slug; attempt++) {
    const candidate = await uniqueSlug(parsed.data.title);
    try {
      await db.course.create({
        data: { slug: candidate, title: parsed.data.title, summary: parsed.data.summary, ownerId: user.id },
      });
      slug = candidate;
    } catch (err) {
      if (!isUniqueViolation(err)) return { ok: false, error: "Impossible de créer le cours." };
    }
  }
  if (!slug) return { ok: false, error: "Impossible de générer une adresse unique pour ce cours." };

  revalidatePath("/courses");
  revalidatePath("/");
  redirect(`/courses/${slug}`);
}

export async function updateCourseSettings(courseId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (!idSchema.safeParse(courseId).success) return { ok: false, error: "Cours invalide." };

  const parsed = courseFieldsSchema
    .extend({ published: z.boolean() })
    .safeParse({
      title: str(formData, "title"),
      summary: str(formData, "summary"),
      published: formData.get("published") === "on",
    });
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const course = await loadCourse(courseId);
  if (!course) return { ok: false, error: "Cours introuvable." };
  if (!canEditCourse(user, course)) return { ok: false, error: "Vous ne pouvez pas modifier ce cours." };

  await db.course.update({
    where: { id: course.id },
    data: { title: parsed.data.title, summary: parsed.data.summary, published: parsed.data.published },
  });
  revalidateCourse(course.slug);
  return { ok: true };
}

export async function addCourseEditor(courseId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (!idSchema.safeParse(courseId).success) return { ok: false, error: "Cours invalide." };

  const parsed = emailSchema.safeParse(str(formData, "email").trim().toLowerCase());
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const course = await loadCourse(courseId);
  if (!course) return { ok: false, error: "Cours introuvable." };
  if (!canEditCourse(user, course)) return { ok: false, error: "Vous ne pouvez pas modifier ce cours." };

  const target = await db.user.findUnique({ where: { email: parsed.data }, select: { id: true, role: true } });
  if (!target) return { ok: false, error: "Aucun utilisateur avec cette adresse." };
  if (!isStaff(target)) return { ok: false, error: "Seuls les enseignants et administrateurs peuvent co-éditer un cours." };
  if (target.id === course.ownerId) return { ok: false, error: "Cette personne est déjà propriétaire du cours." };
  if (course.editors.some((e) => e.id === target.id)) return { ok: false, error: "Cette personne est déjà co-éditrice." };

  await db.course.update({ where: { id: course.id }, data: { editors: { connect: { id: target.id } } } });
  revalidateCourse(course.slug);
  return { ok: true };
}

export async function removeCourseEditor(courseId: string, editorId: string): Promise<ActionState> {
  const user = await requireUser();
  if (!idSchema.safeParse(courseId).success || !idSchema.safeParse(editorId).success) {
    return { ok: false, error: "Requête invalide." };
  }

  const course = await loadCourse(courseId);
  if (!course) return { ok: false, error: "Cours introuvable." };
  if (!canEditCourse(user, course)) return { ok: false, error: "Vous ne pouvez pas modifier ce cours." };
  if (!course.editors.some((e) => e.id === editorId)) return { ok: false, error: "Cette personne n'est pas co-éditrice." };

  await db.course.update({ where: { id: course.id }, data: { editors: { disconnect: { id: editorId } } } });
  revalidateCourse(course.slug);
  return { ok: true };
}

export async function deleteCourse(courseId: string): Promise<ActionState> {
  const user = await requireUser();
  if (!idSchema.safeParse(courseId).success) return { ok: false, error: "Cours invalide." };

  const course = await loadCourse(courseId);
  if (!course) return { ok: false, error: "Cours introuvable." };
  if (!canDeleteCourse(user, course)) {
    return { ok: false, error: "Seul le propriétaire ou un administrateur peut supprimer ce cours." };
  }

  await db.course.delete({ where: { id: course.id } });
  revalidatePath("/courses");
  revalidatePath("/");
  redirect("/courses");
}

// ── Pages ────────────────────────────────────────────────────
export async function createPage(
  courseId: string,
  parentId: string | null,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  if (!idSchema.safeParse(courseId).success || (parentId !== null && !idSchema.safeParse(parentId).success)) {
    return { ok: false, error: "Requête invalide." };
  }
  const title = pageTitleSchema.safeParse(str(formData, "title"));
  if (!title.success) return { ok: false, error: firstError(title.error) };

  const course = await loadCourse(courseId);
  if (!course) return { ok: false, error: "Cours introuvable." };
  if (!canEditCourse(user, course)) return { ok: false, error: "Vous ne pouvez pas modifier ce cours." };

  if (parentId) {
    const parent = await db.page.findUnique({ where: { id: parentId }, select: { courseId: true } });
    if (!parent || parent.courseId !== course.id) return { ok: false, error: "Page parente introuvable." };
  }

  const max = await db.page.aggregate({
    where: { courseId: course.id, parentId },
    _max: { position: true },
  });
  const page = await db.page.create({
    data: {
      courseId: course.id,
      parentId,
      title: title.data,
      position: (max._max.position ?? -1) + 1,
      updatedById: user.id,
    },
    select: { id: true },
  });

  revalidateCourse(course.slug);
  redirect(`/courses/${course.slug}/pages/${page.id}`);
}

export async function renamePage(pageId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (!idSchema.safeParse(pageId).success) return { ok: false, error: "Page invalide." };
  const title = pageTitleSchema.safeParse(str(formData, "title"));
  if (!title.success) return { ok: false, error: firstError(title.error) };

  const page = await loadPageWithCourse(pageId);
  if (!page) return { ok: false, error: "Page introuvable." };
  if (!canEditCourse(user, page.course)) return { ok: false, error: "Vous ne pouvez pas modifier ce cours." };

  await db.page.update({ where: { id: page.id }, data: { title: title.data, updatedById: user.id } });
  revalidateCourse(page.course.slug);
  return { ok: true };
}

/** Échange la position avec la page sœur précédente/suivante (positions renumérotées 0..n) */
export async function movePage(pageId: string, direction: "up" | "down"): Promise<ActionState> {
  const user = await requireUser();
  const dir = directionSchema.safeParse(direction);
  if (!idSchema.safeParse(pageId).success || !dir.success) return { ok: false, error: "Requête invalide." };

  const page = await loadPageWithCourse(pageId);
  if (!page) return { ok: false, error: "Page introuvable." };
  if (!canEditCourse(user, page.course)) return { ok: false, error: "Vous ne pouvez pas modifier ce cours." };

  const siblings = await db.page.findMany({
    where: { courseId: page.courseId, parentId: page.parentId },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  const index = siblings.findIndex((s) => s.id === page.id);
  const target = dir.data === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= siblings.length) return { ok: true };

  const ordered = siblings.map((s) => s.id);
  [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
  await db.$transaction(ordered.map((id, position) => db.page.update({ where: { id }, data: { position } })));

  revalidateCourse(page.course.slug);
  return { ok: true };
}

export async function deletePage(pageId: string): Promise<ActionState> {
  const user = await requireUser();
  if (!idSchema.safeParse(pageId).success) return { ok: false, error: "Page invalide." };

  const page = await loadPageWithCourse(pageId);
  if (!page) return { ok: false, error: "Page introuvable." };
  if (!canEditCourse(user, page.course)) return { ok: false, error: "Vous ne pouvez pas modifier ce cours." };

  // Les sous-pages sont supprimées en cascade (onDelete: Cascade sur parentId)
  await db.page.delete({ where: { id: page.id } });
  revalidateCourse(page.course.slug);
  redirect(
    page.parentId ? `/courses/${page.course.slug}/pages/${page.parentId}` : `/courses/${page.course.slug}`,
  );
}

/** Autosave de l'éditeur : onSave={savePageContent.bind(null, page.id)} */
export async function savePageContent(pageId: string, content: unknown, markdown: string): Promise<SaveResult> {
  const user = await requireUser();
  if (!idSchema.safeParse(pageId).success) return { ok: false, error: "Page invalide." };

  const parsed = editorContentSchema.safeParse({ content, markdown });
  if (!parsed.success) return { ok: false, error: "Contenu invalide ou trop volumineux." };

  const page = await loadPageWithCourse(pageId);
  if (!page) return { ok: false, error: "Page introuvable." };
  if (!canEditCourse(user, page.course)) return { ok: false, error: "Vous ne pouvez pas modifier ce cours." };

  await db.page.update({
    where: { id: page.id },
    data: {
      content: parsed.data.content as Prisma.InputJsonValue,
      markdown: parsed.data.markdown,
      updatedById: user.id,
    },
  });
  revalidatePath(`/courses/${page.course.slug}/pages/${page.id}`);
  return { ok: true };
}
