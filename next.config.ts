import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
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
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
