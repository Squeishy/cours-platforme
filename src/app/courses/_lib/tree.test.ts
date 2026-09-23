import { describe, expect, it } from "vitest";
import { buildPageTree, pagesByDepth, readingOrder } from "./tree";

const pages = [
  { id: "b", title: "B", parentId: null, position: 1 },
  { id: "a", title: "A", parentId: null, position: 0 },
  { id: "a2", title: "A2", parentId: "a", position: 1 },
  { id: "a1", title: "A1", parentId: "a", position: 0 },
  { id: "a1x", title: "A1x", parentId: "a1", position: 0 },
  { id: "orphan", title: "Orphelin", parentId: "missing", position: 2 },
];

describe("pagesByDepth", () => {
  it("place toujours les parents dans un niveau antérieur à leurs enfants", () => {
    const levels = pagesByDepth(pages);
    const depth = new Map(levels.flatMap((level, d) => level.map((p) => [p.id, d] as const)));
    for (const p of pages) {
      if (p.parentId && depth.has(p.parentId)) expect(depth.get(p.parentId)).toBeLessThan(depth.get(p.id) ?? -1);
    }
    expect(levels.flat()).toHaveLength(pages.length);
  });

  it("traite une page au parent introuvable comme une racine", () => {
    expect(pagesByDepth(pages)[0].map((p) => p.id)).toContain("orphan");
  });
});

describe("readingOrder", () => {
  it("parcourt le sommaire en profondeur, dans l'ordre des positions", () => {
    expect(readingOrder(buildPageTree(pages)).map((p) => p.id)).toEqual(["a", "a1", "a1x", "a2", "b", "orphan"]);
  });
});
