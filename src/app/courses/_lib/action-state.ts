/** Résultat renvoyé par les Server Actions de formulaire (null = pas encore soumis) */
export type ActionState = { ok: true } | { ok: false; error: string } | null;

/** Server Action utilisable avec useActionState (arguments métier déjà liés via .bind) */
export type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;
