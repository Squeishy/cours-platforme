"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { requireUser, type CurrentUser } from "@/lib/session";
import { canCreateSae, canDeleteSae, canEditCourse, canManageSae } from "@/lib/permissions";
import { editorContentSchema } from "@/lib/content";
import type { SaveResult } from "@/components/editor";
import { parisLocalToDate } from "./_lib/dates";
import type { FormState } from "./_lib/form-state";

// ─────────────────────────────────────────────────────────────
// Helpers (non exportés : un fichier "use server" n'exporte que des actions)
// ─────────────────────────────────────────────────────────────

const FORBIDDEN = { ok: false, error: "Vous n'avez pas les droits pour cette action." } as const;
const NOT_FOUND_SAE = { ok: false, error: "SAÉ introuvable." } as const;
const GENERIC_ERROR = { ok: false, error: "Une erreur est survenue. Réessayez." } as const;

/** Lit les champs demandés ; un champ absent devient undefined (pas null) pour zod */
function read(formData: FormData, keys: readonly string[]): Record<string, FormDataEntryValue | undefined> {
  return Object.fromEntries(keys.map((k) => [k, formData.get(k) ?? undefined]));
}

function firstIssue(error: z.ZodError): FormState {
  return { ok: false, error: error.issues[0]?.message ?? "Données invalides." };
}

const id = z.string().trim().min(1, "Identifiant manquant").max(64);

const requiredText = (label: string, max: number) =>
  z
    .string({ error: `${label} requis` })
    .trim()
    .min(1, `${label} requis`)
    .max(max, `${label} : ${max} caractères maximum`);

/** Texte optionnel : vide → null */
const optionalText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .max(max, `${label} : ${max} caractères maximum`)
    .optional()
    .transform((v) => (v ? v : null));

/** `<input type="date|datetime-local">` en heure de Paris, vide → undefined */
const optionalDate = z.preprocess((v) => {
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  if (s === "") return undefined;
  return parisLocalToDate(s) ?? s;
}, z.coerce.date({ error: "Date invalide" }).optional());

const checkbox = z.preprocess((v) => v === "on" || v === "true", z.boolean());

const semester = z.preprocess(
  (v) => (v === "" || v === undefined ? undefined : v),
  z.coerce
    .number({ error: "Semestre invalide" })
    .int("Semestre invalide")
    .min(1, "Le semestre va de 1 à 6")
    .max(6, "Le semestre va de 1 à 6")
    .optional(),
);

const email = z
  .string({ error: "Adresse e-mail requise" })
  .trim()
  .toLowerCase()
  .max(254, "Adresse e-mail trop longue")
  .pipe(z.email("Adresse e-mail invalide"));

const direction = z.enum(["up", "down"], { error: "Direction invalide" });

const saeFieldsObject = z.object({
  code: optionalText("Code", 40),
  title: requiredText("Titre", 200),
  semester,
  competences: optionalText("Compétences", 2000),
  startsAt: optionalDate,
  endsAt: optionalDate,
  courseId: z
    .string()
    .trim()
    .max(64)
    .optional()
    .transform((v) => (v ? v : null)),
});

const datesInOrder = (d: { startsAt?: Date; endsAt?: Date }) => !d.startsAt || !d.endsAt || d.endsAt >= d.startsAt;
const DATES_ERROR = { message: "La date de fin doit être postérieure à la date de début", path: ["endsAt"] };

const SAE_FIELD_KEYS = ["code", "title", "semester", "competences", "startsAt", "endsAt", "courseId"] as const;

const saeAccessSelect = {
  id: true,
  ownerId: true,
  published: true,
  courseId: true,
  teachers: { select: { id: true } },
} satisfies Prisma.SaeSelect;

function loadSae(saeId: string) {
  return db.sae.findUnique({ where: { id: saeId }, select: saeAccessSelect });
}

async function userCanLinkCourse(user: CurrentUser, courseId: string) {
  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { ownerId: true, published: true, editors: { select: { id: true } } },
  });
  return !!course && canEditCourse(user, course);
}

