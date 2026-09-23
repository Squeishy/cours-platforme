import { describe, expect, it } from "vitest";
import { MMI_COMPETENCES, MMI_CRITICAL_LEARNINGS, MMI_SAE_TEMPLATES } from "./referentiel-mmi";

describe("référentiel BUT MMI (PN 2022)", () => {
  it("5 compétences, 5 composantes essentielles chacune", () => {
    expect(MMI_COMPETENCES.map((c) => c.code)).toEqual(["C1", "C2", "C3", "C4", "C5"]);
    for (const c of MMI_COMPETENCES) expect(c.components).toHaveLength(5);
  });

  it("75 AC : 29 niveau 1, 28 niveau 2, 18 niveau 3 ; Comprendre n'a pas de niveau 3", () => {
    expect(MMI_CRITICAL_LEARNINGS).toHaveLength(75);
    const byLevel = (l: number) => MMI_CRITICAL_LEARNINGS.filter((a) => a.level === l).length;
    expect([byLevel(1), byLevel(2), byLevel(3)]).toEqual([29, 28, 18]);
    expect(MMI_CRITICAL_LEARNINGS.some((a) => a.competence === "C1" && a.level === 3)).toBe(false);
  });

  it("codes uniques et cohérents : AC{niveau}{compétence}.{nn}", () => {
    const codes = new Set(MMI_CRITICAL_LEARNINGS.map((a) => a.code));
    expect(codes.size).toBe(75);
    for (const a of MMI_CRITICAL_LEARNINGS) {
      const m = a.code.match(/^AC([123])([1-5])\.\d{2}$/);
      expect(m, a.code).not.toBeNull();
      expect(Number(m![1])).toBe(a.level);
      expect(`C${m![2]}`).toBe(a.competence);
      expect(a.label.length).toBeGreaterThan(10);
    }
  });

  it("niveau 3 rattaché au bon parcours", () => {
    const parcours = (code: string) => MMI_CRITICAL_LEARNINGS.find((a) => a.code === code)?.parcours;
    expect(parcours("AC34.01")).toBe("DWeb-DI");
    expect(parcours("AC33.02")).toBe("Crea");
    expect(parcours("AC32.01")).toBe("Strat-UX");
    expect(parcours("AC35.01")).toBeNull();
  });

  it("les modèles de SAÉ ne citent que des AC existants", () => {
    const codes = new Set(MMI_CRITICAL_LEARNINGS.map((a) => a.code));
    for (const t of MMI_SAE_TEMPLATES) for (const ac of t.acs) expect(codes.has(ac), `${t.code} ${ac}`).toBe(true);
  });
});
