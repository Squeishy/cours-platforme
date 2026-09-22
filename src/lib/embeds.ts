// Intégrations (iframe) autorisées dans l'éditeur et la vitrine.
// Liste blanche stricte : on ne génère une URL d'iframe que pour ces fournisseurs.

export type EmbedProvider =
  | "youtube"
  | "vimeo"
  | "figma"
  | "codepen"
  | "soundcloud"
  | "sketchfab"
  | "peertube"
  | "genially"
  | "canva";

export type Embed = { provider: EmbedProvider; src: string; title: string; aspect: "video" | "square" | "tall" };

export const EMBED_LABELS: Record<EmbedProvider, string> = {
  youtube: "YouTube",
  vimeo: "Vimeo",
  figma: "Figma",
  codepen: "CodePen",
  soundcloud: "SoundCloud",
  sketchfab: "Sketchfab",
  peertube: "PeerTube / Esup-Pod",
  genially: "Genially",
  canva: "Canva",
};

/** Hôtes autorisés dans la directive CSP frame-src */
export const EMBED_FRAME_HOSTS = [
  "https://www.youtube-nocookie.com",
  "https://player.vimeo.com",
  "https://embed.figma.com",
  "https://codepen.io",
  "https://w.soundcloud.com",
  "https://sketchfab.com",
  "https://view.genial.ly",
  "https://www.canva.com",
];

function parse(raw: string) {
  try {
    const u = new URL(raw.trim());
    return u.protocol === "https:" ? u : null;
  } catch {
    return null;
  }
}

/**
 * Convertit une URL « de partage » en URL d'intégration sûre, ou null si non reconnue.
 * `peertubeHosts` : instances PeerTube / Esup-Pod autorisées (ex. "pod.univ-exemple.fr").
 */
export function toEmbed(raw: string, peertubeHosts: string[] = []): Embed | null {
  const u = parse(raw);
  if (!u) return null;
  const host = u.hostname.replace(/^www\./, "");
  const path = u.pathname;

  if (host === "youtube.com" || host === "m.youtube.com" || host === "youtu.be") {
    const id =
      host === "youtu.be"
        ? path.slice(1).split("/")[0]
        : path.startsWith("/embed/") || path.startsWith("/shorts/")
          ? path.split("/")[2]
          : u.searchParams.get("v");
    if (!id || !/^[\w-]{6,20}$/.test(id)) return null;
    return { provider: "youtube", src: `https://www.youtube-nocookie.com/embed/${id}`, title: "Vidéo YouTube", aspect: "video" };
  }

  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = path.match(/(\d{6,12})/)?.[1];
    if (!id) return null;
    return { provider: "vimeo", src: `https://player.vimeo.com/video/${id}`, title: "Vidéo Vimeo", aspect: "video" };
  }

  if (host === "figma.com") {
    if (!/^\/(file|design|proto|board|slides)\//.test(path)) return null;
    const src = `https://embed.figma.com${path}?embed-host=cours-sae`;
    return { provider: "figma", src, title: "Maquette Figma", aspect: "tall" };
  }

  if (host === "codepen.io") {
    const m = path.match(/^\/([\w-]+)\/(?:pen|full|details|embed)\/([\w]+)/);
    if (!m) return null;
    return {
      provider: "codepen",
      src: `https://codepen.io/${m[1]}/embed/${m[2]}?default-tab=result`,
      title: "Démo CodePen",
      aspect: "square",
    };
  }

  if (host === "soundcloud.com") {
    const src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(u.origin + path)}`;
    return { provider: "soundcloud", src, title: "Audio SoundCloud", aspect: "square" };
  }

  if (host === "sketchfab.com") {
    const id = path.match(/([0-9a-f]{32})/)?.[1];
    if (!id) return null;
    return { provider: "sketchfab", src: `https://sketchfab.com/models/${id}/embed`, title: "Modèle 3D Sketchfab", aspect: "video" };
  }

  if (host === "view.genial.ly" || host === "app.genial.ly") {
    const id = path.match(/([0-9a-f]{24})/)?.[1];
    if (!id) return null;
    return { provider: "genially", src: `https://view.genial.ly/${id}`, title: "Genially", aspect: "video" };
  }

  if (host === "canva.com" && /^\/design\/[\w-]+\/[\w-]+\/view/.test(path)) {
    return { provider: "canva", src: `https://www.canva.com${path}?embed`, title: "Canva", aspect: "video" };
  }

  if (peertubeHosts.includes(u.hostname)) {
    const id = path.match(/\/(?:w|videos\/watch|video)\/([\w-]{6,})/)?.[1];
    if (!id) return null;
    return { provider: "peertube", src: `https://${u.hostname}/videos/embed/${id}`, title: "Vidéo", aspect: "video" };
  }

  return null;
}
