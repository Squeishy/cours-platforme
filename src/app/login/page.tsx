import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Connexion" };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 py-6">
      <h1 className="text-2xl font-semibold">Connexion</h1>
      <p className="text-muted">Accédez à vos cours, SAÉ et auto-évaluations.</p>
      <LoginForm />
    </div>
  );
}
