import { randomBytes } from "node:crypto";

/** Jeton secret URL-safe (liens publics, flux ICS) — 32 octets d'entropie */
export function randomToken() {
  return randomBytes(32).toString("base64url");
}

/** Format attendu d'un jeton reçu dans une URL (évite des requêtes inutiles) */
export function isTokenShape(value: string) {
  return /^[A-Za-z0-9_-]{32,64}$/.test(value);
}
