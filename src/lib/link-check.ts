import "server-only";
import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import { isIP, type LookupFunction } from "node:net";
import { ALLOWED_PORTS, classifyResponse, isPrivateAddress, type LinkCheckResult } from "@/lib/link-check-core";

export { LINK_STATUS_LABELS, type LinkCheckResult, type LinkCheckStatus } from "@/lib/link-check-core";

const MAX_REDIRECTS = 5;
const TIMEOUT_MS = 6000;

/** Hôtes internes explicitement autorisés (ex. GitLab de l'IUT sur le réseau interne) */
function allowedInternalHosts() {
  return (process.env.LINK_CHECK_ALLOW_HOSTS ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Résolution DNS contrôlée AU MOMENT DE LA CONNEXION (pas de TOCTOU / DNS rebinding) :
 * refuse toute adresse non publique, sauf hôte explicitement autorisé.
 */
const safeLookup: LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, "", 4);
    const list = addresses as dns.LookupAddress[];
    const internalOk = allowedInternalHosts().includes(hostname.toLowerCase());
    if (!list.length || (!internalOk && list.some((a) => isPrivateAddress(a.address)))) {
      const e = Object.assign(new Error("Adresse non publique refusée"), { code: "EPRIVATE" });
      return callback(e, "", 4);
    }
    if ((options as { all?: boolean }).all) return (callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, list);
    callback(null, list[0].address, list[0].family);
  });
};

function requestOnce(url: URL): Promise<{ status: number; location: string | null }> {
  return new Promise((resolve, reject) => {
    const lib = url.protocol === "https:" ? https : http;
    const req = lib.request(
      url,
      {
        method: "GET",
        lookup: safeLookup,
        timeout: TIMEOUT_MS,
        headers: {
          "user-agent": "CoursSAE-LinkCheck/1.0 (+verification de liens de depot)",
          accept: "text/html,application/xhtml+xml,*/*;q=0.8",
          "accept-language": "fr,en;q=0.8",
        },
      },
      (res) => {
        const location = typeof res.headers.location === "string" ? res.headers.location : null;
        res.destroy(); // on ne lit jamais le corps
        resolve({ status: res.statusCode ?? 0, location });
      },
    );
    req.on("timeout", () => req.destroy(Object.assign(new Error("Délai dépassé"), { code: "ETIMEDOUT" })));
    req.on("error", reject);
    req.end();
  });
}

/** Vérifie qu'une URL de dépôt est accessible publiquement, sans jamais joindre le réseau interne */
export async function checkLink(raw: string): Promise<LinkCheckResult> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { status: "BROKEN", http: null, note: "Adresse invalide." };
  }
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!["http:", "https:"].includes(url.protocol) || !ALLOWED_PORTS.has(url.port) || url.username || url.password) {
      return { status: "BROKEN", http: null, note: "Adresse non autorisée (protocole, port ou identifiants)." };
    }
    // Une IP littérale ne passe pas par `lookup` : contrôle explicite
    const literal = url.hostname.replace(/^\[|\]$/g, "");
    if (isIP(literal) && isPrivateAddress(literal) && !allowedInternalHosts().includes(literal)) {
      return { status: "UNREACHABLE", http: null, note: "Adresse interne ou non publique : non vérifiable." };
    }
    let res: { status: number; location: string | null };
    try {
      res = await requestOnce(url);
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === "EPRIVATE") return { status: "UNREACHABLE", http: null, note: "Adresse interne ou non publique : non vérifiable." };
      if (code === "ENOTFOUND") return { status: "BROKEN", http: null, note: "Nom de domaine introuvable." };
      if (code === "ETIMEDOUT") return { status: "UNREACHABLE", http: null, note: "Le site met trop de temps à répondre." };
      return { status: "UNREACHABLE", http: null, note: "Impossible de joindre le site." };
    }
    if (res.status >= 300 && res.status < 400 && res.location) {
      try {
        url = new URL(res.location, url);
      } catch {
        return { status: "BROKEN", http: res.status, note: "Redirection invalide." };
      }
      continue;
    }
    return classifyResponse(res.status, url.toString());
  }
  return { status: "BROKEN", http: null, note: "Trop de redirections." };
}
