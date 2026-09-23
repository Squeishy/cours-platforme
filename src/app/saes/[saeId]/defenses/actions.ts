"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { canBookDefense, canManageSae, canViewSae } from "@/lib/permissions";
import { notify, saeStaffIds } from "@/lib/notify";
import { formatDateTime } from "@/lib/format";
import type { FormState } from "../../_lib/form-state";
import { DEFENSE_LOCK_MS, buildSlotStarts, isDefenseLocked } from "../../_lib/defense-slots";
import {
  FORBIDDEN,
  GENERIC_ERROR,
  NOT_FOUND_SAE,
  firstIssue,
  id,
  intInRange,
  isUniqueViolation,
  loadSae,
  optionalText,
  read,
  revalidateSae,
  saeAccessSelect,
  saeShortName,
} from "../../_lib/action-utils";

const MAX_SLOTS_PER_SAE = 400;
const SLOT_NOT_FOUND = { ok: false, error: "Créneau introuvable." } as const;
const LOCKED = {
  ok: false,
  error: "Ce créneau commence dans moins de 24 h : seule l'équipe pédagogique peut encore le modifier.",
} as const;

function loadSlot(slotId: string) {
  return db.defenseSlot.findUnique({
    where: { id: slotId },
    select: {
      id: true,
      saeId: true,
      startsAt: true,
      groupId: true,
      group: { select: { id: true, name: true, members: { select: { userId: true } } } },
      sae: { select: saeAccessSelect },
    },
  });
}

/** Groupe de l'utilisateur dans cette SAÉ (au plus un) */
function findMyGroup(saeId: string, userId: string) {
  return db.group.findFirst({
    where: { saeId, members: { some: { userId } } },
    select: { id: true, name: true, members: { select: { userId: true } } },
  });
}

const slotLink = (saeId: string) => `/saes/${saeId}/defenses`;

// ─────────────────────────────────────────────────────────────
// Équipe pédagogique : génération, suppression, attribution
// ─────────────────────────────────────────────────────────────

export async function generateDefenseSlots(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

  const parsed = z
    .object({
      saeId: id,
      date: z.string({ error: "Date requise" }).regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide"),
      startTime: z.string({ error: "Heure de début requise" }).regex(/^\d{2}:\d{2}$/, "Heure invalide"),
      count: intInRange("Nombre de créneaux", 1, 60),
      durationMin: intInRange("Durée", 5, 240),
      breakMin: intInRange("Pause", 0, 120),
      location: optionalText("Lieu", 190),
      jury: optionalText("Jury", 190),
    })
    .safeParse(read(formData, ["saeId", "date", "startTime", "count", "durationMin", "breakMin", "location", "jury"]));
  if (!parsed.success) return firstIssue(parsed.error);
  const data = parsed.data;

  const sae = await loadSae(data.saeId);
  if (!sae) return NOT_FOUND_SAE;
  if (!canManageSae(user, sae)) return FORBIDDEN;

  const built = buildSlotStarts(data);
  if (!built.ok) return built;

  try {
    const existing = await db.defenseSlot.count({ where: { saeId: sae.id } });
    if (existing + built.starts.length > MAX_SLOTS_PER_SAE) {
      return { ok: false, error: `${MAX_SLOTS_PER_SAE} créneaux maximum par SAÉ (${existing} existants).` };
    }
    await db.defenseSlot.createMany({
      data: built.starts.map((startsAt) => ({
        saeId: sae.id,
        startsAt,
        durationMin: data.durationMin,
        location: data.location,
        jury: data.jury,
      })),
    });
  } catch {
    return GENERIC_ERROR;
  }

  revalidateSae(sae.id);
  const n = built.starts.length;
  return { ok: true, message: `${n} créneau${n > 1 ? "x" : ""} créé${n > 1 ? "s" : ""}.` };
}

