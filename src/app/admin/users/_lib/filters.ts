// Filtres et pagination de /admin/users (logique pure, testée dans filters.test.ts).

export const USERS_PAGE_SIZE = 50;

export type RoleFilter = "ADMIN" | "TEACHER" | "STUDENT";

export type UserFilters = {
  q: string;
  role: RoleFilter | null;
  /** id de promo, « none » = sans promo, null = toutes */
  cohort: string | null;
  page: number;
};

type Raw = string | string[] | undefined;

function first(raw: Raw) {
  return (Array.isArray(raw) ? raw[0] : raw) ?? "";
}

/** Lecture tolérante des paramètres d'URL (valeurs inconnues ignorées) */
export function parseUserFilters(sp: Record<string, Raw>): UserFilters {
  const q = first(sp.q).trim().slice(0, 100);
  const roleRaw = first(sp.role);
  const role = roleRaw === "ADMIN" || roleRaw === "TEACHER" || roleRaw === "STUDENT" ? roleRaw : null;
  const cohortRaw = first(sp.cohort).trim();
  const cohort = /^[A-Za-z0-9_-]{1,64}$/.test(cohortRaw) ? cohortRaw : null;
  const n = Number.parseInt(first(sp.page), 10);
  const page = Number.isFinite(n) && n >= 1 ? Math.min(n, 10_000) : 1;
  return { q, role, cohort, page };
}

export function pageCount(total: number, pageSize = USERS_PAGE_SIZE) {
  return Math.max(1, Math.ceil(total / pageSize));
}

/** URL de la liste avec les filtres courants (les valeurs vides sont omises) */
export function usersHref(filters: Partial<UserFilters>) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.role) params.set("role", filters.role);
  if (filters.cohort) params.set("cohort", filters.cohort);
  if (filters.page && filters.page > 1) params.set("page", String(filters.page));
  const qs = params.toString();
  return qs ? `/admin/users?${qs}` : "/admin/users";
}