function isUniqueViolation(e: unknown) {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

function revalidateSae(saeId: string) {
  // Page SAÉ + toutes ses sous-routes (gestion, groupes, jalons)
  revalidatePath(`/saes/${saeId}`, "layout");
  revalidatePath("/saes");
  revalidatePath("/");
}

/** Réordonne une liste (par index) en échangeant l'élément avec son voisin */
function swapped<T extends { id: string }>(items: T[], itemId: string, dir: "up" | "down"): T[] | null {
  const index = items.findIndex((i) => i.id === itemId);
  const target = dir === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= items.length) return null;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

// ─────────────────────────────────────────────────────────────
// SAÉ : création, réglages, publication, sujet, suppression
// ─────────────────────────────────────────────────────────────

export async function createSae(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!canCreateSae(user)) return FORBIDDEN;

  const parsed = saeFieldsObject.refine(datesInOrder, DATES_ERROR).safeParse(read(formData, SAE_FIELD_KEYS));
  if (!parsed.success) return firstIssue(parsed.error);
  const data = parsed.data;

  if (data.courseId && !(await userCanLinkCourse(user, data.courseId))) {
    return { ok: false, error: "Vous ne pouvez pas lier ce cours." };
  }

  let saeId: string;
  try {
    const sae = await db.sae.create({
      data: {
        code: data.code,
        title: data.title,
        semester: data.semester ?? null,
        competences: data.competences,
        startsAt: data.startsAt ?? null,
        endsAt: data.endsAt ?? null,
        courseId: data.courseId,
        ownerId: user.id,
      },
      select: { id: true },
    });
    saeId = sae.id;
  } catch {
    return GENERIC_ERROR;
  }

  revalidatePath("/saes");
  revalidatePath("/");
  redirect(`/saes/${saeId}/manage`);
}

export async function updateSaeSettings(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

  const parsed = saeFieldsObject
    .extend({ saeId: id, published: checkbox })
    .refine(datesInOrder, DATES_ERROR)
    .safeParse(read(formData, [...SAE_FIELD_KEYS, "saeId", "published"]));
  if (!parsed.success) return firstIssue(parsed.error);
  const data = parsed.data;

  const sae = await loadSae(data.saeId);
  if (!sae) return NOT_FOUND_SAE;
  if (!canManageSae(user, sae)) return FORBIDDEN;

  // Changer de cours lié exige de pouvoir éditer le nouveau cours
  if (data.courseId && data.courseId !== sae.courseId && !(await userCanLinkCourse(user, data.courseId))) {
    return { ok: false, error: "Vous ne pouvez pas lier ce cours." };
  }

  try {
    await db.sae.update({
      where: { id: sae.id },
      data: {
        code: data.code,
        title: data.title,
        semester: data.semester ?? null,
        competences: data.competences,
        startsAt: data.startsAt ?? null,
        endsAt: data.endsAt ?? null,
        courseId: data.courseId,
        published: data.published,
      },
    });
  } catch {
    return GENERIC_ERROR;
  }

  revalidateSae(sae.id);
  return { ok: true, message: "Réglages enregistrés." };
}

export async function setSaePublished(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

  const parsed = z
    .object({ saeId: id, published: z.enum(["true", "false"], { error: "Valeur invalide" }) })
    .safeParse(read(formData, ["saeId", "published"]));
  if (!parsed.success) return firstIssue(parsed.error);

  const sae = await loadSae(parsed.data.saeId);
  if (!sae) return NOT_FOUND_SAE;
  if (!canManageSae(user, sae)) return FORBIDDEN;

  const published = parsed.data.published === "true";
  try {
    await db.sae.update({ where: { id: sae.id }, data: { published } });
  } catch {
    return GENERIC_ERROR;
  }

  revalidateSae(sae.id);
  return { ok: true, message: published ? "SAÉ publiée." : "SAÉ repassée en brouillon." };
}

/** Action de l'éditeur de sujet : `onSave={saveSaeContent.bind(null, sae.id)}` */
export async function saveSaeContent(saeId: string, content: unknown, markdown: string): Promise<SaveResult> {
  const user = await requireUser();

  const parsedId = id.safeParse(saeId);
  const parsed = editorContentSchema.safeParse({ content, markdown });
  if (!parsedId.success || !parsed.success) return { ok: false, error: "Contenu invalide." };

  const sae = await loadSae(parsedId.data);
  if (!sae) return NOT_FOUND_SAE;
  if (!canManageSae(user, sae)) return FORBIDDEN;

  try {
    await db.sae.update({
      where: { id: sae.id },
      data: {
        content: parsed.data.content as Prisma.InputJsonValue,
        markdown: parsed.data.markdown,
      },
    });
  } catch {
    return GENERIC_ERROR;
  }

  revalidatePath(`/saes/${sae.id}`);
  return { ok: true };
}

