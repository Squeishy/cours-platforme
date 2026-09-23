import { describe, expect, it } from "vitest";
import { buildIcs, escapeText, foldLine, formatUtc } from "./ics";

describe("ICS", () => {
  it("échappe les caractères spéciaux", () => {
    expect(escapeText("a,b;c\\d\ne")).toBe("a\\,b\\;c\\\\d\\ne");
  });

  it("formate les dates en UTC", () => {
    expect(formatUtc(new Date("2026-10-16T16:00:00.000Z"))).toBe("20261016T160000Z");
  });

  it("replie les lignes longues à 75 octets sans couper les accents", () => {
    const folded = foldLine("SUMMARY:" + "é".repeat(60));
    for (const l of folded.split("\r\n")) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
    expect(folded.split("\r\n").slice(1).every((l) => l.startsWith(" "))).toBe(true);
    expect(folded.replace(/\r\n /g, "")).toBe("SUMMARY:" + "é".repeat(60));
  });

  it("produit un calendrier valide avec CRLF", () => {
    const ics = buildIcs(
      "Mes échéances",
      [{ uid: "m1@x", title: "Rendu, final", start: new Date("2026-12-18T17:00:00Z"), url: "https://x.fr/a" }],
      new Date("2026-09-01T00:00:00Z"),
    );
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("SUMMARY:Rendu\\, final\r\n");
    expect(ics).toContain("DTSTART:20261218T170000Z\r\n");
    expect(ics).toContain("DTEND:20261218T173000Z\r\n");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });
});
