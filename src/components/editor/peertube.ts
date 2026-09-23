import "server-only";

/**
 * Instances PeerTube / Esup-Pod autorisées pour le bloc « Intégration » (variable PEERTUBE_HOSTS, liste séparée par des virgules).
 * Lu côté serveur uniquement ; les pages le passent à <BlockEditor peertubeHosts={getPeertubeHosts()} />.
 * La même variable alimente la directive CSP frame-src (next.config.ts).
 */
export function getPeertubeHosts(): string[] {
  return (process.env.PEERTUBE_HOSTS ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter((h) => /^[a-z0-9.-]+$/.test(h));
}
