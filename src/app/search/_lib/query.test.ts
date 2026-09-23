import { describe, expect, it } from "vitest";
import { likePattern, makeSnippet, matchRanges, parseTerms, planSearch, stripMarkdown } from "./query";

describe("parseTerms", () => {
  it("retire les opérateurs booléens et découpe sur la ponctuation", () => {
    expect(parseTerms('+css -grid <flex> (box) ~model* "html" @media')).toEqual([
      "css",
      "grid",
      "flex",
      "box",
      "model",
      "html",
      "media",
    ]);
  });

  it("dédoublonne sans tenir compte de la casse et borne le nombre de mots", () => {
    expect(parseTerms("CSS css Css")).toEqual(["CSS"]);
    expect(parseTerms("a b c d e f g h i j k")).toHaveLength(8);
  });

  it("sépare l'élision française", () => {
    expect(parseTerms("l'accessibilité")).toEqual(["l", "accessibilité"]);
  });
});

describe("planSearch", () => {
  it("vide si aucun mot", () => {
    expect(planSearch("  +-*  ")).toEqual({ kind: "empty" });
  });

  it("plein texte avec préfixe * sur les mots de 3 caractères et plus", () => {
    const plan = planSearch("grille de mise en page");
    expect(plan).toMatchObject({ kind: "fulltext", boolean: "grille* mise* page*", anchor: "grille" });
  });

  it("repli LIKE si tous les mots sont courts", () => {
    expect(planSearch("UX C1")).toEqual({ kind: "like", terms: ["UX", "C1"], anchor: "UX" });
  });
});

describe("likePattern", () => {
  it("échappe % _ et le caractère d'échappement", () => {
    expect(likePattern("50%_a!")).toBe("%50!%!_a!!%");
  });
});

describe("stripMarkdown", () => {
  it("garde le texte lisible", () => {
    expect(stripMarkdown("# Titre\n\n- **gras** et [lien](https://x.y) `code`\n> citation")).toBe(
      "Titre gras et lien code citation",
    );
  });

  it("ne laisse pas passer de balises", () => {
    expect(stripMarkdown('<script>alert("x")</script>texte')).toBe('alert("x") texte');
  });
});

describe("matchRanges / makeSnippet", () => {
  it("trouve les occurrences sans tenir compte des accents ni de la casse", () => {
    const text = "Les Élèves et les eleves";
    expect(matchRanges(text, ["élèves"]).map(([a, b]) => text.slice(a, b))).toEqual(["Élèves", "eleves"]);
  });

  it("découpe un passage autour de la première occurrence avec les correspondances marquées", () => {
    const md = `${"intro ".repeat(80)}La **grille** CSS permet une mise en page. ${"suite ".repeat(80)}`;
    const parts = makeSnippet(md, ["grille"], 120);
    expect(parts[0]).toEqual({ text: "… ", match: false });
    expect(parts.some((p) => p.match && p.text === "grille")).toBe(true);
    expect(parts[parts.length - 1]).toEqual({ text: " …", match: false });
    expect(parts.map((p) => p.text).join("").length).toBeLessThanOrEqual(130);
  });

  it("renvoie le début du texte si rien ne correspond", () => {
    expect(makeSnippet("Bonjour à tous", ["zzz"])).toEqual([{ text: "Bonjour à tous", match: false }]);
  });
});
