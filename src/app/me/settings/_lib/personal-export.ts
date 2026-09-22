import "server-only";
import { db } from "@/lib/db";

/** Borne de sécurité par liste (un export ne doit jamais devenir une requête non bornée) */
const LIMIT = 5000;

/**
 * Données personnelles de l'utilisateur (droit d'accès / portabilité, RGPD art. 15 et 20).
 * Uniquement ce qui le concerne : jamais les données privées d'autres personnes
 * (évaluations de contribution : seulement celles qu'il a rédigées ; retours enseignants : seulement une fois publiés).
 */
export async function buildPersonalExport(userId: string) {
  const [
    profile,
    cohorts,
    groups,
    assessments,
    comments,
    depositLinks,
    evidences,
    favorites,
    notifications,
    peerReviews,
    questions,
    answers,
    announcements,
    snippets,
    sessions,
    accounts,
  ] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        image: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        calendarToken: true,
        portfolioToken: true,
      },
    }),
    db.cohortMember.findMany({
      where: { userId },
      select: { cohort: { select: { name: true, year: true, parcours: true, academicYear: true } } },
      take: LIMIT,
    }),
    db.groupMember.findMany({
      where: { userId },
      select: { joinedAt: true, group: { select: { id: true, name: true, sae: { select: { id: true, code: true, title: true } } } } },
      orderBy: { joinedAt: "asc" },
      take: LIMIT,
    }),
    db.selfAssessment.findMany({
      where: { userId },
      select: {
        id: true,
        status: true,
        reflection: true,
        submittedAt: true,
        feedbackPublishedAt: true,
        createdAt: true,
        updatedAt: true,
        milestone: { select: { id: true, title: true, sae: { select: { code: true, title: true } } } },
        items: {
          select: {
            level: true,
            justification: true,
            teacherLevel: true,
            teacherComment: true,
            criterion: { select: { label: true, acCode: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
      take: LIMIT,
    }),
    db.comment.findMany({
      where: { authorId: userId },
      select: { id: true, assessmentId: true, body: true, createdAt: true },
      orderBy: { createdAt: "asc" },
      take: LIMIT,
    }),
    db.depositLink.findMany({
      where: { addedById: userId },
      select: {
        url: true,
        label: true,
        provider: true,
        checkStatus: true,
        checkedAt: true,
        createdAt: true,
        group: { select: { name: true } },
        milestone: { select: { title: true } },
      },
      orderBy: { createdAt: "asc" },
      take: LIMIT,
    }),
    db.portfolioEvidence.findMany({
      where: { userId },
      select: {
        title: true,
        url: true,
        reflection: true,
        level: true,
        createdAt: true,
        updatedAt: true,
        learning: { select: { code: true, label: true } },
      },
      orderBy: { createdAt: "asc" },
      take: LIMIT,
    }),
    db.favorite.findMany({
      where: { userId },
      select: { kind: true, targetId: true, createdAt: true },
      orderBy: { createdAt: "asc" },
      take: LIMIT,
    }),
    db.notification.findMany({
      where: { userId },
      select: { type: true, title: true, body: true, link: true, readAt: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: LIMIT,
    }),
    db.peerReview.findMany({
      where: { reviewerId: userId },
      select: {
        contribution: true,
        comment: true,
        createdAt: true,
        updatedAt: true,
        reviewee: { select: { name: true } },
        milestone: { select: { title: true, sae: { select: { code: true, title: true } } } },
      },
      orderBy: { createdAt: "asc" },
      take: LIMIT,
    }),
    db.pageQuestion.findMany({
      where: { authorId: userId },
      select: {
        body: true,
        anonymous: true,
        resolved: true,
        createdAt: true,
        page: { select: { title: true, course: { select: { title: true } } } },
      },
      orderBy: { createdAt: "asc" },
      take: LIMIT,
    }),
    db.pageAnswer.findMany({
      where: { authorId: userId },
      select: { body: true, createdAt: true, questionId: true },
      orderBy: { createdAt: "asc" },
      take: LIMIT,
    }),
    db.announcement.findMany({
      where: { authorId: userId },
      select: { scope: true, title: true, body: true, pinned: true, createdAt: true },
      orderBy: { createdAt: "asc" },
      take: LIMIT,
    }),
    db.commentSnippet.findMany({
      where: { authorId: userId },
      select: { tag: true, body: true, createdAt: true },
      orderBy: { createdAt: "asc" },
      take: LIMIT,
    }),
    db.session.findMany({
      where: { userId },
      // Jamais le jeton de session
      select: { createdAt: true, expiresAt: true, ipAddress: true, userAgent: true },
      orderBy: { createdAt: "desc" },
      take: LIMIT,
    }),
    db.account.findMany({
      where: { userId },
      // Jamais le mot de passe (haché) ni les jetons du fournisseur
      select: { providerId: true, createdAt: true },
      take: LIMIT,
    }),
  ]);

  if (!profile) return null;
  const { calendarToken, portfolioToken, ...identity } = profile;

  return {
    format: "cours-sae/export-personnel@1",
    exportedAt: new Date().toISOString(),
    profile: {
      ...identity,
      calendarFeedEnabled: calendarToken !== null,
      publicPortfolioEnabled: portfolioToken !== null,
    },
    loginMethods: accounts,
    sessions,
    cohorts: cohorts.map((c) => c.cohort),
    groups: groups.map((g) => ({ joinedAt: g.joinedAt, group: g.group.name, groupId: g.group.id, sae: g.group.sae })),
    selfAssessments: assessments.map((a) => {
      const published = a.feedbackPublishedAt !== null;
      return {
        ...a,
        items: a.items.map((i) => ({
          criterion: i.criterion.label,
          acCode: i.criterion.acCode,
          level: i.level,
          justification: i.justification,
          // Positionnement enseignant : seulement une fois publié à l'étudiant
          ...(published ? { teacherLevel: i.teacherLevel, teacherComment: i.teacherComment } : {}),
        })),
      };
    }),
    commentsWritten: comments,
    depositLinksAdded: depositLinks,
    portfolioEvidences: evidences,
    favorites,
    notifications,
    peerReviewsWritten: peerReviews,
    questionsAsked: questions,
    answersWritten: answers,
    announcementsWritten: announcements,
    commentSnippets: snippets,
  };
}
