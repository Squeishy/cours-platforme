import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Inscription" };

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect("/");

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 py-6">
      <h1 className="text-2xl font-semibold">Créer un compte</h1>
      <p className="text-muted">
        Les comptes sont créés avec le rôle étudiant ; un administrateur attribue le rôle enseignant.
      </p>
      <RegisterForm />
    </div>
  );
}
