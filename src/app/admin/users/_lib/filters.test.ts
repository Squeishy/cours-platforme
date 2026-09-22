import { describe, expect, it } from "vitest";
import { pageCount, parseUserFilters, usersHref } from "./filters";

describe("parseUserFilters", () => {
  it("valeurs par défaut", () => {
    expect(parseUserFilters({})).toEqual({ q: "", role: null, cohort: null, page: 1 });
  });
  it("lit les filtres valides", () => {
    expect(parseUserFilters({ q: "  dupont ", role: "TEACHER", cohort: "ckabc123", page: "3" })).toEqual({
      q: "dupont",
      role: "TEACHER",
      cohort: "ckabc123",
      page: 3,
    });
    expect(parseUserFilters({ cohort: "none" }).cohort).toBe("none");
  });
  it("ignore les valeurs inconnues ou dangereuses", () => {
    const f = parseUserFilters({ role: "ROOT", cohort: "x' OR 1=1", page: "-2", q: "a".repeat(300) });
    expect(f.role).toBeNull();
    expect(f.cohort).toBeNull();
    expect(f.page).toBe(1);
    expect(f.q).toHaveLength(100);
  });
  it("prend la première valeur d'un paramètre répété", () => {
    expect(parseUserFilters({ role: ["STUDENT", "ADMIN"] }).role).toBe("STUDENT");
  });
});

describe("usersHref & pageCount", () => {
  it("construit l'URL sans paramètres vides", () => {
    expect(usersHref({})).toBe("/admin/users");
    expect(usersHref({ q: "a b", role: "STUDENT", cohort: null, page: 1 })).toBe("/admin/users?q=a+b&role=STUDENT");
    expect(usersHref({ cohort: "c1", page: 2 })).toBe("/admin/users?cohort=c1&page=2");
  });
  it("pageCount", () => {
    expect(pageCount(0)).toBe(1);
    expect(pageCount(50)).toBe(1);
    expect(pageCount(51)).toBe(2);
  });
});
