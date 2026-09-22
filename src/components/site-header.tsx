import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { ROLE_LABELS, isAdmin } from "@/lib/permissions";
import { SignOutButton } from "@/components/sign-out-button";

export async function SiteHeader() {
  const user = await getCurrentUser();

  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 md:px-6">
        <Link href="/" className="mr-auto flex min-h-11 items-center font-semibold">
          Cours &amp; SAÉ
        </Link>
        {user ? (
          <>
            <nav aria-label="Navigation principale" className="flex items-center gap-1 text-sm">
              <Link href="/courses" className="flex min-h-11 items-center px-2 hover:underline">
                Cours
              </Link>
              <Link href="/saes" className="flex min-h-11 items-center px-2 hover:underline">
                SAÉ
              </Link>
              {isAdmin(user) && (
                <Link href="/admin/users" className="flex min-h-11 items-center px-2 hover:underline">
                  Utilisateurs
                </Link>
              )}
            </nav>
            <span className="text-sm text-muted">
              {user.name} · {ROLE_LABELS[user.role]}
            </span>
            <SignOutButton />
          </>
        ) : (
          <Link href="/login" className="btn">
            Se connecter
          </Link>
        )}
      </div>
    </header>
  );
}
