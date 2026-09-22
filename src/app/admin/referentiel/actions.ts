"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { canManageReferentiel } from "@/lib/permissions";
import { MMI_PARCOURS } from "@/data/referentiel-mmi";
import type { FormState } from "@/app/saes/_lib/form-state";
import { AC_CODE_PATTERN, parseAcCode } from "@/app/saes/_lib/criteria";
import {
  FORBIDDEN,
  GENERIC_ERROR,
  firstIssue,
  id,
  isUniqueViolation,
  read,
  requiredText,
} from "@/app/saes/_lib/action-utils";

const PARCOURS_CODES = MMI_PARCOURS.map((p) => p.code) as string[];

function revalidateReferentiel() {
  revalidatePath("/admin/referentiel");
  // Les libellés d'AC apparaissent dans les SAÉ, jalons et portfolios
  revalidatePath("/saes", "layout");
  revalidatePath("/me", "layout");
}

export async function updateLearningLabel(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

  const parsed = z
    .object({ learningId: id, label: requiredText("Libellé", 1000) })
    .safeParse(read(formData, ["learningId", "label"]));
  if (!parsed.success) return firstIssue(parsed.error);

  if (!canManageReferentiel(user)) return FORBIDDEN;
  const learning = await db.criticalLearning.findUnique({ where: { id: parsed.data.learningId }, select: { id: true } });
  if (!learning) return { ok: false, error: "Apprentissage critique introuvable." };

  try {
    await db.criticalLearning.update({ where: { id: learning.id }, data: { label: parsed.data.label } });
  } catch {
    return GENERIC_ERROR;
  }

  revalidateReferentiel();
  return { ok: true, message: "Libellé enregistré." };
}

/** AC local (adaptation locale du programme) : niveau et compétence déduits du code */
export async function createLocalLearning(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

  const parsed = z
    .object({
      code: z
        .string({ error: "Code requis" })
        .trim()
        .toUpperCase()
        .regex(AC_CODE_PATTERN, "Code attendu : AC, niveau (1-3), compétence (1-5), point, deux chiffres — ex. AC24.07"),
      label: requiredText("Libellé", 1000),
      parcours: z
        .string()
        .trim()
        .optional()
        .transform((v) => (v ? v : null))
        .refine((v) => v === null || PARCOURS_CODES.includes(v), "Parcours inconnu"),
    })
    .safeParse(read(formData, ["code", "label", "parcours"]));
  if (!parsed.success) return firstIssue(parsed.error);
  const data = parsed.data;

  if (!canManageReferentiel(user)) return FORBIDDEN;

  const decoded = parseAcCode(data.code);
  if (!decoded) return { ok: false, error: "Code AC invalide." };
  const competence = await db.competence.findUnique({ where: { code: decoded.competenceCode }, select: { id: true } });
  if (!competence) return { ok: false, error: `La compétence ${decoded.competenceCode} n'existe pas dans le référentiel.` };

  try {
    await db.criticalLearning.create({
      data: {
        code: data.code,
        label: data.label,
        level: decoded.level,
        competenceId: competence.id,
        parcours: data.parcours,
      },
    });
  } catch (e) {
    return isUniqueViolation(e) ? { ok: false, error: `Le code ${data.code} existe déjà.` } : GENERIC_ERROR;
  }

  revalidateReferentiel();
  return { ok: true, message: `${data.code} ajouté (niveau ${decoded.level}, ${decoded.competenceCode}).` };
}

/** Suppression uniquement si aucun critère ni aucune trace de portfolio n'y est rattaché */
export async function deleteLearning(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

  const parsed = z.object({ learningId: id }).safeParse(read(formData, ["learningId"]));
  if (!parsed.success) return firstIssue(parsed.error);

  if (!canManageReferentiel(user)) return FORBIDDEN;

  try {
    // Condition dans la requête elle-même : pas de fenêtre entre la vérification et la suppression
    const { count } = await db.criticalLearning.deleteMany({
      where: { id: parsed.data.learningId, criteria: { none: {} }, evidences: { none: {} } },
    });
    if (count === 0) {
      const exists = await db.criticalLearning.findUnique({ where: { id: parsed.data.learningId }, select: { id: true } });
      return exists
        ? { ok: false, error: "Cet AC est utilisé par des critères ou des traces de portfolio : suppression impossible." }
        : { ok: false, error: "Apprentissage critique introuvable." };
    }
  } catch {
    return GENERIC_ERROR;
  }

  revalidateReferentiel();
  return { ok: true, message: "Apprentissage critique supprimé." };
}