/** Supprime un créneau libre uniquement (un créneau attribué doit d'abord être libéré) */
export async function deleteDefenseSlot(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

  const parsed = z.object({ slotId: id }).safeParse(read(formData, ["slotId"]));
  if (!parsed.success) return firstIssue(parsed.error);

  const slot = await loadSlot(parsed.data.slotId);
  if (!slot) return SLOT_NOT_FOUND;
  if (!canManageSae(user, slot.sae)) return FORBIDDEN;

  try {
    const { count } = await db.defenseSlot.deleteMany({ where: { id: slot.id, groupId: null } });
    if (count === 0) return { ok: false, error: "Ce créneau est réservé : libérez-le avant de le supprimer." };
  } catch {
    return GENERIC_ERROR;
  }

  revalidateSae(slot.saeId);
  return { ok: true, message: "Créneau supprimé." };
}

/** Attribue (ou réattribue) un créneau à un groupe ; l'ancien créneau du groupe est libéré */
export async function assignDefenseSlot(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

  const parsed = z.object({ slotId: id, groupId: id }).safeParse(read(formData, ["slotId", "groupId"]));
  if (!parsed.success) return firstIssue(parsed.error);

  const slot = await loadSlot(parsed.data.slotId);
  if (!slot) return SLOT_NOT_FOUND;
  if (!canManageSae(user, slot.sae)) return FORBIDDEN;
  if (slot.groupId === parsed.data.groupId) return { ok: false, error: "Ce groupe a déjà ce créneau." };

  const group = await db.group.findUnique({
    where: { id: parsed.data.groupId },
    select: { id: true, saeId: true, name: true, members: { select: { userId: true } } },
  });
  if (!group || group.saeId !== slot.saeId) return { ok: false, error: "Groupe introuvable dans cette SAÉ." };

  try {
    await db.$transaction(async (tx) => {
      // Un groupe n'a qu'un créneau (groupId unique) : on libère l'éventuel précédent
      await tx.defenseSlot.updateMany({ where: { groupId: group.id }, data: { groupId: null, bookedAt: null } });
      await tx.defenseSlot.update({ where: { id: slot.id }, data: { groupId: group.id, bookedAt: new Date() } });
    });
  } catch (e) {
    return isUniqueViolation(e) ? { ok: false, error: "Conflit de réservation, réessayez." } : GENERIC_ERROR;
  }

  const when = formatDateTime(slot.startsAt);
  const name = saeShortName(slot.sae);
  await notify(
    group.members.map((m) => m.userId),
    { type: "defense", title: `${name} · Soutenance le ${when}`, body: `Créneau attribué à ${group.name}.`, link: slotLink(slot.saeId) },
    user.id,
  );
  if (slot.group && slot.group.id !== group.id) {
    await notify(
      slot.group.members.map((m) => m.userId),
      {
        type: "defense",
        title: `${name} · Créneau de soutenance retiré`,
        body: `Le créneau du ${when} a été attribué à un autre groupe. Choisissez un nouveau créneau.`,
        link: slotLink(slot.saeId),
      },
      user.id,
    );
  }

  revalidateSae(slot.saeId);
  return { ok: true, message: `Créneau attribué à ${group.name}.` };
}

export async function unassignDefenseSlot(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

  const parsed = z.object({ slotId: id }).safeParse(read(formData, ["slotId"]));
  if (!parsed.success) return firstIssue(parsed.error);

  const slot = await loadSlot(parsed.data.slotId);
  if (!slot) return SLOT_NOT_FOUND;
  if (!canManageSae(user, slot.sae)) return FORBIDDEN;
  if (!slot.group) return { ok: false, error: "Ce créneau est déjà libre." };

  try {
    await db.defenseSlot.update({ where: { id: slot.id }, data: { groupId: null, bookedAt: null } });
  } catch {
    return GENERIC_ERROR;
  }

  await notify(
    slot.group.members.map((m) => m.userId),
    {
      type: "defense",
      title: `${saeShortName(slot.sae)} · Créneau de soutenance libéré`,
      body: `Le créneau du ${formatDateTime(slot.startsAt)} n'est plus attribué à ${slot.group.name}.`,
      link: slotLink(slot.saeId),
    },
    user.id,
  );

  revalidateSae(slot.saeId);
  return { ok: true, message: "Créneau libéré." };
}

