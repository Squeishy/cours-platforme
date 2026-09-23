import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect, forbidden } from "next/navigation";
import { auth } from "@/lib/auth";
import type { Actor, Role } from "@/lib/permissions";

export type CurrentUser = Actor & { name: string; email: string };

/** Utilisateur connecté (ou null), mémoïsé par requête */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const u = session.user as typeof session.user & { role?: string };
  return { id: u.id, name: u.name, email: u.email, role: (u.role ?? "STUDENT") as Role };
});

/** Pages & actions protégées : redirige vers /login si non connecté */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Lève un 403 si la condition est fausse */
export function assertAllowed(allowed: boolean): asserts allowed {
  if (!allowed) forbidden();
}
