/** Résultat des Server Actions d'administration (null = pas encore soumis) */
export type FormResult = { ok: true; message?: string } | { ok: false; error: string } | null;

export type FormAction = (prev: FormResult, formData: FormData) => Promise<FormResult>;

/** Premier message d'erreur lisible d'un résultat zod */
export function firstIssue(issues: { message: string }[], fallback = "Données invalides.") {
  return issues[0]?.message ?? fallback;
}
