// Règles d'autorisation — fonctions pures, testées dans permissions.test.ts.
// Toute Server Action / page doit passer par ces fonctions (jamais seulement masquer l'UI).

export type Role = "ADMIN" | "TEACHER" | "STUDENT";

export type Actor = { id: string; role: Role };

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrateur",
  TEACHER: "Enseignant",
  STUDENT: "Étudiant",
};

export const isAdmin = (u: Actor) => u.role === "ADMIN";
export const isStaff = (u: Actor) => u.role === "ADMIN" || u.role === "TEACHER";

// ── Cours ────────────────────────────────────────────────────
type CourseLike = { ownerId: string; published: boolean; editors?: { id: string }[] };

export function canCreateCourse(u: Actor) {
  return isStaff(u);
}

export function canEditCourse(u: Actor, c: CourseLike) {
  return isAdmin(u) || c.ownerId === u.id || (isStaff(u) && !!c.editors?.some((e) => e.id === u.id));
}

/** Suppression : propriétaire ou administrateur uniquement */
export function canDeleteCourse(u: Actor, c: { ownerId: string }) {
  return isAdmin(u) || c.ownerId === u.id;
}

export function canViewCourse(u: Actor, c: CourseLike) {
  return c.published || canEditCourse(u, c);
}

// ── SAE ──────────────────────────────────────────────────────
type SaeLike = { ownerId: string; published: boolean; teachers?: { id: string }[] };

export function canCreateSae(u: Actor) {
  return isStaff(u);
}

/** Gérer le sujet, les jalons, les critères et les groupes */
export function canManageSae(u: Actor, s: SaeLike) {
  return isAdmin(u) || s.ownerId === u.id || (isStaff(u) && !!s.teachers?.some((t) => t.id === u.id));
}

/** Suppression : propriétaire ou administrateur uniquement */
export function canDeleteSae(u: Actor, s: { ownerId: string }) {
  return isAdmin(u) || s.ownerId === u.id;
}

export function canViewSae(u: Actor, s: SaeLike) {
  return s.published || canManageSae(u, s);
}

// ── Groupes ──────────────────────────────────────────────────
type GroupLike = { members: { userId: string }[] };

export function isGroupMember(u: Actor, g: GroupLike) {
  return g.members.some((m) => m.userId === u.id);
}

/** Modifier l'espace de travail du groupe et ajouter des URL de dépôt */
export function canContributeToGroup(u: Actor, g: GroupLike, sae: SaeLike) {
  return isGroupMember(u, g) || canManageSae(u, sae);
}

// ── Auto-évaluations ─────────────────────────────────────────
type AssessmentLike = {
  userId: string;
  status: "DRAFT" | "SUBMITTED";
  group?: GroupLike | null;
};

/** Auteur, membres de son groupe (évaluation par les pairs) et équipe pédagogique */
export function canViewAssessment(u: Actor, a: AssessmentLike, sae: SaeLike) {
  if (a.userId === u.id) return true;
  if (canManageSae(u, sae)) return true;
  return a.status === "SUBMITTED" && !!a.group && isGroupMember(u, a.group);
}

/** Seul l'auteur modifie, et uniquement tant que c'est un brouillon */
export function canEditAssessment(u: Actor, a: AssessmentLike) {
  return a.userId === u.id && a.status === "DRAFT";
}

/** Rouvrir une auto-évaluation soumise (enseignant) */
export function canReopenAssessment(u: Actor, sae: SaeLike) {
  return canManageSae(u, sae);
}

export function canCommentAssessment(u: Actor, a: AssessmentLike, sae: SaeLike) {
  return canViewAssessment(u, a, sae);
}

// ── Positionnement enseignant (comparaison auto / enseignant) ─
type FeedbackLike = AssessmentLike & { feedbackPublishedAt?: Date | null };

export function canEvaluateAssessment(u: Actor, sae: SaeLike) {
  return canManageSae(u, sae);
}

/** Niveaux et commentaires enseignant : équipe toujours ; l'étudiant une fois publiés ; jamais les pairs */
export function canSeeTeacherFeedback(u: Actor, a: FeedbackLike, sae: SaeLike) {
  if (canManageSae(u, sae)) return true;
  return a.userId === u.id && !!a.feedbackPublishedAt;
}

// ── Contribution entre pairs ──────────────────────────────────
/** Un membre évalue un AUTRE membre de son groupe */
export function canReviewPeer(u: Actor, g: GroupLike, revieweeId: string) {
  return revieweeId !== u.id && isGroupMember(u, g) && g.members.some((m) => m.userId === revieweeId);
}

/** Le détail (qui a noté qui) n'est visible que par l'équipe pédagogique */
export function canSeePeerReviews(u: Actor, sae: SaeLike) {
  return canManageSae(u, sae);
}

// ── Soutenances ──────────────────────────────────────────────
export function canBookDefense(u: Actor, g: GroupLike, sae: SaeLike) {
  return isGroupMember(u, g) || canManageSae(u, sae);
}

// ── Vitrine ──────────────────────────────────────────────────
/** Le groupe propose, l'équipe pédagogique publie */
export function canRequestShowcase(u: Actor, g: GroupLike) {
  return isGroupMember(u, g);
}

export function canPublishShowcase(u: Actor, sae: SaeLike) {
  return canManageSae(u, sae);
}

// ── Questions sur les pages de cours ─────────────────────────
export function canAskQuestion(u: Actor, c: CourseLike) {
  return canViewCourse(u, c);
}

export function canAnswerQuestion(u: Actor, c: CourseLike) {
  return canViewCourse(u, c);
}

/** Résoudre, mettre en FAQ : éditeurs du cours ; l'auteur peut marquer « résolu » */
export function canModerateQuestion(u: Actor, c: CourseLike) {
  return canEditCourse(u, c);
}

export function canResolveQuestion(u: Actor, q: { authorId: string }, c: CourseLike) {
  return q.authorId === u.id || canEditCourse(u, c);
}

/** L'anonymat vaut vis-à-vis des étudiants ; les éditeurs du cours voient l'auteur (modération) */
export function canSeeAnonymousAuthor(u: Actor, c: CourseLike) {
  return canEditCourse(u, c);
}

// ── Annonces ─────────────────────────────────────────────────
export type AnnouncementTarget =
  | { scope: "GLOBAL" }
  | { scope: "COHORT" }
  | { scope: "COURSE"; course: CourseLike }
  | { scope: "SAE"; sae: SaeLike };

export function canAnnounce(u: Actor, t: AnnouncementTarget) {
  switch (t.scope) {
    case "GLOBAL":
      return isAdmin(u);
    case "COHORT":
      return isStaff(u);
    case "COURSE":
      return canEditCourse(u, t.course);
    case "SAE":
      return canManageSae(u, t.sae);
  }
}

// ── Référentiel, promos, portfolio ───────────────────────────
export function canManageReferentiel(u: Actor) {
  return isAdmin(u);
}

export function canManageCohorts(u: Actor) {
  return isAdmin(u);
}

/** Portfolio privé : l'étudiant et l'équipe enseignante ; public seulement via son lien partagé */
export function canViewPortfolio(u: Actor, ownerId: string) {
  return u.id === ownerId || isStaff(u);
}
