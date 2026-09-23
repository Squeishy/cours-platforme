"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { notify } from "@/lib/notify";
import { requireUser } from "@/lib/session";
import {
  canAnswerQuestion,
  canAskQuestion,
  canModerateQuestion,
  canResolveQuestion,
} from "@/lib/permissions";
import type { ActionState } from "../../../_lib/action-state";

// ── Schémas ──────────────────────────────────────────────────
const idSchema = z.string().min(1).max(64);
const questionSchema = z.object({
  body: z.string().trim().min(1, "Écrivez votre question.").max(5000, "Question trop longue (5000 caractères max)."),
  anonymous: z.boolean(),
});
const answerSchema = z
  .string()
  .trim()
  .min(1, "Écrivez votre réponse.")
  .max(5000, "Réponse trop longue (5000 caractères max).");

/** Anti-flood : chaque question/réponse déclenche des notifications */
const MAX_QUESTIONS_PER_MINUTE = 5;
const MAX_ANSWERS_PER_MINUTE = 10;

// ── Utilitaires ──────────────────────────────────────────────
function str(formData: FormData, key: string) {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
}

function firstError(error: z.ZodError) {
  return error.issues[0]?.message ?? "Données invalides.";
}

function excerpt(text: string, max = 160) {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

const courseSelect = {
  id: true,
  slug: true,
  ownerId: true,
  published: true,
  editors: { select: { id: true } },
} as const;

function loadPage(pageId: string) {
  return db.page.findUnique({
    where: { id: pageId },
    select: { id: true, title: true, course: { select: courseSelect } },
  });
}

function loadQuestion(questionId: string) {
  return db.pageQuestion.findUnique({
    where: { id: questionId },
    select: {
      id: true,
      authorId: true,
      page: { select: { id: true, title: true, course: { select: courseSelect } } },
    },
  });
}

function pageLink(slug: string, pageId: string, questionId?: string) {
  return `/courses/${slug}/pages/${pageId}${questionId ? `#q-${questionId}` : ""}`;
}

function revalidateQuestions(slug: string, pageId: string) {
  revalidatePath(`/courses/${slug}/pages/${pageId}`);
  revalidatePath(`/courses/${slug}/faq`);
}

// ── Questions ────────────────────────────────────────────────
export async function askQuestion(pageId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (!idSchema.safeParse(pageId).success) return { ok: false, error: "Page invalide." };

  const values = { body: str(formData, "body"), anonymous: formData.get("anonymous") === "on" ? "on" : "" };
  const parsed = questionSchema.safeParse({ body: values.body, anonymous: values.anonymous === "on" });
  if (!parsed.success) return { ok: false, error: firstError(parsed.error), values };

  const page = await loadPage(pageId);
  if (!page) return { ok: false, error: "Page introuvable." };
  if (!canAskQuestion(user, page.course)) return { ok: false, error: "Vous ne pouvez pas poser de question sur ce cours." };

  const recent = await db.pageQuestion.count({
    where: { authorId: user.id, createdAt: { gte: new Date(Date.now() - 60_000) } },
  });
  if (recent >= MAX_QUESTIONS_PER_MINUTE) {
    return { ok: false, error: "Trop de questions envoyées d'un coup : réessayez dans une minute.", values };
  }

  const question = await db.pageQuestion.create({
    data: { pageId: page.id, authorId: user.id, body: parsed.data.body, anonymous: parsed.data.anonymous },
    select: { id: true },
  });

  // L'équipe du cours voit toujours l'auteur (modération) : pas de nom dans la notification pour autant
  await notify(
    [page.course.ownerId, ...page.course.editors.map((e) => e.id)],
    {
      type: "question",
      title: `Nouvelle question sur « ${page.title} »`,
      body: excerpt(parsed.data.body),
      link: pageLink(page.course.slug, page.id, question.id),
    },
    user.id,
  );

  revalidateQuestions(page.course.slug, page.id);
  return { ok: true };
}

export async function answerQuestion(questionId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (!idSchema.safeParse(questionId).success) return { ok: false, error: "Question invalide." };

  const values = { body: str(formData, "body") };
  const parsed = answerSchema.safeParse(values.body);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error), values };

  const question = await loadQuestion(questionId);
  if (!question) return { ok: false, error: "Question introuvable." };
  const { page } = question;
  if (!canAnswerQuestion(user, page.course)) return { ok: false, error: "Vous ne pouvez pas répondre sur ce cours." };

  const recent = await db.pageAnswer.count({
    where: { authorId: user.id, createdAt: { gte: new Date(Date.now() - 60_000) } },
  });
  if (recent >= MAX_ANSWERS_PER_MINUTE) {
    return { ok: false, error: "Trop de réponses envoyées d'un coup : réessayez dans une minute.", values };
  }

  await db.pageAnswer.create({ data: { questionId: question.id, authorId: user.id, body: parsed.data } });

  await notify(
    [question.authorId],
    {
      type: "answer",
      title: `Réponse à votre question sur « ${page.title} »`,
      body: excerpt(parsed.data),
      link: pageLink(page.course.slug, page.id, question.id),
    },
    user.id,
  );

  revalidateQuestions(page.course.slug, page.id);
  return { ok: true };
}

