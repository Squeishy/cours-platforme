import { describe, expect, it } from "vitest";
import {
  canEditAssessment,
  canEditCourse,
  canManageSae,
  canViewAssessment,
  canViewCourse,
  canContributeToGroup,
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
