import { describe, expect, it } from "vitest";
import { computeCompetenceProfile, isSignificantGap, radarPoints } from "./competences";

const comps = [
  { code: "C1", name: "Comprendre" },
  { code: "C4", name: "Développer" },
];

describe("profil de compétences", () => {
  it("garde le dernier niveau par AC puis moyenne par compétence", () => {
    const p = computeCompetenceProfile(comps, [
      { competenceCode: "C4", learningCode: "AC14.02", selfLevel: 1, teacherLevel: null, at: new Date("2026-10-01") },
      { competenceCode: "C4", learningCode: "AC14.02", selfLevel: 3, teacherLevel: 2, at: new Date("2026-12-01") },
      { competenceCode: "C4", learningCode: "AC14.04", selfLevel: 4, teacherLevel: null, at: new Date("2026-11-01") },
    ]);
    const c4 = p.find((c) => c.code === "C4")!;
    expect(c4.self).toBe(3.5);
    expect(c4.teacher).toBe(2);
    expect(c4.learnings).toBe(2);
  });

  it("une compétence sans observation reste vide (null), pas zéro", () => {
    const p = computeCompetenceProfile(comps, []);
    expect(p[0]).toMatchObject({ code: "C1", self: null, teacher: null, learnings: 0 });
  });

  it("un niveau enseignant plus ancien n'écrase pas un plus récent", () => {
    const p = computeCompetenceProfile(comps, [
      { competenceCode: "C1", learningCode: "AC11.01", selfLevel: null, teacherLevel: 4, at: new Date("2026-12-01") },
      { competenceCode: "C1", learningCode: "AC11.01", selfLevel: null, teacherLevel: 1, at: new Date("2026-10-01") },
    ]);
    expect(p[0].teacher).toBe(4);
  });
});

describe("écart significatif", () => {
  it("≥ 2 niveaux", () => {
    expect(isSignificantGap(4, 2)).toBe(true);
    expect(isSignificantGap(3, 2)).toBe(false);
    expect(isSignificantGap(null, 1)).toBe(false);
  });
});

describe("radar", () => {
  it("place le premier axe en haut et borne les valeurs", () => {
    const [top, right] = radarPoints([4, 8, null, 0], 4, 100, 100, 50);
    expect(top).toEqual({ x: 100, y: 50 });
    expect(right).toEqual({ x: 150, y: 100 });
  });
});
