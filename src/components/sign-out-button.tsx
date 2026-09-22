"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Icon } from "@/components/ui/icon";

/** Déconnexion : bouton classique par défaut, ou ligne de menu (`className` fourni par la coquille) */
export function SignOutButton({ className = "btn", withIcon = false }: { className?: string; withIcon?: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      className={className}
      disabled={pending}
      onClick={async () => {
        setPending(true);
        try {
          await authClient.signOut();
        } finally {
          router.push("/login");
          router.refresh();
        }
      }}
    >
      {withIcon && <Icon name="logout" size={18} className="shrink-0 text-muted" />}
      {pending ? "Déconnexion…" : "Déconnexion"}
    </button>
  );
}
