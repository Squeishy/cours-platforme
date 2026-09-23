// Carte de projet de la vitrine (rendu serveur). Aucune donnée personnelle au-delà des noms fournis.
import { categoryLabel } from "../_lib/showcase";

type Props = {
  title: string;
  summary: string | null;
  url: string | null;
  imageUrl: string | null;
  category: string | null;
  saeCode: string | null;
  saeTitle: string;
  semester: number | null;
  /** Noms déjà formatés pour l'affichage (« Léa B. » en public) */
  members: string[];
  headingLevel?: "h2" | "h3";
  /** Mention de statut (ex. « En attente ») affichée au-dessus du titre */
  status?: React.ReactNode;
};

export function ShowcaseCard({
  title,
  summary,
  url,
  imageUrl,
  category,
  saeCode,
  saeTitle,
  semester,
  members,
  headingLevel = "h2",
  status,
}: Props) {
  const Heading = headingLevel;
  const safeImage = imageUrl && /^https:\/\//i.test(imageUrl) ? imageUrl : null;
  const safeUrl = url && /^https?:\/\//i.test(url) ? url : null;
  const cat = categoryLabel(category);

  return (
    <article className="card relative flex h-full flex-col overflow-hidden p-0 transition-colors has-[a:hover]:border-accent">
      <div className="relative aspect-[16/9] w-full overflow-hidden border-b border-line bg-sunken">
        {safeImage ? (
          // Image externe fournie par le groupe : pas d'optimisation Next (images non optimisées), pas de référent
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={safeImage}
            alt={`Visuel du projet « ${title} »`}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            className="size-full object-cover"
          />
        ) : (
          <div className="flex size-full items-end p-4" aria-hidden="true">
            <span className="font-mono text-xs tracking-wide text-muted uppercase">{cat}</span>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="flex flex-wrap items-center gap-2 font-mono text-xs text-muted">
          <span className="badge badge-accent">{cat}</span>
          {semester != null && <span>S{semester}</span>}
          {status}
        </p>
        <Heading className="text-lg leading-tight font-semibold text-balance break-words">
          {safeUrl ? (
            <a
              href={safeUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="after:absolute after:inset-0 hover:underline"
            >
              {title}
              <span className="sr-only"> (s&apos;ouvre dans un nouvel onglet)</span>
            </a>
          ) : (
            title
          )}
        </Heading>
        {summary && <p className="text-sm whitespace-pre-line text-muted">{summary}</p>}
        <div className="mt-auto flex flex-col gap-1 pt-2 text-sm">
          <p className="font-mono text-xs text-muted">
            {saeCode ? `${saeCode} · ` : ""}
            {saeTitle}
          </p>
          {members.length > 0 && (
            <p>
              <span className="sr-only">Membres : </span>
              {members.join(", ")}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
