"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

function loginErrorMessage(status: number, message?: string) {
  if (status === 401 || status === 400) return "E-mail ou mot de passe incorrect.";
  if (status === 403) return message ?? "Connexion refusée.";
  if (status === 429) return "Trop de tentatives. Réessayez dans une minute.";
  return "Connexion impossible pour le moment. Réessayez plus tard.";
}

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    if (!email || !password) {
      setError("Renseignez votre e-mail et votre mot de passe.");
      return;
    }

    setPending(true);
    setError(null);
    try {
      const { error: authError } = await authClient.signIn.email({ email, password });
      if (authError) {
        setError(loginErrorMessage(authError.status, authError.message));
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Connexion impossible : vérifiez votre connexion réseau.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card flex flex-col gap-4" noValidate>
      <div>
        <label htmlFor="login-email" className="label">
          E-mail
        </label>
        <input id="login-email" name="email" type="email" autoComplete="email" required className="input" />
      </div>
      <div>
        <label htmlFor="login-password" className="label">
          Mot de passe
        </label>
        <input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="input"
        />
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "Connexion…" : "Se connecter"}
      </button>
      <p className="text-sm text-muted">
        Pas encore de compte ?{" "}
        <Link href="/register" className="inline-flex min-h-11 items-center text-accent underline">
          Créer un compte
        </Link>
      </p>
    </form>
  );
}
