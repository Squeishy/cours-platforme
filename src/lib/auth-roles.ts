// Correspondance attributs de l'IdP (CAS / OIDC / SAML, schéma SUPANN) → rôle local.
// Utilisée quand l'authentification externe sera activée (voir docs/AUTH-EXTERNE.md).
// Règles : enseignant > étudiant ; jamais ADMIN depuis l'IdP ; null = pas d'accès automatique.

const TEACHER_AFFILIATIONS = new Set(["faculty", "teacher"]);

export function mapAffiliationToRole(affiliation: unknown): "TEACHER" | "STUDENT" | null {
  const values = (Array.isArray(affiliation) ? affiliation : [affiliation])
    .filter((x): x is string => typeof x === "string")
    // accepte aussi la forme « scoped » : student@univ.fr
    .map((x) => x.trim().toLowerCase().replace(/@.*$/, ""));
  if (values.some((v) => TEACHER_AFFILIATIONS.has(v))) return "TEACHER";
  if (values.includes("student")) return "STUDENT";
  return null;
}
