import { describe, expect, it } from "vitest";
import { toEmbed } from "./embeds";

describe("toEmbed", () => {
  it("YouTube (formats courants) → youtube-nocookie", () => {
    for (const url of [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://youtu.be/dQw4w9WgXcQ",
      "https://www.youtube.com/shorts/dQw4w9WgXcQ",
    ]) {
      expect(toEmbed(url)?.src).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    }
  });

  it("Vimeo, Figma, CodePen", () => {
    expect(toEmbed("https://vimeo.com/76979871")?.src).toBe("https://player.vimeo.com/video/76979871");
    expect(toEmbed("https://www.figma.com/design/AbC123/Maquette?node-id=1-2")?.src).toMatch(
      /^https:\/\/embed\.figma\.com\/design\/AbC123\/Maquette\?embed-host=/,
    );
    expect(toEmbed("https://codepen.io/alice/pen/xyzAB")?.src).toBe(
      "https://codepen.io/alice/embed/xyzAB?default-tab=result",
    );
  });

  it("refuse http, javascript: et hôtes inconnus", () => {
    expect(toEmbed("http://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(toEmbed("javascript:alert(1)")).toBeNull();
    expect(toEmbed("https://evil.example/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(toEmbed("https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ")).toBeNull();
  });

  it("refuse un identifiant YouTube injecté", () => {
    expect(toEmbed('https://www.youtube.com/watch?v="><script>')).toBeNull();
  });

  it("PeerTube / Esup-Pod uniquement sur les instances configurées", () => {
    const url = "https://pod.univ-exemple.fr/w/abc123def456";
    expect(toEmbed(url)).toBeNull();
    expect(toEmbed(url, ["pod.univ-exemple.fr"])?.src).toBe("https://pod.univ-exemple.fr/videos/embed/abc123def456");
  });
});