/** Suppression définitive : propriétaire ou administrateur uniquement */
export async function deleteSae(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

  const parsed = z.object({ saeId: id }).safeParse(read(formData, ["saeId"]));
  if (!parsed.success) return firstIssue(parsed.error);

  const sae = await loadSae(parsed.data.saeId);
  if (!sae) return NOT_FOUND_SAE;
  if (!canDeleteSae(user, sae)) return FORBIDDEN;

  try {
    await db.sae.delete({ where: { id: sae.id } });
  } catch {
    return GENERIC_ERROR;
  }

  revalidatePath("/saes", "layout");
  revalidatePath("/");
  redirect("/saes");
}

// ─────────────────────────────────────────────────────────────
// Équipe pédagogique
// ─────────────────────────────────────────────────────────────

export async function addSaeTeacher(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

  const parsed = z.object({ saeId: id, email }).safeParse(read(formData, ["saeId", "email"]));
  if (!parsed.success) return firstIssue(parsed.error);

  const sae = await loadSae(parsed.data.saeId);
  if (!sae) return NOT_FOUND_SAE;
  if (!canManageSae(user, sae)) return FORBIDDEN;

  const teacher = await db.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, name: true, role: true },
  });
  if (!teacher) return { ok: false, error: "Aucun compte avec cette adresse e-mail." };
  if (teacher.role !== "TEACHER" && teacher.role !== "ADMIN") {
    return { ok: false, error: "Seul un enseignant ou un administrateur peut être co-enseignant." };
  }
  if (teacher.id === sae.ownerId) return { ok: false, error: "Cette personne est déjà responsable de la SAÉ." };
  if (sae.teachers.some((t) => t.id === teacher.id)) {
    return { ok: false, error: "Cette personne fait déjà partie de l'équipe." };
  }

  try {
    await db.sae.update({ where: { id: sae.id }, data: { teachers: { connect: { id: teacher.id } } } });
  } catch {
    return GENERIC_ERROR;
  }

  revalidateSae(sae.id);
  return { ok: true, message: `${teacher.name} ajouté·e à l'équipe.` };
}

export async function removeSaeTeacher(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

  const parsed = z.object({ saeId: id, userId: id }).safeParse(read(formData, ["saeId", "userId"]));
  if (!parsed.success) return firstIssue(parsed.error);

  const sae = await loadSae(parsed.data.saeId);
  if (!sae) return NOT_FOUND_SAE;
  if (!canManageSae(user, sae)) return FORBIDDEN;
  if (!sae.teachers.some((t) => t.id === parsed.data.userId)) {
    return { ok: false, error: "Cette personne ne fait pas partie de l'équipe." };
  }

  try {
    await db.sae.update({
      where: { id: sae.id },
      data: { teachers: { disconnect: { id: parsed.data.userId } } },
    });
  } catch {
    return GENERIC_ERROR;
  }

  revalidateSae(sae.id);
  return { ok: true, message: "Co-enseignant retiré." };
}

// ─────────────────────────────────────────────────────────────
// Jalons
// ─────────────────────────────────────────────────────────────

const milestoneFieldsSchema = z.object({
  title: requiredText("Titre", 200),
  description: optionalText("Description", 5000),
  dueAt: optionalDate,
  requiresDepositUrl: checkbox,
});

const MILESTONE_FIELD_KEYS = ["title", "description", "dueAt", "requiresDepositUrl"] as const;

function loadMilestone(milestoneId: string) {
  return db.milestone.findUnique({
    where: { id: milestoneId },
    select: { id: true, saeId: true, sae: { select: saeAccessSelect } },
  });
}

