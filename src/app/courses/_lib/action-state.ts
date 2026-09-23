/**
 * Résultat renvoyé par les Server Actions de formulaire (null = pas encore soumis).
 * `values` : champs renvoyés en cas d'erreur pour les réafficher (React réinitialise le formulaire après l'action).
 */
export type ActionState = { ok: true } | { ok: false; error: string; values?: Record<string, string> } | null;

/** Server Action utilisable avec useActionState (arguments métier déjà liés via .bind) */
export type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;
