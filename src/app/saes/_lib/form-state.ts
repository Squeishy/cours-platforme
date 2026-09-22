/** État renvoyé par les Server Actions des formulaires SAÉ (null = pas encore soumis) */
export type FormState = { ok: true; message?: string } | { ok: false; error: string } | null;

export type FormAction = (prev: FormState, formData: FormData) => Promise<FormState>;
