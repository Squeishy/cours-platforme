import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { assertAllowed, requireUser } from "@/lib/session";
import { isStaff } from "@/lib/permissions";
import { formatDate } from "@/app/assessments/_lib/shared";
import { MAX_SNIPPETS } from "@/app/assessments/_lib/snippets";
import { ConfirmActionButton } from "@/app/assessments/_lib/confirm-action-button";
import { createSnippet, deleteSnippet, updateSnippet } from "./actions";
import { SnippetForm } from "./snippet-form";

export const metadata: Metadata = { title: "Banque de commentaires" };

/** Valeur de filtre « sans étiquette » */
const UNTAGGED = "-";

function pick(value: string | string[] | undefined) {
  return typeof value === "string" ? value : Array.isArray(value) ? value[0] : undefined;
}

export default async function CommentBankPage({ searchParams }: PageProps<"/me/comment-bank">) {
  const user = await requireUser();
  assertAllowed(isStaff(user));

  const tagFilter = pick((await searchParams).tag)?.slice(0, 60);

  const [total, untagged, tagRows, snippets] = await Promise.all([
    db.commentSnippet.count({ where: { authorId: user.id } }),
    db.commentSnippet.count({ where: { authorId: user.id, tag: null } }),
    db.commentSnippet.groupBy({
      by: ["tag"],
      where: { authorId: user.id, tag: { not: null } },
      _count: { _all: true },
      orderBy: { tag: "asc" },
    }),
    db.commentSnippet.findMany({
      where: {
        authorId: user.id,
        ...(tagFilter === UNTAGGED ? { tag: null } : tagFilter ? { tag: tagFilter } : {}),
      },
      orderBy: [{ tag: "asc" }, { createdAt: "desc" }],
      select: { id: true, tag: true, body: true, createdAt: true },
      take: MAX_SNIPPETS,
    }),
  ]);
  const tags = tagRows.flatMap((row) => (row.tag ? [{ tag: row.tag, count: row._count._all }] : []));

  const chip = (href: string, label: string, active: boolean) => (
    <Link
      key={href}
      href={href}
      aria-current={active ? "page" : undefined}
      className={`inline-flex min-h-11 items-center rounded-md border px-3 text-sm ${
        active ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface hover:bg-sunken"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="eyebrow">Évaluation</p>
        <h1 className="text-2xl font-semibold text-balance">Banque de commentaires</h1>
        <p className="max-w-prose text-muted">
          Vos formulations récurrentes (points forts, pistes d&apos;amélioration, rappels de méthode), à insérer en un
          clic dans vos retours et commentaires d&apos;auto-évaluation. Étiquetez-les avec un code d&apos;AC (ex.
          AC14.02) : elles seront proposées en priorité sur les critères correspondants. Seul·e vous les voyez.
        </p>
      </header>

      <section aria-labelledby="new-snippet-title" className="card flex flex-col gap-3">
        <h2 id="new-snippet-title" className="text-lg font-semibold">
          Nouveau commentaire type
        </h2>
        {total >= MAX_SNIPPETS ? (
          <p className="text-sm text-warn">
            Limite de {MAX_SNIPPETS} commentaires types atteinte : supprimez-en avant d&apos;en ajouter.
          </p>
        ) : (
          <SnippetForm action={createSnippet} submitLabel="Ajouter" resetOnSuccess tagListId="snippet-tags" />
        )}
        <datalist id="snippet-tags">
          {tags.map((t) => (
            <option key={t.tag} value={t.tag} />
          ))}
        </datalist>
      </section>

      <section aria-labelledby="snippets-title" className="flex flex-col gap-4">
        <h2 id="snippets-title" className="text-lg font-semibold">
          Mes commentaires types ({total})
        </h2>

        {total > 0 && (tags.length > 0 || untagged > 0) && (
          <nav aria-label="Filtrer par étiquette" className="flex flex-wrap gap-2">
            {chip("/me/comment-bank", `Tous (${total})`, !tagFilter)}
            {tags.map((t) =>
              chip(`/me/comment-bank?tag=${encodeURIComponent(t.tag)}`, `${t.tag} (${t.count})`, tagFilter === t.tag),
            )}
            {untagged > 0 &&
              tags.length > 0 &&
              chip(`/me/comment-bank?tag=${UNTAGGED}`, `Sans étiquette (${untagged})`, tagFilter === UNTAGGED)}
          </nav>
        )}

        {total === 0 ? (
          <p className="card text-muted">
            Aucun commentaire type pour l&apos;instant. Ajoutez vos formulations les plus fréquentes ci-dessus : elles
            apparaîtront dans « Insérer un commentaire type » lors de vos retours.
          </p>
        ) : snippets.length === 0 ? (
          <p className="card text-muted">
            Aucun commentaire type pour ce filtre.{" "}
            <Link href="/me/comment-bank" className="text-accent underline">
              Afficher tout
            </Link>
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {snippets.map((snippet) => (
              <li key={snippet.id} className="card flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  {snippet.tag ? (
                    <span className="badge font-mono text-ink">{snippet.tag}</span>
                  ) : (
                    <span className="badge">Sans étiquette</span>
                  )}
                  <span className="text-xs text-muted">ajouté le {formatDate(snippet.createdAt)}</span>
                </div>
                <p className="max-w-prose break-words whitespace-pre-line">{snippet.body}</p>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                  <details className="w-full rounded-md border border-line sm:flex-1">
                    <summary className="flex min-h-11 cursor-pointer items-center px-3 text-sm font-medium">
                      Modifier
                    </summary>
                    <div className="border-t border-line p-3">
                      <SnippetForm
                        action={updateSnippet.bind(null, snippet.id)}
                        initial={{ tag: snippet.tag, body: snippet.body }}
                        submitLabel="Enregistrer"
                        tagListId="snippet-tags"
                      />
                    </div>
                  </details>
                  <ConfirmActionButton
                    action={deleteSnippet.bind(null, snippet.id)}
                    label="Supprimer"
                    pendingLabel="Suppression…"
                    confirmMessage="Supprimer ce commentaire type ?"
                    ariaLabel={`Supprimer le commentaire type ${snippet.tag ?? ""}`.trim()}
                    variant="danger"
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
