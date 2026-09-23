import { describe, expect, it } from "vitest";
import { CSV_BOM, csvCell, formatAverage, toCsv } from "./csv";
import { buildSlotStarts, isDefenseLocked } from "./defense-slots";
import { nextGroupNames, parseEmailList, splitIntoGroups } from "./group-tools";
import { criterionCode, learningHint, levelForSemester, parseAcCode, safeColor } from "./criteria";

describe("csv", () => {
  it("neutralise les formules", () => {
    expect(csvCell("=SUM(A1:A2)")).toBe("'=SUM(A1:A2)");
    expect(csvCell("+33 6")).toBe("'+33 6");
    expect(csvCell("-1")).toBe("'-1");
    expect(csvCell("@cmd")).toBe("'@cmd");
    expect(csvCell("\tx")).toBe("'\tx");
  });
  it("met entre guillemets les cellules avec ; \" ou saut de ligne", () => {
    expect(csvCell('a;b')).toBe('"a;b"');
    expect(csvCell('dit "oui"')).toBe('"dit ""oui"""');
    expect(csvCell("l1\nl2")).toBe('"l1\nl2"');
    expect(csvCell("=a;b")).toBe(`"'=a;b"`);
  });
  it("vide pour null/undefined", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });
  it("BOM, séparateur ; et CRLF", () => {
    expect(toCsv([["a", "b"], ["c", null]])).toBe(`${CSV_BOM}a;b\r\nc;\r\n`);
  });
  it("moyenne à la française", () => {
    expect(formatAverage([])).toBe("");
    expect(formatAverage([2, 3])).toBe("2,5");
    expect(formatAverage([1, 2, 2])).toBe("1,67");
    expect(formatAverage([4])).toBe("4");
  });
});

describe("créneaux de soutenance", () => {
  it("génère des créneaux consécutifs en heure de Paris", () => {
    const r = buildSlotStarts({ date: "2026-06-15", startTime: "09:00", count: 3, durationMin: 20, breakMin: 10 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // Été : Paris = UTC+2
    expect(r.starts.map((d) => d.toISOString())).toEqual([
      "2026-06-15T07:00:00.000Z",
      "2026-06-15T07:30:00.000Z",
      "2026-06-15T08:00:00.000Z",
    ]);
  });
  it("heure d'hiver", () => {
    const r = buildSlotStarts({ date: "2026-01-15", startTime: "14:15", count: 1, durationMin: 30, breakMin: 0 });
    expect(r.ok && r.starts[0].toISOString()).toBe("2026-01-15T13:15:00.000Z");
  });
  it("refuse de déborder après minuit", () => {
    const r = buildSlotStarts({ date: "2026-01-15", startTime: "23:00", count: 3, durationMin: 30, breakMin: 0 });
    expect(r.ok).toBe(false);
  });
  it("refuse une heure invalide", () => {
    expect(buildSlotStarts({ date: "2026-01-15", startTime: "25:00", count: 1, durationMin: 30, breakMin: 0 }).ok).toBe(false);
  });
  it("verrouille à moins de 24 h", () => {
    const now = new Date("2026-06-15T08:00:00Z");
    expect(isDefenseLocked(new Date("2026-06-16T07:59:00Z"), now)).toBe(true);
    expect(isDefenseLocked(new Date("2026-06-16T08:00:00Z"), now)).toBe(false);
    expect(isDefenseLocked(new Date("2026-06-14T08:00:00Z"), now)).toBe(true);
  });
});

describe("formation des groupes", () => {
  it("lit une liste collée (lignes, virgules, format messagerie)", () => {
    const r = parseEmailList("lea@demo.fr\nHugo Moreau <HUGO@demo.fr>; ines@demo.fr, lea@demo.fr\n n'importe quoi \n");
    expect(r.emails).toEqual(["lea@demo.fr", "hugo@demo.fr", "ines@demo.fr"]);
    expect(r.invalid).toEqual(["n'importe quoi"]);
  });
  it("plusieurs adresses sur une ligne ; saisie volumineuse traitée en temps linéaire", () => {
    expect(parseEmailList("a@x.fr b@y.fr").emails).toEqual(["a@x.fr", "b@y.fr"]);
    const start = Date.now();
    const r = parseEmailList(`${"a".repeat(30_000)}@`);
    expect(r.emails).toEqual([]);
    expect(r.invalid).toHaveLength(1);
    expect(Date.now() - start).toBeLessThan(200);
  });
  it("répartit en groupes équilibrés d'au plus N", () => {
    const ids = Array.from({ length: 25 }, (_, i) => i);
    const groups = splitIntoGroups(ids, 4, () => 0.5);
    expect(groups.map((g) => g.length)).toEqual([4, 4, 4, 4, 3, 3, 3]);
    expect(groups.flat().sort((a, b) => a - b)).toEqual(ids);
  });
  it("aucun groupe sans candidat", () => {
    expect(splitIntoGroups([], 3)).toEqual([]);
  });
  it("noms libres « Groupe n »", () => {
    expect(nextGroupNames(["groupe 1", "Groupe 3", "Autre"], 3)).toEqual(["Groupe 2", "Groupe 4", "Groupe 5"]);
  });
});

describe("critères et référentiel", () => {
  it("le code de l'AC rattaché prime sur le code libre", () => {
    expect(criterionCode({ label: "x", acCode: "AC11.01", learning: { code: "AC14.02", label: "y" } })).toBe("AC14.02");
    expect(criterionCode({ label: "x", acCode: "AC11.01" })).toBe("AC11.01");
    expect(criterionCode({ label: "x", acCode: null })).toBeNull();
  });
  it("libellé officiel seulement s'il diffère", () => {
    expect(learningHint({ label: "Même", acCode: null, learning: { code: "AC", label: "Même" } })).toBeNull();
    expect(learningHint({ label: "Adapté", acCode: null, learning: { code: "AC", label: "Officiel" } })).toBe("Officiel");
  });
  it("déduit niveau et compétence du code AC", () => {
    expect(parseAcCode("AC24.03")).toEqual({ level: 2, competenceCode: "C4" });
    expect(parseAcCode("AC41.01")).toBeNull();
    expect(parseAcCode("AC16.01")).toBeNull();
    expect(parseAcCode("AC11.1")).toBeNull();
  });
  it("niveau attendu selon le semestre", () => {
    expect(levelForSemester(1)).toBe(1);
    expect(levelForSemester(4)).toBe(2);
    expect(levelForSemester(6)).toBe(3);
    expect(levelForSemester(null)).toBeNull();
  });
  it("couleur hex uniquement", () => {
    expect(safeColor("#2f6f9f")).toBe("#2f6f9f");
    expect(safeColor("red;background:url(x)")).toBeUndefined();
  });
});

describe("addParisDays", () => {
  it("conserve l'heure murale de Paris à travers un changement d'heure", async () => {
    const { addParisDays } = await import("./dates");
    // 20 mars 2026 18:00 Paris (UTC+1) + 14 j → 3 avril 2026 18:00 Paris (UTC+2)
    expect(addParisDays(new Date("2026-03-20T17:00:00Z"), 14).toISOString()).toBe("2026-04-03T16:00:00.000Z");
    // + 52 semaines
    expect(addParisDays(new Date("2026-10-01T16:00:00Z"), 364).toISOString()).toBe("2027-09-30T16:00:00.000Z");
  });
});
