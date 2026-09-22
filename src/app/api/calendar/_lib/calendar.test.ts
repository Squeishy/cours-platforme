import { describe, expect, it } from "vitest";
import { buildIcs } from "../../../../lib/ics";
import {
  calendarFeedUrls,
  calendarWindow,
  defenseEvent,
  milestoneEvent,
  parseCalendarToken,
  resolveBaseUrl,
} from "./calendar";

const TOKEN = "a".repeat(43);
const sae = { id: "sae1", code: "SAÉ 2.03", title: "Concevoir un site" };

describe("parseCalendarToken", () => {
  it("accepte un jeton valide, avec ou sans .ics", () => {
    expect(parseCalendarToken(TOKEN)).toBe(TOKEN);
    expect(parseCalendarToken(`${TOKEN}.ics`)).toBe(TOKEN);
  });
  it("refuse les formes invalides", () => {
    expect(parseCalendarToken("court")).toBeNull();
    expect(parseCalendarToken(`${"a".repeat(40)}/../x`)).toBeNull();
    expect(parseCalendarToken("")).toBeNull();
  });
});

describe("URL", () => {
  it("resolveBaseUrl préfère BETTER_AUTH_URL et retire le slash final", () => {
    expect(resolveBaseUrl("https://cours.iut.fr/", "http://localhost:3000")).toBe("https://cours.iut.fr");
    expect(resolveBaseUrl(undefined, "http://localhost:3000")).toBe("http://localhost:3000");
    expect(resolveBaseUrl("pas une url", "http://localhost:3000")).toBe("http://localhost:3000");
    expect(resolveBaseUrl("javascript:alert(1)", "https://x.fr")).toBe("https://x.fr");
  });
  it("calendarFeedUrls donne https et webcal", () => {
    expect(calendarFeedUrls("https://cours.iut.fr", TOKEN)).toEqual({
      https: `https://cours.iut.fr/api/calendar/${TOKEN}`,
      webcal: `webcal://cours.iut.fr/api/calendar/${TOKEN}`,
    });
    expect(calendarFeedUrls("http://localhost:3000", TOKEN).webcal).toBe(`webcal://localhost:3000/api/calendar/${TOKEN}`);
  });
});

describe("événements", () => {
  it("fenêtre : 30 jours avant, 12 mois après", () => {
    const now = new Date("2026-10-13T08:00:00Z");
    const w = calendarWindow(now);
    expect(w.from.toISOString()).toBe("2026-09-13T08:00:00.000Z");
    expect(w.to.toISOString()).toBe("2027-10-13T08:00:00.000Z");
  });

  it("jalon : UID stable, URL absolue, événement ponctuel", () => {
    const due = new Date("2026-10-16T21:59:00Z");
    const e = milestoneEvent({ id: "m1", title: "Rendu maquette", dueAt: due, sae }, "https://cours.iut.fr");
    expect(e.uid).toBe("milestone-m1@cours-sae");
    expect(e.url).toBe("https://cours.iut.fr/saes/sae1/milestones/m1");
    expect(e.title).toBe("SAÉ 2.03 · Rendu maquette");
    expect(e.start).toEqual(due);
    expect(e.end).toEqual(due);
    expect(e.description).toContain("SAÉ 2.03 — Concevoir un site");
  });

  it("soutenance : durée, lieu, groupe seulement pour l'équipe", () => {
    const slot = {
      id: "d1",
      startsAt: new Date("2026-12-10T09:00:00Z"),
      durationMin: 20,
      location: "Salle 104",
      sae: { id: "sae1", code: null, title: "Projet web" },
      group: { name: "Groupe A" },
    };
    const staff = defenseEvent(slot, "https://x.fr", true);
    expect(staff.uid).toBe("defense-d1@cours-sae");
    expect(staff.title).toBe("Soutenance · Projet web · Groupe A");
    expect(staff.end?.toISOString()).toBe("2026-12-10T09:20:00.000Z");
    expect(staff.location).toBe("Salle 104");
    const student = defenseEvent(slot, "https://x.fr", false);
    expect(student.title).toBe("Soutenance · Projet web");
    expect(student.description).not.toContain("Groupe A");
  });

  it("s'intègre dans un calendrier ICS valide", () => {
    const ics = buildIcs(
      "Cours & SAÉ",
      [milestoneEvent({ id: "m1", title: "Rendu, final", dueAt: new Date("2026-12-18T17:00:00Z"), sae }, "https://x.fr")],
      new Date("2026-09-01T00:00:00Z"),
    );
    expect(ics).toContain("UID:milestone-m1@cours-sae\r\n");
    expect(ics).toContain("DTSTART:20261218T170000Z\r\n");
    expect(ics).toContain("DTEND:20261218T170000Z\r\n");
  });
});