export async function createMilestone(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

  const parsed = milestoneFieldsSchema
    .extend({ saeId: id })
    .safeParse(read(formData, [...MILESTONE_FIELD_KEYS, "saeId"]));
  if (!parsed.success) return firstIssue(parsed.error);
  const data = parsed.data;

  const sae = await loadSae(data.saeId);
  if (!sae) return NOT_FOUND_SAE;
  if (!canManageSae(user, sae)) return FORBIDDEN;

  try {
    const last = await db.milestone.aggregate({ where: { saeId: sae.id }, _max: { position: true } });
    await db.milestone.create({
      data: {
        saeId: sae.id,
        title: data.title,
        description: data.description,
        dueAt: data.dueAt ?? null,
        requiresDepositUrl: data.requiresDepositUrl,
        position: (last._max.position ?? -1) + 1,
      },
    });
  } catch {
    return GENERIC_ERROR;
  }

  revalidateSae(sae.id);
  return { ok: true, message: "Jalon ajouté." };
}

export async function updateMilestone(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

  const parsed = milestoneFieldsSchema
    .extend({ milestoneId: id })
    .safeParse(read(formData, [...MILESTONE_FIELD_KEYS, "milestoneId"]));
  if (!parsed.success) return firstIssue(parsed.error);
  const data = parsed.data;

  const milestone = await loadMilestone(data.milestoneId);
  if (!milestone) return { ok: false, error: "Jalon introuvable." };
  if (!canManageSae(user, milestone.sae)) return FORBIDDEN;

  try {
    await db.milestone.update({
      where: { id: milestone.id },
      data: {
        title: data.title,
        description: data.description,
        dueAt: data.dueAt ?? null,
        requiresDepositUrl: data.requiresDepositUrl,
      },
    });
  } catch {
    return GENERIC_ERROR;
  }

  revalidateSae(milestone.saeId);
  return { ok: true, message: "Jalon enregistré." };
}

/** Supprime le jalon, ses critères et les auto-évaluations associées (cascade) */
export async function deleteMilestone(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

  const parsed = z.object({ milestoneId: id }).safeParse(read(formData, ["milestoneId"]));
  if (!parsed.success) return firstIssue(parsed.error);

  const milestone = await loadMilestone(parsed.data.milestoneId);
  if (!milestone) return { ok: false, error: "Jalon introuvable." };
  if (!canManageSae(user, milestone.sae)) return FORBIDDEN;

  try {
    await db.milestone.delete({ where: { id: milestone.id } });
  } catch {
    return GENERIC_ERROR;
  }

  revalidateSae(milestone.saeId);
  return { ok: true, message: "Jalon supprimé." };
}

