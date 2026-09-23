import { describe, expect, it } from "vitest";
import { mapAffiliationToRole } from "./auth-roles";

describe("mapAffiliationToRole (SUPANN eduPersonAffiliation)", () => {
  it("étudiant", () => {
    expect(mapAffiliationToRole(["member", "student"])).toBe("STUDENT");
    expect(mapAffiliationToRole("Student@univ.fr")).toBe("STUDENT");
  });
  it("enseignant l'emporte sur étudiant (doctorant vacataire)", () => {
    expect(mapAffiliationToRole(["student", "faculty"])).toBe("TEACHER");
    expect(mapAffiliationToRole(["teacher"])).toBe("TEACHER");
  });
  it("aucun accès automatique pour le reste", () => {
    for (const v of [["staff", "employee"], ["alum"], undefined, [], 42, null]) {
      expect(mapAffiliationToRole(v)).toBeNull();
    }
  });
  it("ne donne jamais ADMIN", () => {
    for (const v of ["admin", ["admin", "faculty"], "ADMIN"]) {
      expect(mapAffiliationToRole(v)).not.toBe("ADMIN");
    }
  });
});
