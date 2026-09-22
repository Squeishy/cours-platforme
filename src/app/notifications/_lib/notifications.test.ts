import { describe, expect, it } from "vitest";
import { notificationTypeLabel, pageCount, pageSlices, parsePage, safeInternalPath } from "./notifications";

describe("safeInternalPath", () => {
  it("accepte les chemins internes", () => {
    expect(safeInternalPath("/")).toBe("/");
    expect(safeInternalPath("/saes/abc/milestones/def?x=1#c")).toBe("/saes/abc/milestones/def?x=1#c");
  });

  it("refuse les URL externes et les chemins protocol-relative", () => {
    expect(safeInternalPath("https://evil.example")).toBeNull();
    expect(safeInternalPath("//evil.example")).toBeNull();
    expect(safeInternalPath("/\\evil.example")).toBeNull();
    expect(safeInternalPath("javascript:alert(1)")).toBeNull();
    expect(safeInternalPath("saes/abc")).toBeNull();
  });

  it("refuse les caractères de contrôle, espaces et valeurs vides", () => {
    expect(safeInternalPath("/\tevil")).toBeNull();
    expect(safeInternalPath("/ok\nLocation: x")).toBeNull();
    expect(safeInternalPath("/a b")).toBeNull();
    expect(safeInternalPath("")).toBeNull();
    expect(safeInternalPath(null)).toBeNull();
    expect(safeInternalPath(undefined)).toBeNull();
    expect(safeInternalPath("/" + "a".repeat(2048))).toBeNull();
  });
});

describe("pageSlices", () => {
  it("sans non lues : tout vient des lues", () => {
    expect(pageSlices(1, 30, 0)).toEqual({ unread: { skip: 0, take: 0 }, read: { skip: 0, take: 30 } });
    expect(pageSlices(2, 30, 0)).toEqual({ unread: { skip: 0, take: 0 }, read: { skip: 30, take: 30 } });
  });

  it("non lues d'abord, puis bascule sur les lues", () => {
    expect(pageSlices(1, 30, 45)).toEqual({ unread: { skip: 0, take: 30 }, read: { skip: 0, take: 0 } });
    expect(pageSlices(2, 30, 45)).toEqual({ unread: { skip: 30, take: 15 }, read: { skip: 0, take: 15 } });
    expect(pageSlices(3, 30, 45)).toEqual({ unread: { skip: 45, take: 0 }, read: { skip: 15, take: 30 } });
  });

  it("chaque page contient exactement pageSize éléments demandés", () => {
    for (let p = 1; p <= 5; p++) {
      const s = pageSlices(p, 30, 47);
      expect(s.unread.take + s.read.take).toBe(30);
    }
  });
});

describe("pagination & libellés", () => {
  it("parsePage", () => {
    expect(parsePage(undefined)).toBe(1);
    expect(parsePage("0")).toBe(1);
    expect(parsePage("-3")).toBe(1);
    expect(parsePage("abc")).toBe(1);
    expect(parsePage("4")).toBe(4);
    expect(parsePage(["2", "5"])).toBe(2);
    expect(parsePage("999999")).toBe(1000);
  });

  it("pageCount vaut au moins 1", () => {
    expect(pageCount(0, 30)).toBe(1);
    expect(pageCount(30, 30)).toBe(1);
    expect(pageCount(31, 30)).toBe(2);
  });

  it("libellé des types inconnus", () => {
    expect(notificationTypeLabel("feedback")).toBe("Retour enseignant");
    expect(notificationTypeLabel("zzz")).toBe("Notification");
  });
});
