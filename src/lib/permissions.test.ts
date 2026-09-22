import { describe, expect, it } from "vitest";
import {
  canEditAssessment,
  canEditCourse,
  canManageSae,
  canViewAssessment,
  canViewCourse,
  canContributeToGroup,
  canAnnounce,
  canReviewPeer,
  canSeeAnonymousAuthor,
  canSeeTeacherFeedback,
  canViewPortfolio,
  canResolveQuestion,
  type Actor,
} from "./permissions";
import { detectProvider, depositUrlSchema } from "./deposit";

const admin: Actor = { id: "a", role: "ADMIN" };
const owner: Actor = { id: "t1", role: "TEACHER" };
const coTeacher: Actor = { id: "t2", role: "TEACHER" };
const otherTeacher: Actor = { id: "t3", role: "TEACHER" };
const alice: Actor = { id: "s1", role: "STUDENT" };
const bob: Actor = { id: "s2", role: "STUDENT" };
const eve: Actor = { id: "s3", role: "STUDENT" };

const sae = { ownerId: "t1", published: true, teachers: [{ id: "t2" }] };
const group = { members: [{ userId: "s1" }, { userId: "s2" }] };

describe("cours", () => {
  const draft = { ownerId: "t1", published: false, editors: [{ id: "t2" }] };
  it("un brouillon n'est visible que par ses éditeurs", () => {
    expect(canViewCourse(alice, draft)).toBe(false);
    expect(canViewCourse(coTeacher, draft)).toBe(true);
    expect(canViewCourse(admin, draft)).toBe(true);
  });
  it("un étudiant listé comme éditeur ne peut pas éditer", () => {
    expect(canEditCourse(alice, { ...draft, editors: [{ id: "s1" }] })).toBe(false);
  });
  it("un autre enseignant ne peut pas éditer", () => {
    expect(canEditCourse(otherTeacher, draft)).toBe(false);
  });
});

describe("SAÉ", () => {
  it("propriétaire, co-enseignant et admin gèrent la SAÉ", () => {
    expect(canManageSae(owner, sae)).toBe(true);
    expect(canManageSae(coTeacher, sae)).toBe(true);
    expect(canManageSae(admin, sae)).toBe(true);
    expect(canManageSae(otherTeacher, sae)).toBe(false);
    expect(canManageSae(alice, sae)).toBe(false);
  });
  it("seuls les membres (et l'équipe) contribuent à l'espace du groupe", () => {
    expect(canContributeToGroup(alice, group, sae)).toBe(true);
    expect(canContributeToGroup(eve, group, sae)).toBe(false);
    expect(canContributeToGroup(coTeacher, group, sae)).toBe(true);
  });
});

describe("auto-évaluations", () => {
  const draft = { userId: "s1", status: "DRAFT" as const, group };
  const submitted = { ...draft, status: "SUBMITTED" as const };

  it("un brouillon reste privé à son auteur et à l'équipe", () => {
    expect(canViewAssessment(alice, draft, sae)).toBe(true);
    expect(canViewAssessment(bob, draft, sae)).toBe(false);
    expect(canViewAssessment(coTeacher, draft, sae)).toBe(true);
  });
  it("une auto-évaluation soumise est visible par le groupe, pas par les autres étudiants", () => {
    expect(canViewAssessment(bob, submitted, sae)).toBe(true);
    expect(canViewAssessment(eve, submitted, sae)).toBe(false);
    expect(canViewAssessment(otherTeacher, submitted, sae)).toBe(false);
  });
  it("seul l'auteur modifie, et seulement en brouillon", () => {
    expect(canEditAssessment(alice, draft)).toBe(true);
    expect(canEditAssessment(alice, submitted)).toBe(false);
    expect(canEditAssessment(owner, draft)).toBe(false);
  });
});

describe("URL de dépôt", () => {
  it("reconnaît les fournisseurs courants", () => {
    expect(detectProvider("https://github.com/org/repo")).toBe("GITHUB");
    expect(detectProvider("https://gitlab.univ-exemple.fr/g/p")).toBe("GITLAB");
    expect(detectProvider("https://drive.google.com/drive/folders/x")).toBe("GOOGLE_DRIVE");
    expect(detectProvider("https://www.figma.com/file/x")).toBe("FIGMA");
    expect(detectProvider("https://notgithub.com/x")).toBe("OTHER");
  });
  it("refuse les schémas dangereux", () => {
    expect(depositUrlSchema.safeParse("javascript:alert(1)").success).toBe(false);
    expect(depositUrlSchema.safeParse("ftp://x.fr/a").success).toBe(false);
    expect(depositUrlSchema.safeParse("https://github.com/a/b").success).toBe(true);
  });
});

describe("v2 — positionnement enseignant", () => {
  const base = { userId: "s1", status: "SUBMITTED" as const, group: { members: [{ userId: "s1" }, { userId: "s2" }] } };
  it("l'étudiant ne voit le retour qu'une fois publié ; jamais les pairs", () => {
    expect(canSeeTeacherFeedback(alice, { ...base, feedbackPublishedAt: null }, sae)).toBe(false);
    expect(canSeeTeacherFeedback(alice, { ...base, feedbackPublishedAt: new Date() }, sae)).toBe(true);
    expect(canSeeTeacherFeedback(bob, { ...base, feedbackPublishedAt: new Date() }, sae)).toBe(false);
    expect(canSeeTeacherFeedback(coTeacher, { ...base, feedbackPublishedAt: null }, sae)).toBe(true);
  });
});

describe("v2 — contribution entre pairs", () => {
  it("on évalue un autre membre de son groupe, pas soi-même ni un externe", () => {
    expect(canReviewPeer(alice, group, "s2")).toBe(true);
    expect(canReviewPeer(alice, group, "s1")).toBe(false);
    expect(canReviewPeer(alice, group, "s3")).toBe(false);
    expect(canReviewPeer(eve, group, "s1")).toBe(false);
  });
});

describe("v2 — annonces", () => {
  it("globale : admin ; promo : équipe ; SAÉ : équipe de la SAÉ", () => {
    expect(canAnnounce(admin, { scope: "GLOBAL" })).toBe(true);
    expect(canAnnounce(owner, { scope: "GLOBAL" })).toBe(false);
    expect(canAnnounce(otherTeacher, { scope: "COHORT" })).toBe(true);
    expect(canAnnounce(alice, { scope: "COHORT" })).toBe(false);
    expect(canAnnounce(coTeacher, { scope: "SAE", sae })).toBe(true);
    expect(canAnnounce(otherTeacher, { scope: "SAE", sae })).toBe(false);
  });
});

describe("v2 — questions et portfolio", () => {
  const course = { ownerId: "t1", published: true, editors: [] };
  it("seuls les éditeurs lèvent l'anonymat ; l'auteur peut résoudre sa question", () => {
    expect(canSeeAnonymousAuthor(owner, course)).toBe(true);
    expect(canSeeAnonymousAuthor(bob, course)).toBe(false);
    expect(canResolveQuestion(bob, { authorId: "s2" }, course)).toBe(true);
    expect(canResolveQuestion(alice, { authorId: "s2" }, course)).toBe(false);
  });
  it("portfolio : soi-même et l'équipe enseignante", () => {
    expect(canViewPortfolio(alice, "s1")).toBe(true);
    expect(canViewPortfolio(bob, "s1")).toBe(false);
    expect(canViewPortfolio(otherTeacher, "s1")).toBe(true);
  });
});
