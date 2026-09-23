import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { isTokenShape } from "@/lib/tokens";
import { CompetenceRadar } from "@/components/competence-radar";
import { loadPortfolio } from "@/app/me/portfolio/_lib/profile";
import { PortfolioSections } from "@/app/me/portfolio/_components/portfolio-sections";
import { PrintButton } from "@/app/me/portfolio/_components/share-tools";

// Lien secret : jamais indexé, jamais de référent transmis aux liens sortants
export const metadata: Metadata = {
  title: "Portfolio de compétences",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: "no-referrer",
};

export default async function PublicPortfolioPage({ params }: PageProps<"/p/portfolio/[token]">) {
  const { token } = await params;
  if (!isTokenShape(token)) notFound();

  const owner = await db.user.findUnique({
    where: { portfolioToken: token },
    select: { id: true, name: true },
  });
  if (!owner) notFound();

  // Uniquement le contenu de l'étudiant : auto-positionnements et traces (pas de niveaux ni commentaires enseignants)
  const portfolio = await loadPortfolio(owner.id, { includeTeacher: false, publicView: true });
  const documented = portfolio.scores.reduce((n, s) => n + s.learnings, 0);

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-3">
        <p className="eyebrow font-mono">Portfolio de compétences · BUT MMI</p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-3xl leading-tight font-semibold text-balance break-words">{owner.name}</h1>
          <PrintButton />
        </div>
        <p className="max-w-prose text-muted">
          Traces d&apos;apprentissage et auto-positionnement sur les compétences du BUT Métiers du Multimédia et de
          l&apos;Internet. Page partagée par l&apos;étudiant·e en lecture seule.
        </p>
        <p className="font-mono text-xs text-muted tabular-nums">
          {documented} apprentissage{documented > 1 ? "s" : ""} critique{documented > 1 ? "s" : ""} documenté
          {documented > 1 ? "s" : ""} · {portfolio.evidences.length} trace{portfolio.evidences.length > 1 ? "s" : ""}{" "}
          personnelle{portfolio.evidences.length > 1 ? "s" : ""} · {portfolio.traces.length} trace
          {portfolio.traces.length > 1 ? "s" : ""} de SAÉ
        </p>
      </header>

      <section aria-labelledby="public-radar-title" className="flex flex-col gap-3">
        <h2 id="public-radar-title" className="text-lg font-semibold">
          Auto-positionnement par compétence
        </h2>
        <div className="card">
          <CompetenceRadar
            id="public-radar"
            scores={portfolio.scores}
            showTeacher={false}
            title={`Auto-positionnement de ${owner.name}`}
          />
        </div>
        <p className="text-sm text-muted">
          Échelle : 1 Non acquis · 2 En cours d&apos;acquisition · 3 Acquis · 4 Maîtrisé.
        </p>
      </section>

      <section aria-labelledby="public-traces-title" className="flex flex-col gap-4">
        <h2 id="public-traces-title" className="text-lg font-semibold">
          Traces par compétence
        </h2>
        <PortfolioSections
          portfolio={portfolio}
          mode="public"
          emptyMessage="Aucune trace publiée pour l'instant."
        />
      </section>
    </div>
  );
}
