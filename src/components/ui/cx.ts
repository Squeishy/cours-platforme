/** Concatène des classes en ignorant les valeurs vides (pas de dépendance clsx). */
export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}
