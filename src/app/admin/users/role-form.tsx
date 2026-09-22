"use client";

import { useActionState, useId } from "react";
import type { FormAction } from "@/app/courses/_lib/action-state";
import type { Role } from "@/lib/permissions";

type Props = {
  action: FormAction;
  userName: string;
  currentRole: Role;
  roles: { value: Role; label: string }[];
  /** Empêche l'admin connecté de se rétrograder (vérifié aussi côté serveur) */
  locked?: boolean;
};

export function RoleForm({ action, userName, currentRole, roles, locked = false }: Props) {
  const [state, formAction, pending] = useActionState(action, null);
  const id = useId();

  return (
    <form action={formAction} className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium md:sr-only">
        Rôle <span className="sr-only">de {userName}</span>
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <select
          id={id}
          name="role"
          defaultValue={currentRole}
          disabled={locked}
          className="input w-auto min-w-0 flex-1 sm:flex-none"
        >
          {roles.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <button type="submit" className="btn" disabled={locked || pending}>
          {pending ? "Envoi…" : "Appliquer"}
        </button>
      </div>
      {locked && <p className="text-xs text-muted">Vous ne pouvez pas modifier votre propre rôle.</p>}
      <p role="status" aria-live="polite" className={state && !state.ok ? "form-error" : "text-xs text-ok"}>
        {state ? (state.ok ? "Rôle mis à jour." : state.error) : ""}
      </p>
    </form>
  );
}
