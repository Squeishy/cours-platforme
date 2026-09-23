"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { canEditAssessment, canViewSae } from "@/lib/permissions";
import { isValidLevel } from "@/lib/assessment";
import { firstIssue, type ActionResult } from "@/app/assessments/_lib/shared";

const itemSchema = z.object({
  criterionId: z.string().min(1).max(64),
  level: z
    .number({ error: "Niveau invalide" })
    .int("Niveau invalide")
    .refine((v) => isValidLevel(v), "Niveau invalide")
    .nullable(),
  justification: z.string().trim().max(5000, "Justification trop longue (5000 caractères maximum)"),
});

const assessmentSchema = z.object({
  items: z.array(itemSchema).max(200),
  reflection: z.string().trim().max(10000, "Réflexion trop longue (10 000 caractères maximum)"),
  intent: z.enum(["draft", "submit"], { error: "Action inconnue" }),
});

/** Champs du formulaire : `level:<criterionId>` et `justification:<criterionId>` */
function readItems(formData: FormData) {
  const byCriterion = new Map<string, { level: string; justification: string }>();
  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string") continue;
    const match = /^(level|justification):(.+)$/.exec(key);
    if (!match) continue;
    const [, field, criterionId] = match;
    const entry = byCriterion.get(criterionId) ?? { level: "", justification: "" };
    if (field === "level") entry.level = value;
    else entry.justification = value;
    byCriterion.set(criterionId, entry);
  }
  return [...byCriterion.entries()].map(([criterionId, { level, justification }]) => ({
    criterionId,
    level: level === "" ? null : Number(level),
    justification,
  }));
}

class AssessmentLockedError extends Error {}

export async function saveAssessment(
  milestoneId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();

  const id = z.string().min(1).max(64).safeParse(milestoneId);
  if (!id.success) return { ok: false, error: "Jalon invalide" };

  const reflectionRaw = formData.get("reflection");
  const parsed = assessmentSchema.safeParse({
    items: readItems(formData),
    reflection: typeof reflectionRaw === "string" ? reflectionRaw : "",
    intent: formData.get("intent"),
  });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error.issues) };
  const { items, reflection, intent } = parsed.data;

  const milestone = await db.milestone.findUnique({
    where: { id: id.data },
    select: {
      id: true,
      saeId: true,
      criteria: { select: { id: true, label: true } },
      sae: { select: { ownerId: true, published: true, teachers: { select: { id: true } } } },
    },
  });
  if (!milestone) return { ok: false, error: "Jalon introuvable" };
  if (!canViewSae(user, milestone.sae)) return { ok: false, error: "Accès refusé à cette SAÉ" };

  const group = await db.group.findFirst({
    where: { saeId: milestone.saeId, members: { some: { userId: user.id } } },
    select: { id: true },
  });
  if (!group) return { ok: false, error: "Vous n'êtes membre d'aucun groupe de cette SAÉ" };

  // Chaque critère envoyé doit appartenir à ce jalon, sans doublon
  const criterionIds = new Set(milestone.criteria.map((c) => c.id));
  if (items.some((item) => !criterionIds.has(item.criterionId))) {
    return { ok: false, error: "Critère inconnu pour ce jalon — rechargez la page" };
  }

  const justifiedWithoutLevel = items.filter((item) => item.level === null && item.justification !== "");
  if (justifiedWithoutLevel.length > 0) {
    return { ok: false, error: "Choisissez un niveau pour chaque critère que vous avez justifié" };
  }

  const leveled = items.filter((item): item is typeof item & { level: number } => item.level !== null);
  if (intent === "submit") {
    const missing = milestone.criteria.filter((c) => !leveled.some((item) => item.criterionId === c.id));
    if (missing.length > 0) {
      return {
        ok: false,
        error: `Pour soumettre, choisissez un niveau pour chaque critère (${missing.length} manquant${missing.length > 1 ? "s" : ""}).`,
      };
    }
  }

  const submitting = intent === "submit";
  let assessmentId: string;
  try {
    assessmentId = await db.$transaction(async (tx) => {
      const existing = await tx.selfAssessment.findUnique({
        where: { milestoneId_userId: { milestoneId: milestone.id, userId: user.id } },
        select: { id: true, userId: true, status: true },
      });
      if (existing && !canEditAssessment(user, existing)) throw new AssessmentLockedError();

      const data = {
        groupId: group.id,
        reflection: reflection === "" ? null : reflection,
        status: submitting ? ("SUBMITTED" as const) : ("DRAFT" as const),
        submittedAt: submitting ? new Date() : null,
      };
      const assessment = existing
        ? await tx.selfAssessment.update({ where: { id: existing.id }, data, select: { id: true } })
        : await tx.selfAssessment.create({
            data: { ...data, milestoneId: milestone.id, userId: user.id },
            select: { id: true },
          });

      for (const item of leveled) {
        const justification = item.justification === "" ? null : item.justification;
        await tx.selfAssessmentItem.upsert({
          where: { assessmentId_criterionId: { assessmentId: assessment.id, criterionId: item.criterionId } },
          create: { assessmentId: assessment.id, criterionId: item.criterionId, level: item.level, justification },
          update: { level: item.level, justification },
        });
      }
      return assessment.id;
    });
  } catch (error) {
    if (error instanceof AssessmentLockedError) {
      return { ok: false, error: "Cette auto-évaluation a déjà été soumise et ne peut plus être modifiée" };
    }
    console.error("saveAssessment", error);
    return { ok: false, error: "Enregistrement impossible, réessayez dans un instant" };
  }

  revalidatePath(`/saes/${milestone.saeId}/milestones/${milestone.id}`);
  revalidatePath(`/saes/${milestone.saeId}/milestones/${milestone.id}/assess`);
  revalidatePath(`/saes/${milestone.saeId}/groups/${group.id}`);
  revalidatePath(`/assessments/${assessmentId}`);

  if (submitting) redirect(`/assessments/${assessmentId}`);
  return { ok: true, message: "Brouillon enregistré" };
}
