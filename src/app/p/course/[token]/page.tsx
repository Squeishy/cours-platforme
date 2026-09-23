import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { buildPageTree, readingOrder } from "@/app/courses/_lib/tree";
import { PageTree } from "@/app/courses/_components/page-tree";
import { loadSharedCourse } from "../_lib/load";

export async function generateMetadata({ params }: PageProps<"/p/course/[token]">): Promise<Metadata> {
  const { token } = await params;
  const course = await loadSharedCourse(token);
  return { title: course?.title ?? "Cours partagé", robots: { index: false, follow: false } };
}

/** Lecture publique d'un cours (lien partagé par l'équipe pédagogique, sans compte) */
export default async function SharedCoursePage({ params }: PageProps<"/p/course/[token]">) {
  // Rendu à chaque requête : un lien révoqué doit cesser de fonctionner immédiatement
  await connection();
  const { token } = await params;
  const course = await loadSharedCourse(token);
  if (!course) notFound();

  const tree = buildPageTree(course.pages);
  const first = readingOrder(tree)[0];
  const base = `/p/course/${token}`;

  return (
    <div className="flex max-w-[70ch] flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="eyebrow">Cours partagé · lecture seule</p>
        <h1 className="text-2xl font-semibold text-balance break-words">{course.title}</h1>
        {course.summary && <p className="whitespace-pre-line text-muted break-words">{course.summary}</p>}
        <p className="text-sm text-muted">Responsable : {course.owner.name}</p>
        {first && (
          <Link href={`${base}/${first.id}`} className="btn btn-primary self-start">
            Commencer la lecture
          </Link>
        )}
      </header>

      <section aria-labelledby="sommaire" className="flex flex-col gap-3">
        <h2 id="sommaire" className="text-lg font-semibold">
          Sommaire
        </h2>
        {tree.length === 0 ? (
          <p className="card text-muted">Ce cours ne contient encore aucune page.</p>
        ) : (
          <nav aria-label="Sommaire du cours" className="card">
            <PageTree nodes={tree} slug="" basePath={base} />
          </nav>
        )}
      </section>
    </div>
  );
}