// ─────────────────────────────────────────────────────────────
// Groupes : réservation d'un créneau libre / annulation (verrouillées à moins de 24 h)
// ─────────────────────────────────────────────────────────────

export async function bookDefenseSlot(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

  const parsed = z.object({ slotId: id }).safeParse(read(formData, ["slotId"]));
  if (!parsed.success) return firstIssue(parsed.error);

  const slot = await loadSlot(parsed.data.slotId);
  if (!slot) return SLOT_NOT_FOUND;
  if (!canViewSae(user, slot.sae)) return FORBIDDEN;

  const group = await findMyGroup(slot.saeId, user.id);
  if (!group || !canBookDefense(user, group, slot.sae)) {
    return { ok: false, error: "Seuls les membres d'un groupe de la SAÉ peuvent réserver un créneau." };
  }
  if (slot.groupId === group.id) return { ok: false, error: "Votre groupe a déjà réservé ce créneau." };
  if (slot.groupId) return { ok: false, error: "Ce créneau est déjà pris." };
  const now = new Date();
  if (isDefenseLocked(slot.startsAt, now)) return LOCKED;

  try {
    const existing = await db.defenseSlot.findUnique({ where: { groupId: group.id }, select: { id: true } });
    if (existing) return { ok: false, error: "Votre groupe a déjà un créneau : annulez-le avant d'en choisir un autre." };
    // Réservation atomique : ne réussit que si le créneau est toujours libre et hors délai de verrouillage
    const { count } = await db.defenseSlot.updateMany({
      where: { id: slot.id, groupId: null, startsAt: { gte: new Date(now.getTime() + DEFENSE_LOCK_MS) } },
      data: { groupId: group.id, bookedAt: now },
    });
    if (count === 0) return { ok: false, error: "Ce créneau vient d'être réservé par un autre groupe." };
  } catch (e) {
    return isUniqueViolation(e)
      ? { ok: false, error: "Votre groupe a déjà un créneau : annulez-le avant d'en choisir un autre." }
      : GENERIC_ERROR;
  }

  await notify(
    await saeStaffIds(slot.saeId),
    {
      type: "defense",
      title: `${saeShortName(slot.sae)} · ${group.name} a réservé une soutenance`,
      body: `Créneau du ${formatDateTime(slot.startsAt)}.`,
      link: slotLink(slot.saeId),
    },
    user.id,
  );

  revalidateSae(slot.saeId);
  return { ok: true, message: "Créneau réservé pour votre groupe." };
}

export async function cancelDefenseBooking(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

  const parsed = z.object({ slotId: id }).safeParse(read(formData, ["slotId"]));
  if (!parsed.success) return firstIssue(parsed.error);

  const slot = await loadSlot(parsed.data.slotId);
  if (!slot) return SLOT_NOT_FOUND;
  if (!canViewSae(user, slot.sae)) return FORBIDDEN;

  const group = await findMyGroup(slot.saeId, user.id);
  if (!group || slot.groupId !== group.id) return { ok: false, error: "Ce créneau n'est pas réservé par votre groupe." };
  const now = new Date();
  if (isDefenseLocked(slot.startsAt, now)) return LOCKED;

  try {
    const { count } = await db.defenseSlot.updateMany({
      where: { id: slot.id, groupId: group.id, startsAt: { gte: new Date(now.getTime() + DEFENSE_LOCK_MS) } },
      data: { groupId: null, bookedAt: null },
    });
    if (count === 0) return { ok: false, error: "La réservation a déjà été modifiée. Rechargez la page." };
  } catch {
    return GENERIC_ERROR;
  }

  await notify(
    await saeStaffIds(slot.saeId),
    {
      type: "defense",
      title: `${saeShortName(slot.sae)} · ${group.name} a annulé sa soutenance`,
      body: `Le créneau du ${formatDateTime(slot.startsAt)} est de nouveau libre.`,
      link: slotLink(slot.saeId),
    },
    user.id,
  );

  revalidateSae(slot.saeId);
  return { ok: true, message: "Réservation annulée." };
}