/** Marquer résolu / rouvrir : l'auteur de la question ou l'équipe du cours */
export async function setQuestionResolved(questionId: string, resolved: boolean): Promise<ActionState> {
  const user = await requireUser();
  if (!idSchema.safeParse(questionId).success || !z.boolean().safeParse(resolved).success) {
    return { ok: false, error: "Requête invalide." };
  }

  const question = await loadQuestion(questionId);
  if (!question) return { ok: false, error: "Question introuvable." };
  if (!canResolveQuestion(user, question, question.page.course)) {
    return { ok: false, error: "Vous ne pouvez pas modifier cette question." };
  }

  await db.pageQuestion.update({ where: { id: question.id }, data: { resolved } });
  revalidateQuestions(question.page.course.slug, question.page.id);
  return { ok: true };
}

/** Ajouter à la FAQ du cours / l'en retirer : équipe du cours */
export async function setQuestionInFaq(questionId: string, inFaq: boolean): Promise<ActionState> {
  const user = await requireUser();
  if (!idSchema.safeParse(questionId).success || !z.boolean().safeParse(inFaq).success) {
    return { ok: false, error: "Requête invalide." };
  }

  const question = await loadQuestion(questionId);
  if (!question) return { ok: false, error: "Question introuvable." };
  if (!canModerateQuestion(user, question.page.course)) {
    return { ok: false, error: "Seule l'équipe du cours gère la FAQ." };
  }

  await db.pageQuestion.update({ where: { id: question.id }, data: { inFaq } });
  revalidateQuestions(question.page.course.slug, question.page.id);
  return { ok: true };
}

/** Suppression : l'auteur ou l'équipe du cours (les réponses partent avec la question) */
export async function deleteQuestion(questionId: string): Promise<ActionState> {
  const user = await requireUser();
  if (!idSchema.safeParse(questionId).success) return { ok: false, error: "Question invalide." };

  const question = await loadQuestion(questionId);
  if (!question) return { ok: false, error: "Question introuvable." };
  if (question.authorId !== user.id && !canModerateQuestion(user, question.page.course)) {
    return { ok: false, error: "Vous ne pouvez pas supprimer cette question." };
  }

  await db.pageQuestion.delete({ where: { id: question.id } });
  revalidateQuestions(question.page.course.slug, question.page.id);
  return { ok: true };
}

export async function deleteAnswer(answerId: string): Promise<ActionState> {
  const user = await requireUser();
  if (!idSchema.safeParse(answerId).success) return { ok: false, error: "Réponse invalide." };

  const answer = await db.pageAnswer.findUnique({
    where: { id: answerId },
    select: {
      id: true,
      authorId: true,
      question: { select: { page: { select: { id: true, course: { select: courseSelect } } } } },
    },
  });
  if (!answer) return { ok: false, error: "Réponse introuvable." };
  const { page } = answer.question;
  if (answer.authorId !== user.id && !canModerateQuestion(user, page.course)) {
    return { ok: false, error: "Vous ne pouvez pas supprimer cette réponse." };
  }

  await db.pageAnswer.delete({ where: { id: answer.id } });
  revalidateQuestions(page.course.slug, page.id);
  return { ok: true };
}
