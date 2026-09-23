import { db } from "@/lib/db";
import { formatDateTime, timeAgo } from "@/lib/format";
import {
  canAnswerQuestion,
  canAskQuestion,
  canModerateQuestion,
  canResolveQuestion,
  canSeeAnonymousAuthor,
  type Actor,
} from "@/lib/permissions";
import { ActionButton } from "./action-button";
import { Chevron } from "./chevron";
import { AnswerForm } from "./answer-form";
import { QuestionForm } from "./question-form";
import {
  answerQuestion,
  askQuestion,
  deleteAnswer,
  deleteQuestion,
  setQuestionInFaq,
  setQuestionResolved,
} from "../[slug]/pages/[pageId]/actions";

const MAX_QUESTIONS = 50;
const MAX_ANSWERS = 50;

type CourseForQuestions = { ownerId: string; published: boolean; editors: { id: string }[] };

type Props = { user: Actor; course: CourseForQuestions; pageId: string };

/**
 * Questions & réponses sous une page de cours. Texte brut uniquement.
 * L'identité d'un auteur anonyme n'est jamais envoyée au navigateur d'un étudiant.
 */
export async function QuestionsSection({ user, course, pageId }: Props) {
  const [questions, total] = await Promise.all([
    db.pageQuestion.findMany({
      where: { pageId },
      orderBy: { createdAt: "desc" },
      take: MAX_QUESTIONS,
      select: {
        id: true,
        body: true,
        anonymous: true,
        resolved: true,
        inFaq: true,
        createdAt: true,
        authorId: true,
        author: { select: { name: true } },
        answers: {
          orderBy: { createdAt: "asc" },
          take: MAX_ANSWERS,
          select: { id: true, body: true, createdAt: true, authorId: true, author: { select: { name: true } } },
        },
      },
    }),
    db.pageQuestion.count({ where: { pageId } }),
  ]);

  const team = new Set([course.ownerId, ...course.editors.map((e) => e.id)]);
  const seeAnonymous = canSeeAnonymousAuthor(user, course);
  const moderate = canModerateQuestion(user, course);
  const canAsk = canAskQuestion(user, course);
  const canAnswer = canAnswerQuestion(user, course);

  function questionAuthor(q: (typeof questions)[number]) {
    if (q.authorId === user.id) return q.anonymous ? "Vous (anonyme pour les autres étudiants)" : "Vous";
    if (!q.anonymous) return q.author.name;
    return seeAnonymous ? `${q.author.name} (anonyme pour les étudiants)` : "Anonyme";
  }

  function answerAuthor(q: (typeof questions)[number], a: (typeof questions)[number]["answers"][number]) {
    if (a.authorId === user.id) return "Vous";
    // Une relance de l'auteur d'une question anonyme ne doit pas révéler son nom
    if (q.anonymous && a.authorId === q.authorId && !seeAnonymous) return "Auteur de la question";
    return a.author.name;
  }

  return (
    <section aria-labelledby="questions-title" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="questions-title" className="text-lg font-semibold">
          Questions{total > 0 && <span className="font-normal text-muted"> ({total})</span>}
        </h2>
        <p className="text-sm text-muted">
          Une question sur cette page ? Posez-la ici : l&apos;équipe du cours est prévenue et la réponse profite à tous.
        </p>
      </div>

      {canAsk && (
        <div className="card">
          <QuestionForm action={askQuestion.bind(null, pageId)} />
        </div>
      )}

      {questions.length === 0 ? (
        <p className="text-muted">Aucune question pour l&apos;instant.</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {questions.map((q) => {
            const canResolve = canResolveQuestion(user, q, course);
            const canDelete = q.authorId === user.id || moderate;
            return (
              <li key={q.id} id={`q-${q.id}`} className="card flex scroll-mt-20 flex-col gap-3">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
                  <span className="font-medium text-ink">{questionAuthor(q)}</span>
                  <span aria-hidden="true">·</span>
                  <time dateTime={q.createdAt.toISOString()} title={formatDateTime(q.createdAt)}>
                    {timeAgo(q.createdAt)}
                  </time>
                  {q.resolved && <span className="badge badge-ok">Résolue</span>}
                  {q.inFaq && <span className="badge badge-accent">FAQ</span>}
                </div>
                <p className="whitespace-pre-line break-words">{q.body}</p>

                {q.answers.length > 0 && (
                  <ol aria-label="Réponses" className="flex flex-col gap-3 border-l-2 border-line pl-3">
                    {q.answers.map((a) => (
                      <li key={a.id} className="flex flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
                          <span className="font-medium text-ink">{answerAuthor(q, a)}</span>
                          {team.has(a.authorId) && <span className="badge badge-accent">Équipe du cours</span>}
                          <span aria-hidden="true">·</span>
                          <time dateTime={a.createdAt.toISOString()} title={formatDateTime(a.createdAt)}>
                            {timeAgo(a.createdAt)}
                          </time>
                        </div>
                        <p className="whitespace-pre-line break-words">{a.body}</p>
                        {(a.authorId === user.id || moderate) && (
                          <ActionButton
                            action={deleteAnswer.bind(null, a.id)}
                            label="Supprimer la réponse"
                            pendingLabel="Suppression…"
                            variant="ghost"
                            className="self-start"
                            confirmMessage="Supprimer cette réponse ?"
                          />
                        )}
                      </li>
                    ))}
                  </ol>
                )}

                {(canResolve || moderate || canDelete) && (
                  <div className="flex flex-wrap items-start gap-2">
                    {canResolve && (
                      <ActionButton
                        action={setQuestionResolved.bind(null, q.id, !q.resolved)}
                        label={q.resolved ? "Rouvrir la question" : "Marquer comme résolue"}
                        pendingLabel="Enregistrement…"
                      />
                    )}
                    {moderate && (
                      <ActionButton
                        action={setQuestionInFaq.bind(null, q.id, !q.inFaq)}
                        label={q.inFaq ? "Retirer de la FAQ" : "Ajouter à la FAQ"}
                        pendingLabel="Enregistrement…"
                      />
                    )}
                    {canDelete && (
                      <ActionButton
                        action={deleteQuestion.bind(null, q.id)}
                        label="Supprimer"
                        ariaLabel="Supprimer la question et ses réponses"
                        pendingLabel="Suppression…"
                        variant="danger"
                        confirmMessage="Supprimer cette question et toutes ses réponses ?"
                      />
                    )}
                  </div>
                )}

                {canAnswer && (
                  <details className="group">
                    <summary className="flex min-h-11 cursor-pointer items-center gap-2 font-medium text-accent list-none [&::-webkit-details-marker]:hidden">
                      <Chevron />
                      Répondre
                    </summary>
                    <AnswerForm action={answerQuestion.bind(null, q.id)} />
                  </details>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {total > questions.length && (
        <p className="text-sm text-muted">Seules les {MAX_QUESTIONS} questions les plus récentes sont affichées.</p>
      )}
    </section>
  );
}
