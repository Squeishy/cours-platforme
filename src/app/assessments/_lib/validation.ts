// Schémas zod communs aux Server Actions du slice « évaluation ».
import { z } from "zod";
import { isValidLevel } from "@/lib/assessment";
import { MAX_BODY } from "./shared";

export const idSchema = z.string().min(1).max(64);

/** Texte libre optionnel (≤ 5000 caractères), "" → null */
export const optionalBodySchema = z
  .string()
  .trim()
  .max(MAX_BODY, `Texte trop long (${MAX_BODY} caractères maximum)`)
  .transform((v) => (v === "" ? null : v));

/** Niveau 1..4 optionnel ("" → null) */
export const optionalLevelSchema = z
  .string()
  .transform((v, ctx) => {
    if (v === "") return null;
    const n = Number(v);
    if (!Number.isInteger(n) || !isValidLevel(n)) {
      ctx.addIssue({ code: "custom", message: "Niveau invalide" });
      return z.NEVER;
    }
    return n;
  });

/**
 * Lit des champs `prefix:<id>` d'un FormData et les regroupe par id.
 * Ex. `teacherLevel:abc`, `teacherComment:abc` → Map { abc → { teacherLevel, teacherComment } }
 */
export function readKeyedFields<K extends string>(formData: FormData, fields: readonly K[]) {
  const byId = new Map<string, Partial<Record<K, string>>>();
  const pattern = new RegExp(`^(${fields.join("|")}):(.{1,64})$`);
  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string") continue;
    const match = pattern.exec(key);
    if (!match) continue;
    const field = match[1] as K;
    const id = match[2];
    const entry: Partial<Record<K, string>> = byId.get(id) ?? {};
    entry[field] = value;
    byId.set(id, entry);
  }
  return byId;
}
