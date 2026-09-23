// URL de dépôt : on ne stocke aucun fichier, uniquement des liens externes.
import { z } from "zod";

export type DepositProvider = "GITHUB" | "GITLAB" | "GOOGLE_DRIVE" | "ONEDRIVE" | "FIGMA" | "OTHER";

export const PROVIDER_LABELS: Record<DepositProvider, string> = {
  GITHUB: "GitHub",
  GITLAB: "GitLab",
  GOOGLE_DRIVE: "Google Drive",
  ONEDRIVE: "OneDrive / SharePoint",
  FIGMA: "Figma",
  OTHER: "Lien",
};

/** Uniquement http(s) — refuse javascript:, data:, etc. */
export const depositUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .url("URL invalide")
  .refine((v) => /^https?:\/\//i.test(v), "Seules les URL http(s) sont acceptées");

export function detectProvider(rawUrl: string): DepositProvider {
  let host: string;
  try {
    host = new URL(rawUrl).hostname.toLowerCase();
  } catch {
    return "OTHER";
  }
  const is = (d: string) => host === d || host.endsWith(`.${d}`);
  if (is("github.com")) return "GITHUB";
  // gitlab.com ou instance auto-hébergée (gitlab.univ-xxx.fr)
  if (is("gitlab.com") || host.startsWith("gitlab.")) return "GITLAB";
  if (is("drive.google.com") || is("docs.google.com")) return "GOOGLE_DRIVE";
  if (is("onedrive.live.com") || is("1drv.ms") || is("sharepoint.com")) return "ONEDRIVE";
  if (is("figma.com")) return "FIGMA";
  return "OTHER";
}
