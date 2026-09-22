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
