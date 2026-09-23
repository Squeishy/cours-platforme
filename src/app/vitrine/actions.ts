"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import {
  canPublishShowcase,
  canRequestShowcase,
  canViewSae,
} from "@/lib/permissions";
import { notify, saeStaffIds } from "@/lib/notify";
import {
  firstIssue,
  idSchema,
  type ActionResult,
} from "@/app/me/portfolio/_lib/shared";
import {
  moderationSchema,
  showcaseRequestSchema,
  type ModerationDecision,
  sameShowcase,
  showcaseSnapshot,
  type ShowcaseSnapshot,
} from "./_lib/showcase";

function loadGroup(groupId: string) {
  return db.group.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      name: true,
      saeId: true,
      showcaseStatus: true,
      showcaseTitle: true,
      showcaseSummary: true,
      showcaseImageUrl: true,
      showcaseCategory: true,
      showcaseUrl: true,
      members: { select: { userId: true } },
      sae: {
        select: {
          code: true,
          title: true,
          ownerId: true,
          published: true,
          teachers: { select: { id: true } },
        },
      },
    },
  });
}

function revalidateShowcase(saeId: string, groupId: string) {
  revalidatePath(`/saes/${saeId}/groups/${groupId}`);
  revalidatePath("/vitrine");
  revalidatePath("/vitrine/moderation");
}

/** Le groupe propose son projet (ou met à jour sa proposition) : repasse en attente de validation */
export async function requestShowcase(
  groupId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const id = idSchema.safeParse(groupId);
  if (!id.success) return { ok: false, error: "Groupe invalide" };

  const parsed = showcaseRequestSchema.safeParse({
    title: formData.get("title") ?? "",
    summary: formData.get("summary") ?? "",
    url: formData.get("url") ?? "",
    imageUrl: formData.get("imageUrl") ?? "",
    category: formData.get("category") ?? "",
    consent: formData.get("consent") ?? "",
  });
  if (!parsed.success)
    return { ok: false, error: firstIssue(parsed.error.issues) };

  const group = await loadGroup(id.data);
  if (!group) return { ok: false, error: "Groupe introuvable" };
  if (!canViewSae(user, group.sae) || !canRequestShowcase(user, group)) {
    return {
      ok: false,
      error:
        "Seuls les membres du groupe peuvent proposer le projet à la vitrine",
    };
  }

  const { title, summary, url, imageUrl, category } = parsed.data;
  const wasPublished = group.showcaseStatus === "PUBLISHED";
  await db.group.update({
    where: { id: group.id },
    data: {
      showcaseStatus: "PENDING",
      showcaseTitle: title,
      showcaseSummary: summary,
      showcaseUrl: url,
      showcaseImageUrl: imageUrl,
      showcaseCategory: category,
    },
  });

  const saeLabel = group.sae.code
    ? `${group.sae.code} — ${group.sae.title}`
    : group.sae.title;
  await notify(
    await saeStaffIds(group.saeId),
    {
      type: "showcase",
      title: `${wasPublished ? "Vitrine modifiée" : "Demande de vitrine"} : ${group.name}`,
      body: `« ${title} » (${saeLabel}) attend votre validation.`,
      link: "/vitrine/moderation",
    },
    user.id,
  );

  revalidateShowcase(group.saeId, group.id);
  return {
    ok: true,
    message: wasPublished
      ? "Modifications envoyées : le projet est retiré de la vitrine jusqu'à la nouvelle validation."
      : "Demande envoyée à l'équipe pédagogique.",
  };
}

/** Un membre retire la demande en attente */
export async function cancelShowcaseRequest(
  groupId: string,
): Promise<ActionResult> {
  const user = await requireUser();
  const id = idSchema.safeParse(groupId);
  if (!id.success) return { ok: false, error: "Groupe invalide" };

  const group = await loadGroup(id.data);
  if (!group) return { ok: false, error: "Groupe introuvable" };
  if (!canViewSae(user, group.sae) || !canRequestShowcase(user, group)) {
    return { ok: false, error: "Action réservée aux membres du groupe" };
  }

  const { count } = await db.group.updateMany({
    where: { id: group.id, showcaseStatus: "PENDING" },
    data: { showcaseStatus: "NONE" },
  });
  if (count === 0)
    return { ok: false, error: "Aucune demande en attente (déjà traitée ?)" };

  revalidateShowcase(group.saeId, group.id);
  return { ok: true, message: "Demande annulée." };
}

const TRANSITIONS: Record<
  ModerationDecision,
  {
    from: "PENDING" | "PUBLISHED";
    to: "PUBLISHED" | "NONE";
    title: string;
    done: string;
  }
> = {
  publish: {
    from: "PENDING",
    to: "PUBLISHED",
    title: "Votre projet est publié dans la vitrine",
    done: "Projet publié.",
  },
  refuse: {
    from: "PENDING",
    to: "NONE",
    title: "Demande de vitrine non retenue",
    done: "Demande refusée.",
  },
  unpublish: {
    from: "PUBLISHED",
    to: "NONE",
    title: "Projet retiré de la vitrine",
    done: "Projet retiré de la vitrine.",
  },
};

/** Équipe pédagogique : publier / refuser une demande, retirer un projet publié */
export async function moderateShowcase(
  groupId: string,
  seen: ShowcaseSnapshot,
  input: { decision: ModerationDecision; reason?: string },
): Promise<ActionResult> {
  const user = await requireUser();
  const id = idSchema.safeParse(groupId);
  const parsed = moderationSchema.safeParse(input);
  if (!id.success) return { ok: false, error: "Groupe invalide" };
  if (!parsed.success)
    return { ok: false, error: firstIssue(parsed.error.issues) };

  const group = await loadGroup(id.data);
  if (!group) return { ok: false, error: "Groupe introuvable" };
  if (!canPublishShowcase(user, group.sae)) {
    return {
      ok: false,
      error: "Seule l'équipe pédagogique de la SAÉ peut modérer la vitrine",
    };
  }

  const { decision, reason } = parsed.data;
  const t = TRANSITIONS[decision];
  if (decision === "publish" && (!group.showcaseTitle || !group.showcaseUrl)) {
    return {
      ok: false,
      error: "La demande est incomplète (titre ou lien manquant)",
    };
  }

  // Le groupe a pu modifier sa demande pendant la relecture : on ne publie que ce qui a été vu
  const expected = showcaseSnapshot(seen);
  if (!sameShowcase(expected, showcaseSnapshot(group))) {
    return {
      ok: false,
      error:
        "Le groupe a modifié sa demande entre-temps : rechargez la page pour relire la nouvelle version",
    };
  }

  // Transition atomique : échoue si un autre enseignant a déjà traité la demande ou si le contenu a changé
  const { count } = await db.group.updateMany({
    where: { id: group.id, showcaseStatus: t.from, ...expected },
    data: { showcaseStatus: t.to },
  });
  if (count === 0)
    return {
      ok: false,
      error: "Le statut a changé entre-temps : rechargez la page",
    };

  await notify(
    group.members.map((m) => m.userId),
    {
      type: "showcase",
      title: t.title,
      body: [
        group.showcaseTitle ? `« ${group.showcaseTitle} »` : null,
        reason ? `Motif : ${reason}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
      link:
        decision === "publish"
          ? "/vitrine"
          : `/saes/${group.saeId}/groups/${group.id}#vitrine`,
    },
    user.id,
  );

  revalidateShowcase(group.saeId, group.id);
  return { ok: true, message: t.done };
}
