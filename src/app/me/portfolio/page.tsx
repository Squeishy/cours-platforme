import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { isStaff } from "@/lib/permissions";
import { CompetenceRadar } from "@/components/competence-radar";
import { loadPortfolio } from "./_lib/profile";
import { ActionButton } from "./_components/action-button";
import { EvidenceForm, type LearningOptionGroup } from "./_components/evidence-form";
import { PortfolioSections } from "./_components/portfolio-sections";
import { CopyLinkButton, PrintButton } from "./_components/share-tools";
import { BackLink } from "./_components/ui";
import { deleteEvidence, disablePortfolioShare, enablePortfolioShare, saveEvidence } from "./actions";

export const metadata: Metadata = { title: "Mon portfolio" };

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PortfolioPage({ searchParams }: PageProps<"/me/portfolio">) {
  const user = await requireUser();

  if (isStaff(user)) {
    return (
      <div className="flex flex-col gap-4">
        <BackLink href="/me">Mon espace</BackLink>
        <h1 className="text-2xl font-semibold">Portfolio</h1>
        <div className="card flex flex-col gap-2">
          <p>Le portfolio de compétences concerne les étudiants.</p>
          <p className="text-muted">
            Pour consulter le portfolio d&apos;un étudiant (jury, suivi), passez par la{" "}
            <Link href="/students" className="text-accent underline">
              liste des étudiants
            </Link>
            .
          </p>
        </div>
      </div>
    );
  }

  const sp = await searchParams;
  const acCode = one(sp.ac);

  const [portfolio, me] = await Promise.all([
    loadPortfolio(user.id, { includeTeacher: true }),
    db.user.findUnique({ where: { id: user.id }, select: { portfolioToken: true } }),
  ]);

  // Options du sélecteur d'AC, groupées par compétence puis niveau
  const groupsByCompetence = new Map<string, LearningOptionGroup[]>();
  const competenceOfLearning = new Map<string, string>();
  for (const c of portfolio.referentiel) {
    groupsByCompetence.set(
      c.code,
      [1, 2, 3]
        .map((level) => ({
          label: `${c.code} ${c.name} — niveau ${level}`,
          options: c.learnings
            .filter((l) => l.level === level)
            .map((l) => ({ id: l.id, code: l.code, label: l.label })),
        }))
        .filter((g) => g.options.length > 0),
    );
    for (const l of c.learnings) competenceOfLearning.set(l.id, c.code);
  }
  const groups = [...groupsByCompetence.values()].flat();
  // En modification, on propose les AC de la même compétence (formulaires plus légers)
  const groupsFor = (learningId: string) => groupsByCompetence.get(competenceOfLearning.get(learningId) ?? "") ?? groups;
  const defaultLearningId = acCode
    ? portfolio.referentiel.flatMap((c) => c.learnings).find((l) => l.code === acCode)?.id
    : undefined;

  const token = me?.portfolioToken ?? null;
  const base = (process.env.BETTER_AUTH_URL ?? "").replace(/\/+$/, "");
  const sharePath = token ? `/p/portfolio/${token}` : null;
  const shareUrl = sharePath ? `${base}${sharePath}` : null;

  const evidenceCount = portfolio.evidences.length;
  const traceCount = portfolio.traces.length;

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-3">
        <BackLink href="/me">Mon espace</BackLink>
        <p className="eyebrow font-mono">Démarche portfolio · BUT MMI</p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-2xl font-semibold text-balance">Mon portfolio</h1>
          <div className="flex flex-wrap gap-2 print:hidden">
            <Link href="/me/competences" className="btn">
              Mes compétences
            </Link>
            <PrintButton />
          </div>
        </div>
        <p className="max-w-prose text-muted">
          Rassemblez vos preuves d&apos;apprentissage (traces) et reliez-les aux apprentissages critiques du
          référentiel. Vos auto-évaluations de SAÉ y figurent automatiquement. Le portfolio est évalué aux semestres
          pairs : chaque trace gagne à être accompagnée d&apos;une courte analyse.
        </p>
        <p className="font-mono text-xs text-muted tabular-nums">
          {evidenceCount} trace{evidenceCount > 1 ? "s" : ""} personnelle{evidenceCount > 1 ? "s" : ""} · {traceCount}{" "}
          trace{traceCount > 1 ? "s" : ""} issue{traceCount > 1 ? "s" : ""} des SAÉ
        </p>
      </header>

      <section aria-labelledby="share-title" className="card flex flex-col gap-3 print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="share-title" className="text-lg font-semibold">
            Partage
          </h2>
          {token ? <span className="badge badge-ok">Lien public actif</span> : <span className="badge">Privé</span>}
        </div>
        <p className="max-w-prose text-sm text-muted">
          Par défaut, seuls vous et l&apos;équipe enseignante voyez ce portfolio. Un lien public (stage, candidature)
          montre votre nom, votre radar d&apos;auto-positionnement, vos traces (titre, lien, analyse, niveau) et vos
          traces de SAÉ avec leurs liens de dépôt — jamais votre e-mail, ni les niveaux ou commentaires des
          enseignants, ni les évaluations entre pairs.
        </p>
        {token && sharePath && shareUrl ? (
          <div className="flex flex-col gap-3">
            <div>
              <label htmlFor="share-url" className="label">
                Lien public
              </label>
              <input id="share-url" type="text" readOnly value={shareUrl} className="input font-mono text-sm" />
            </div>
            <div className="flex flex-wrap items-start gap-2">
              <CopyLinkButton value={shareUrl} inputId="share-url" />
              <Link href={sharePath} className="btn btn-ghost" target="_blank" rel="noopener noreferrer">
                Aperçu public
                <span className="sr-only"> (s&apos;ouvre dans un nouvel onglet)</span>
              </Link>
              <ActionButton
                action={enablePortfolioShare}
                label="Renouveler le lien"
                pendingLabel="Renouvellement…"
                confirmMessage="Créer un nouveau lien ? L'ancien lien cessera immédiatement de fonctionner."
                showSuccess
              />
              <ActionButton
                action={disablePortfolioShare}
                label="Désactiver"
                pendingLabel="Désactivation…"
                confirmMessage="Désactiver le lien public ? Le portfolio redeviendra privé."
                variant="danger"
                showSuccess
              />
            </div>
          </div>
        ) : (
          <ActionButton
            action={enablePortfolioShare}
            label="Créer un lien public"
            pendingLabel="Création…"
            variant="primary"
            showSuccess
          />
        )}
      </section>

      <section aria-labelledby="radar-title" className="flex flex-col gap-3">
        <h2 id="radar-title" className="text-lg font-semibold">
          Profil de compétences
        </h2>
        <div className="card">
          <CompetenceRadar id="portfolio-radar" scores={portfolio.scores} title="Mon profil de compétences" />
        </div>
      </section>

      <section id="nouvelle-trace" aria-labelledby="new-evidence-title" className="flex scroll-mt-4 flex-col gap-3 print:hidden">
        <h2 id="new-evidence-title" className="text-lg font-semibold">
          Ajouter une trace
        </h2>
        {groups.length === 0 ? (
          <p className="card text-muted">
            Le référentiel de compétences n&apos;est pas encore chargé : contactez l&apos;administrateur.
          </p>
        ) : (
          <div className="card">
            <EvidenceForm action={saveEvidence} groups={groups} defaultLearningId={defaultLearningId} />
          </div>
        )}
      </section>

      <section aria-labelledby="evidences-title" className="flex flex-col gap-4">
        <h2 id="evidences-title" className="text-lg font-semibold">
          Traces par compétence
        </h2>
        <PortfolioSections
          portfolio={portfolio}
          mode="owner"
          canOpenAssessment={() => true}
          emptyMessage={
            <>
              Aucune trace pour l&apos;instant. Ajoutez votre première preuve ci-dessus ; vos auto-évaluations
              soumises sur des critères rattachés à un AC apparaîtront aussi ici.
            </>
          }
          renderEvidenceActions={(e) => (
            <div className="flex flex-col gap-2 print:hidden">
              <div className="flex flex-wrap items-start gap-2">
                <details className="w-full">
                  <summary className="btn btn-ghost cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                    Modifier
                  </summary>
                  <div className="mt-3 rounded-md border border-line p-3">
                    <EvidenceForm
                      action={saveEvidence}
                      groups={groupsFor(e.learningId)}
                      initial={{
                        id: e.id,
                        learningId: e.learningId,
                        title: e.title,
                        url: e.url ?? "",
                        reflection: e.reflection ?? "",
                        level: e.level,
                      }}
                    />
                  </div>
                </details>
              </div>
              <ActionButton
                action={deleteEvidence.bind(null, e.id)}
                label="Supprimer"
                pendingLabel="Suppression…"
                confirmMessage={`Supprimer la trace « ${e.title} » ?`}
                ariaLabel={`Supprimer la trace ${e.title}`}
                variant="danger"
              />
            </div>
          )}
        />
      </section>
    </div>
  );
}
