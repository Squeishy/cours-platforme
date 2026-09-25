import type { NextConfig } from "next";
import { EMBED_FRAME_HOSTS } from "./src/lib/embeds";

const isDev = process.env.NODE_ENV !== "production";
const peertube = (process.env.PEERTUBE_HOSTS ?? "").split(",").map((h) => h.trim()).filter(Boolean).map((h) => `https://${h}`);

// CSP : scripts/styles inline requis par Next et BlockNote ; iframes limitées à la liste blanche des intégrations
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  `frame-src ${[...EMBED_FRAME_HOSTS, ...peertube].join(" ")}`,
  "connect-src 'self'" + (isDev ? " ws:" : ""),
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Content-Security-Policy", value: csp },
];

const nextConfig: NextConfig = {
  // Image Docker minimale (voir Dockerfile)
  output: "standalone",
  poweredByHeader: false,
  // Pas de next/image optimisé : on exclut sharp/libvips (~37 Mo) de l'image Docker
  images: { unoptimized: true },
  outputFileTracingExcludes: { "*": ["node_modules/@img/**", "node_modules/sharp/**"] },
  experimental: {
    // Active forbidden() / unauthorized() pour les 403
    authInterrupts: true,
    serverActions: { bodySizeLimit: "2mb" },
    // Le build Docker repart d'une couche vide : le cache Turbopack (~2 min d'écriture) ne serait jamais relu
    turbopackFileSystemCacheForBuild: false,
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
