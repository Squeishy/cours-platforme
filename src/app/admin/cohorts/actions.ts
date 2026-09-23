"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { canManageCohorts } from "@/lib/permissions";
import { firstIssue, type FormResult } from "@/app/admin/users/_lib/form-result";
import { cohortSchema, parseEmailList, MAX_EMAILS_PER_PASTE } from "./_lib/cohorts";

const FORBIDDEN: FormResult = { ok: false, error: "Action réservée aux administrateurs." };
const idSchema = z.string().min(1).max(64);

function readCohort(formData: FormData) {
  return cohortSchema.safeParse({
    name: formData.get("name") ?? "",
    year: formData.get("year") ?? "",
    parcours: formData.get("parcours") ?? "",
    academicYear: formData.get("academicYear") ?? "",
  });
}

function isUniqueViolation(e: unknown) {
  return typeof e === "object" && e !== null && (e as { code?: unknown }).code === "P2002";
}

const DUPLICATE: FormResult = { ok: false, error: "Une promo porte déjà ce nom pour cette année universitaire." };

export async function createCohort(_prev: FormResult, formData: FormData): Promise<FormResult> {
  const user = await requireUser();
  const parsed = readCohort(formData);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error.issues) };
  if (!canManageCohorts(user)) return FORBIDDEN;

  const existing = await db.cohort.findUnique({
    where: { name_academicYear: { name: parsed.data.name, academicYear: parsed.data.academicYear } },
    select: { id: true },
  });
  if (existing) return DUPLICATE;

  try {
    await db.cohort.create({ data: parsed.data });
  } catch (e) {
    if (isUniqueViolation(e)) return DUPLICATE;
    throw e;
  }
  revalidatePath("/admin/cohorts");
  revalidatePath("/admin/users");
  return { ok: true, message: `Promo « ${parsed.data.name} » créée.` };
}

export async function updateCohort(cohortId: string, _prev: FormResult, formData: FormData): Promise<FormResult> {
  const user = await requireUser();
  const id = idSchema.safeParse(cohortId);
  const parsed = readCohort(formData);
  if (!id.success) return { ok: false, error: "Promo invalide." };
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error.issues) };
  if (!canManageCohorts(user)) return FORBIDDEN;

  const cohort = await db.cohort.findUnique({ where: { id: id.data }, select: { id: true } });
  if (!cohort) return { ok: false, error: "Promo introuvable." };
  const clash = await db.cohort.findUnique({
    where: { name_academicYear: { name: parsed.data.name, academicYear: parsed.data.academicYear } },
    select: { id: true },
  });
  if (clash && clash.id !== cohort.id) return DUPLICATE;

  try {
    await db.cohort.update({ where: { id: cohort.id }, data: parsed.data });
  } catch (e) {
    if (isUniqueViolation(e)) return DUPLICATE;
    throw e;
  }
  revalidatePath("/admin/cohorts");
  revalidatePath(`/admin/cohorts/${cohort.id}`);
  revalidatePath("/admin/users");
  return { ok: true, message: "Promo enregistrée." };
}

/** Supprime la promo (ses membres et ses annonces ; les SAÉ liées sont détachées) */
export async function deleteCohort(cohortId: string): Promise<FormResult> {
  const user = await requireUser();
  const id = idSchema.safeParse(cohortId);
  if (!id.success) return { ok: false, error: "Promo invalide." };
  if (!canManageCohorts(user)) return FORBIDDEN;

  const cohort = await db.cohort.findUnique({ where: { id: id.data }, select: { id: true } });
  if (!cohort) return { ok: false, error: "Promo introuvable." };

  await db.cohort.delete({ where: { id: cohort.id } });
  revalidatePath("/admin/cohorts");
  revalidatePath("/admin/users");
  revalidatePath("/admin/announcements");
  redirect("/admin/cohorts");
}

const addMembersSchema = z.object({
  emails: z.string().max(40_000, "Liste trop longue : collez au plus 500 adresses à la fois."),
});

function listPreview(items: string[], max = 10) {
  return items.length <= max ? items.join(", ") : `${items.slice(0, max).join(", ")}… (+${items.length - max})`;
}

/** Ajout de membres par adresses e-mail collées : rapporte les inconnues et les membres existants */
export async function addMembers(cohortId: string, _prev: FormResult, formData: FormData): Promise<FormResult> {
  const user = await requireUser();
  const id = idSchema.safeParse(cohortId);
  const parsed = addMembersSchema.safeParse({ emails: formData.get("emails") ?? "" });
  if (!id.success) return { ok: false, error: "Promo invalide." };
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error.issues) };
  if (!canManageCohorts(user)) return FORBIDDEN;

  const { emails, invalid, truncated } = parseEmailList(parsed.data.emails);
  if (emails.length === 0) {
    return {
      ok: false,
      error: invalid.length ? `Aucune adresse valide (${listPreview(invalid)}).` : "Collez au moins une adresse e-mail.",
    };
  }

  const cohort = await db.cohort.findUnique({ where: { id: id.data }, select: { id: true } });
  if (!cohort) return { ok: false, error: "Promo introuvable." };

  const users = await db.user.findMany({ where: { email: { in: emails } }, select: { id: true, email: true } });
  const found = new Set(users.map((u) => u.email.toLowerCase()));
  const unknown = emails.filter((e) => !found.has(e));

  const existing = users.length
    ? await db.cohortMember.findMany({
        where: { cohortId: cohort.id, userId: { in: users.map((u) => u.id) } },
        select: { userId: true },
      })
    : [];
  const already = new Set(existing.map((m) => m.userId));
  const toAdd = users.filter((u) => !already.has(u.id));

  if (toAdd.length > 0) {
    await db.cohortMember.createMany({
      data: toAdd.map((u) => ({ cohortId: cohort.id, userId: u.id })),
      skipDuplicates: true,
    });
    revalidatePath(`/admin/cohorts/${cohort.id}`);
    revalidatePath("/admin/cohorts");
    revalidatePath("/admin/users");
  }

  const lines = [`${toAdd.length} membre${toAdd.length > 1 ? "s" : ""} ajouté${toAdd.length > 1 ? "s" : ""}.`];
  if (already.size > 0) lines.push(`${already.size} déjà membre${already.size > 1 ? "s" : ""}.`);
  if (unknown.length > 0) lines.push(`Sans compte (${unknown.length}) : ${listPreview(unknown)}.`);
  if (invalid.length > 0) lines.push(`Adresses invalides (${invalid.length}) : ${listPreview(invalid)}.`);
  if (truncated) lines.push(`Seules les ${MAX_EMAILS_PER_PASTE} premières adresses ont été traitées.`);
  return { ok: true, message: lines.join("\n") };
}

export async function removeMember(cohortId: string, userId: string): Promise<FormResult> {
  const user = await requireUser();
  const ids = z.object({ cohortId: idSchema, userId: idSchema }).safeParse({ cohortId, userId });
  if (!ids.success) return { ok: false, error: "Données invalides." };
  if (!canManageCohorts(user)) return FORBIDDEN;

  const member = await db.cohortMember.findUnique({
    where: { cohortId_userId: { cohortId: ids.data.cohortId, userId: ids.data.userId } },
    select: { cohortId: true },
  });
  if (!member) return { ok: false, error: "Cette personne n'est plus membre de la promo." };

  await db.cohortMember.delete({ where: { cohortId_userId: { cohortId: ids.data.cohortId, userId: ids.data.userId } } });
  revalidatePath(`/admin/cohorts/${ids.data.cohortId}`);
  revalidatePath("/admin/cohorts");
  revalidatePath("/admin/users");
  return { ok: true };
}