export async function moveMilestone(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

  const parsed = z
    .object({ milestoneId: id, direction })
    .safeParse(read(formData, ["milestoneId", "direction"]));
  if (!parsed.success) return firstIssue(parsed.error);

  const milestone = await loadMilestone(parsed.data.milestoneId);
  if (!milestone) return { ok: false, error: "Jalon introuvable." };
  if (!canManageSae(user, milestone.sae)) return FORBIDDEN;

  try {
    const siblings = await db.milestone.findMany({
      where: { saeId: milestone.saeId },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    });
    const next = swapped(siblings, milestone.id, parsed.data.direction);
    if (next) {
      await db.$transaction(
        next.map((m, position) => db.milestone.update({ where: { id: m.id }, data: { position } })),
      );
    }
  } catch {
    return GENERIC_ERROR;
  }

  revalidateSae(milestone.saeId);
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// Critères (apprentissages critiques)
// ─────────────────────────────────────────────────────────────

const criterionFieldsSchema = z.object({
  label: requiredText("Intitulé", 300),
  description: optionalText("Description", 3000),
  acCode: z
    .string()
    .trim()
    .max(30, "Code AC : 30 caractères maximum")
    .optional()
    .transform((v) => (v ? v.toUpperCase() : null)),
});

const CRITERION_FIELD_KEYS = ["label", "description", "acCode"] as const;

function loadCriterion(criterionId: string) {
  return db.criterion.findUnique({
    where: { id: criterionId },
    select: {
      id: true,
      milestoneId: true,
      milestone: { select: { saeId: true, sae: { select: saeAccessSelect } } },
    },
  });
}

export async function createCriterion(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

  const parsed = criterionFieldsSchema
    .extend({ milestoneId: id })
    .safeParse(read(formData, [...CRITERION_FIELD_KEYS, "milestoneId"]));
  if (!parsed.success) return firstIssue(parsed.error);
  const data = parsed.data;

  const milestone = await loadMilestone(data.milestoneId);
  if (!milestone) return { ok: false, error: "Jalon introuvable." };
  if (!canManageSae(user, milestone.sae)) return FORBIDDEN;

  try {
    const last = await db.criterion.aggregate({
      where: { milestoneId: milestone.id },
      _max: { position: true },
    });
    await db.criterion.create({
      data: {
        milestoneId: milestone.id,
        label: data.label,
        description: data.description,
        acCode: data.acCode,
        position: (last._max.position ?? -1) + 1,
      },
    });
  } catch {
    return GENERIC_ERROR;
  }

  revalidateSae(milestone.saeId);
  return { ok: true, message: "Critère ajouté." };
}

export async function updateCriterion(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

  const parsed = criterionFieldsSchema
    .extend({ criterionId: id })
    .safeParse(read(formData, [...CRITERION_FIELD_KEYS, "criterionId"]));
  if (!parsed.success) return firstIssue(parsed.error);
  const data = parsed.data;

  const criterion = await loadCriterion(data.criterionId);
  if (!criterion) return { ok: false, error: "Critère introuvable." };
  if (!canManageSae(user, criterion.milestone.sae)) return FORBIDDEN;

  try {
    await db.criterion.update({
      where: { id: criterion.id },
      data: { label: data.label, description: data.description, acCode: data.acCode },
    });
  } catch {
    return GENERIC_ERROR;
  }

  revalidateSae(criterion.milestone.saeId);
  return { ok: true, message: "Critère enregistré." };
}

/** Supprime le critère et les positionnements des étudiants sur ce critère (cascade) */
export async function deleteCriterion(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

  const parsed = z.object({ criterionId: id }).safeParse(read(formData, ["criterionId"]));
  if (!parsed.success) return firstIssue(parsed.error);

  const criterion = await loadCriterion(parsed.data.criterionId);
  if (!criterion) return { ok: false, error: "Critère introuvable." };
  if (!canManageSae(user, criterion.milestone.sae)) return FORBIDDEN;

  try {
    await db.criterion.delete({ where: { id: criterion.id } });
  } catch {
    return GENERIC_ERROR;
  }

  revalidateSae(criterion.milestone.saeId);
  return { ok: true, message: "Critère supprimé." };
}

export async function moveCriterion(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

  const parsed = z
    .object({ criterionId: id, direction })
    .safeParse(read(formData, ["criterionId", "direction"]));
  if (!parsed.success) return firstIssue(parsed.error);

  const criterion = await loadCriterion(parsed.data.criterionId);
  if (!criterion) return { ok: false, error: "Critère introuvable." };
  if (!canManageSae(user, criterion.milestone.sae)) return FORBIDDEN;

  try {
    const siblings = await db.criterion.findMany({
      where: { milestoneId: criterion.milestoneId },
      orderBy: [{ position: "asc" }, { id: "asc" }],
      select: { id: true },
    });
    const next = swapped(siblings, criterion.id, parsed.data.direction);
    if (next) {
      await db.$transaction(
        next.map((c, position) => db.criterion.update({ where: { id: c.id }, data: { position } })),
      );
    }
  } catch {
    return GENERIC_ERROR;
  }

  revalidateSae(criterion.milestone.saeId);
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// Groupes
// ─────────────────────────────────────────────────────────────

const groupName = requiredText("Nom du groupe", 100);
const DUPLICATE_GROUP = { ok: false, error: "Un groupe porte déjà ce nom dans cette SAÉ." } as const;

function loadGroup(groupId: string) {
  return db.group.findUnique({
    where: { id: groupId },
    select: { id: true, saeId: true, sae: { select: saeAccessSelect } },
  });
}

export async function createGroup(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

  const parsed = z.object({ saeId: id, name: groupName }).safeParse(read(formData, ["saeId", "name"]));
  if (!parsed.success) return firstIssue(parsed.error);

  const sae = await loadSae(parsed.data.saeId);
  if (!sae) return NOT_FOUND_SAE;
  if (!canManageSae(user, sae)) return FORBIDDEN;

  try {
    await db.group.create({ data: { saeId: sae.id, name: parsed.data.name } });
  } catch (e) {
    return isUniqueViolation(e) ? DUPLICATE_GROUP : GENERIC_ERROR;
  }

  revalidateSae(sae.id);
  return { ok: true, message: "Groupe créé." };
}

export async function renameGroup(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

  const parsed = z.object({ groupId: id, name: groupName }).safeParse(read(formData, ["groupId", "name"]));
  if (!parsed.success) return firstIssue(parsed.error);

  const group = await loadGroup(parsed.data.groupId);
  if (!group) return { ok: false, error: "Groupe introuvable." };
  if (!canManageSae(user, group.sae)) return FORBIDDEN;

  try {
    await db.group.update({ where: { id: group.id }, data: { name: parsed.data.name } });
  } catch (e) {
    return isUniqueViolation(e) ? DUPLICATE_GROUP : GENERIC_ERROR;
  }

  revalidateSae(group.saeId);
  return { ok: true, message: "Groupe renommé." };
}

/** Supprime le groupe et ses URL de dépôt ; les auto-évaluations sont conservées sans groupe */
export async function deleteGroup(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

  const parsed = z.object({ groupId: id }).safeParse(read(formData, ["groupId"]));
  if (!parsed.success) return firstIssue(parsed.error);

  const group = await loadGroup(parsed.data.groupId);
  if (!group) return { ok: false, error: "Groupe introuvable." };
  if (!canManageSae(user, group.sae)) return FORBIDDEN;

  try {
    await db.group.delete({ where: { id: group.id } });
  } catch {
    return GENERIC_ERROR;
  }

  revalidateSae(group.saeId);
  return { ok: true, message: "Groupe supprimé." };
}

/** Un étudiant appartient à au plus un groupe par SAÉ */
export async function addGroupMember(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

  const parsed = z.object({ groupId: id, email }).safeParse(read(formData, ["groupId", "email"]));
  if (!parsed.success) return firstIssue(parsed.error);

  const group = await loadGroup(parsed.data.groupId);
  if (!group) return { ok: false, error: "Groupe introuvable." };
  if (!canManageSae(user, group.sae)) return FORBIDDEN;

  const student = await db.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, name: true, role: true },
  });
  if (!student) return { ok: false, error: "Aucun compte avec cette adresse e-mail." };
  if (student.role !== "STUDENT") return { ok: false, error: "Seul un compte étudiant peut rejoindre un groupe." };

  try {
    const outcome = await db.$transaction(async (tx) => {
      const existing = await tx.groupMember.findFirst({
        where: { userId: student.id, group: { saeId: group.saeId } },
        select: { groupId: true, group: { select: { name: true } } },
      });
      if (existing) return existing.groupId === group.id ? "same" : `other:${existing.group.name}`;
      await tx.groupMember.create({ data: { groupId: group.id, userId: student.id } });
      return "added";
    });
    if (outcome === "same") return { ok: false, error: `${student.name} est déjà dans ce groupe.` };
    if (outcome.startsWith("other:")) {
      return {
        ok: false,
        error: `${student.name} est déjà dans le groupe « ${outcome.slice("other:".length)} » de cette SAÉ.`,
      };
    }
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: false, error: `${student.name} est déjà dans ce groupe.` };
    return GENERIC_ERROR;
  }

  revalidateSae(group.saeId);
  return { ok: true, message: `${student.name} ajouté·e au groupe.` };
}

export async function removeGroupMember(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

  const parsed = z.object({ groupId: id, userId: id }).safeParse(read(formData, ["groupId", "userId"]));
  if (!parsed.success) return firstIssue(parsed.error);

  const group = await loadGroup(parsed.data.groupId);
  if (!group) return { ok: false, error: "Groupe introuvable." };
  if (!canManageSae(user, group.sae)) return FORBIDDEN;

  try {
    const { count } = await db.groupMember.deleteMany({
      where: { groupId: group.id, userId: parsed.data.userId },
    });
    if (count === 0) return { ok: false, error: "Cette personne n'est pas dans ce groupe." };
  } catch {
    return GENERIC_ERROR;
  }

  revalidateSae(group.saeId);
  return { ok: true, message: "Membre retiré." };
}
