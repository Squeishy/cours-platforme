import { describe, expect, it } from "vitest";
import { cohortSchema, currentAcademicYear, isValidAcademicYear, parcoursLabel, parseEmailList } from "./cohorts";

describe("isValidAcademicYear", () => {
  it("deux années consécutives", () => {
    expect(isValidAcademicYear("2026-2027")).toBe(true);
    expect(isValidAcademicYear("2026-2028")).toBe(false);
    expect(isValidAcademicYear("2026/2027")).toBe(false);
    expect(isValidAcademicYear("26-27")).toBe(false);
    expect(isValidAcademicYear("1999-2000")).toBe(false);
  });
});

describe("currentAcademicYear", () => {
  it("bascule au 1er août (heure de Paris)", () => {
    expect(currentAcademicYear(new Date("2026-09-23T10:00:00Z"))).toBe("2026-2027");
    expect(currentAcademicYear(new Date("2027-03-01T10:00:00Z"))).toBe("2026-2027");
    expect(currentAcademicYear(new Date("2027-07-31T22:30:00Z"))).toBe("2027-2028"); // 1er août 0h30 à Paris
    expect(currentAcademicYear(new Date("2027-07-31T21:30:00Z"))).toBe("2026-2027"); // 31 juillet 23h30 à Paris
  });
});

describe("cohortSchema", () => {
  it("valide et normalise", () => {
    const r = cohortSchema.safeParse({ name: "  MMI 1 — TD A ", year: "1", parcours: "", academicYear: "2026-2027" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toEqual({ name: "MMI 1 — TD A", year: 1, parcours: null, academicYear: "2026-2027" });
  });
  it("accepte les parcours connus uniquement", () => {
    expect(cohortSchema.safeParse({ name: "MMI 2", year: 2, parcours: "DWeb-DI", academicYear: "2026-2027" }).success).toBe(true);
    expect(cohortSchema.safeParse({ name: "MMI 2", year: 2, parcours: "Autre", academicYear: "2026-2027" }).success).toBe(false);
  });
  it("refuse les années de BUT hors 1..3 et les noms trop courts", () => {
    expect(cohortSchema.safeParse({ name: "MMI", year: 4, parcours: "", academicYear: "2026-2027" }).success).toBe(false);
    expect(cohortSchema.safeParse({ name: "M", year: 1, parcours: "", academicYear: "2026-2027" }).success).toBe(false);
  });
});

describe("parseEmailList", () => {
  it("découpe, normalise, dédoublonne", () => {
    const r = parseEmailList("Alice@IUT.fr, bob@iut.fr;\ncarol@iut.fr  alice@iut.fr\n\n");
    expect(r.emails).toEqual(["alice@iut.fr", "bob@iut.fr", "carol@iut.fr"]);
    expect(r.invalid).toEqual([]);
  });
  it("tolère « Nom <adresse> » et signale les adresses invalides", () => {
    const r = parseEmailList("Jean Dupont <jean.dupont@etu.iut.fr>\npas@valide@x\nfoo@");
    expect(r.emails).toEqual(["jean.dupont@etu.iut.fr"]);
    expect(r.invalid).toEqual(["pas@valide@x", "foo@"]);
  });
  it("borne le nombre d'adresses", () => {
    const text = Array.from({ length: 5 }, (_, i) => `u${i}@iut.fr`).join("\n");
    const r = parseEmailList(text, 3);
    expect(r.emails).toHaveLength(3);
    expect(r.truncated).toBe(true);
  });
  it("libellé de parcours", () => {
    expect(parcoursLabel(null)).toBe("Tronc commun");
    expect(parcoursLabel("Crea")).toBe("Création numérique");
  });
});
