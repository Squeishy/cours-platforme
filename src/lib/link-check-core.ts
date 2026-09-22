// Logique pure du vérificateur de liens de dépôt (testée dans link-check.test.ts).
// Le code réseau est dans link-check.ts (serveur uniquement).

export type LinkCheckStatus = "OK" | "PRIVATE" | "BROKEN" | "UNREACHABLE";

export type LinkCheckResult = {
  status: LinkCheckStatus;
  http: number | null;
  /** Explication courte pour l'étudiant */
  note: string;
};

export const LINK_STATUS_LABELS: Record<LinkCheckStatus, string> = {
  OK: "Accessible",
  PRIVATE: "Privé / connexion requise",
  BROKEN: "Lien cassé",
  UNREACHABLE: "Injoignable",
};

export const ALLOWED_PORTS = new Set(["", "80", "443", "8080", "8443"]);

function ipv4ToInt(ip: string) {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) return null;
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

const V4_BLOCKED: [string, number][] = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];

function inV4Range(ip: number, base: string, bits: number) {
  const b = ipv4ToInt(base)!;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ip & mask) === (b & mask);
}

/** Développe une IPv6 (y compris « :: » et suffixe IPv4 pointé) en 8 groupes de 16 bits, ou null */
function expandIpv6(ip: string): number[] | null {
  let text = ip.split("%")[0]; // retire l'éventuel identifiant de zone (fe80::1%eth0)
  const dotted = text.match(/(\d{1,3}(?:\.\d{1,3}){3})$/)?.[1];
  if (dotted) {
    const n = ipv4ToInt(dotted);
    if (n === null) return null;
    text = text.slice(0, -dotted.length) + ((n >>> 16).toString(16) + ":" + (n & 0xffff).toString(16));
  }
  const parts = text.split("::");
  if (parts.length > 2) return null;
  const head = parts[0] ? parts[0].split(":") : [];
  const tail = parts.length === 2 && parts[1] ? parts[1].split(":") : [];
  const missing = 8 - head.length - tail.length;
  if (parts.length === 1 ? missing !== 0 : missing < 1) return null;
  const all = [...head, ...Array(parts.length === 2 ? missing : 0).fill("0"), ...tail];
  if (all.length !== 8 || all.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return null;
  return all.map((g) => parseInt(g, 16));
}

/** Adresse non routable publiquement (SSRF) : privée, loopback, lien local, réservée, multicast… */
export function isPrivateAddress(address: string): boolean {
  const ip = address.trim().toLowerCase().replace(/^\[|\]$/g, "");
  const v4 = ipv4ToInt(ip);
  if (v4 !== null) return V4_BLOCKED.some(([base, bits]) => inV4Range(v4, base, bits));

  if (!ip.includes(":")) return true; // ni IPv4 ni IPv6 : on refuse
  const groups = expandIpv6(ip);
  if (!groups) return true; // IPv6 invalide : on refuse

  const [g0, g1, g2, g3, g4, g5, g6, g7] = groups;
  const embeddedV4 = () => [g6 >>> 8, g6 & 255, g7 >>> 8, g7 & 255].join(".");
  const upperZero = g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0;
  // ::ffff:a.b.c.d (IPv4 mappée) → on juge l'IPv4
  if (upperZero && g5 === 0xffff) return isPrivateAddress(embeddedV4());
  // ::/96 (IPv4 compatible, obsolète) et ::, ::1 → refusés
  if (upperZero && g5 === 0) return true;
  // 64:ff9b::/96 (NAT64) → on juge l'IPv4 encapsulée
  if (g0 === 0x64 && g1 === 0xff9b && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0) return isPrivateAddress(embeddedV4());
  if ((g0 & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((g0 & 0xffc0) === 0xfe80) return true; // fe80::/10 lien local
  if ((g0 & 0xffc0) === 0xfec0) return true; // fec0::/10 site local (obsolète)
  if ((g0 & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  if (g0 === 0x2001 && g1 === 0x0db8) return true; // 2001:db8::/32 documentation
  if (g0 === 0x0100 && g1 === 0 && g2 === 0 && g3 === 0) return true; // 100::/64 discard
  return false;
}

/** Pages de connexion : le lien existe mais n'est pas public */
const LOGIN_WALLS: { host: RegExp; path?: RegExp; note: string }[] = [
  { host: /^accounts\.google\.com$/, note: "Google demande une connexion : partagez le lien en « Tous les utilisateurs disposant du lien »." },
  { host: /^login\.microsoftonline\.com$|^login\.live\.com$/, note: "Microsoft demande une connexion : ouvrez le partage du document." },
  { host: /^github\.com$/, path: /^\/login/, note: "GitHub demande une connexion : dépôt privé ?" },
  { host: /(^|\.)gitlab\./, path: /^\/users\/sign_in/, note: "GitLab demande une connexion : rendez le projet visible ou ajoutez l'enseignant." },
  { host: /(^|\.)figma\.com$/, path: /^\/login/, note: "Figma demande une connexion : partagez en « Anyone with the link »." },
  { host: /(^|\.)dropbox\.com$/, path: /^\/login/, note: "Dropbox demande une connexion." },
];

export function classifyResponse(httpStatus: number, finalUrl: string): LinkCheckResult {
  let host = "";
  let path = "";
  try {
    const u = new URL(finalUrl);
    host = u.hostname.replace(/^www\./, "");
    path = u.pathname;
  } catch {
    // ignore
  }
  const wall = LOGIN_WALLS.find((w) => w.host.test(host) && (!w.path || w.path.test(path)));
  if (httpStatus < 400 && wall) return { status: "PRIVATE", http: httpStatus, note: wall.note };
  if (httpStatus >= 200 && httpStatus < 400) return { status: "OK", http: httpStatus, note: "Le lien est accessible sans connexion." };
  if (httpStatus === 401 || httpStatus === 403)
    return { status: "PRIVATE", http: httpStatus, note: "Accès refusé sans connexion : vérifiez les droits de partage." };
  if (httpStatus === 404 && (host === "github.com" || /(^|\.)gitlab\./.test(host)))
    return { status: "PRIVATE", http: httpStatus, note: "Dépôt privé ou inexistant : rendez-le public ou invitez l'enseignant." };
  if (httpStatus === 404 || httpStatus === 410) return { status: "BROKEN", http: httpStatus, note: "Page introuvable : vérifiez l'adresse." };
  if (httpStatus === 429) return { status: "UNREACHABLE", http: httpStatus, note: "Le site limite les vérifications : réessayez plus tard." };
  if (httpStatus >= 500) return { status: "UNREACHABLE", http: httpStatus, note: "Le serveur distant est en erreur." };
  return { status: "BROKEN", http: httpStatus, note: `Réponse inattendue (HTTP ${httpStatus}).` };
}
