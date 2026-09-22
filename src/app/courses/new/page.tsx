import type { Metadata } from "next";
import Link from "next/link";
import { assertAllowed, requireUser } from "@/lib/session";
import { canCreateCourse } from "@/lib/permissions";
import { NewCourseForm } from "./new-course-form";

export const metadata: Metadata = { title: "Nouveau cours" };

export default async function NewCoursePage() {
  const user = await requireUser();
  assertAllowed(canCreateCourse(user));

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <Link href="/courses" className="inline-flex min-h-11 items-center text-sm underline">
        ← Tous les cours
      </Link>
      <h1 className="text-2xl font-semibold">Nouveau cours</h1>
      <p className="text-muted">
        Le cours est créé en brouillon : vous pourrez ajouter des pages puis le publier depuis ses réglages.
      </p>
      <NewCourseForm />
    </div>
  );
}
