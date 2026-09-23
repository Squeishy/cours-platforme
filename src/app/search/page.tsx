import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { formatDateTime, timeAgo } from "@/lib/format";
import { MAX_QUERY_LENGTH, planSearch, type SnippetPart } from "./_lib/query";
import { SEARCH_LIMITS, searchContent, type SearchResults } from "./_lib/search";

function readQuery(value: string | string[] | undefined) {
  return (typeof value === "string" ? value : "").trim().slice(0, MAX_QUERY_LENGTH);
}

export async function generateMetadata({ searchParams }: PageProps<"/search">): Promise<Metadata> {
  const q = readQuery((await searchParams).q);
  return { title: q ? `« ${q} » — Recherche` : "Recherche", robots: { index: false } };
}

function Snippet({ parts }: { parts: SnippetPart[] }) {
  if (parts.length === 0) return null;
  return (
    <p className="text-sm text-muted break-words">
      {parts.map((part, i) =>
        part.match ? (
          <mark key={i} className="rounded-sm bg-accent-soft px-0.5 font-semibold text-ink underline decoration-accent">
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </p>
  );
}

function Tips() {
  return (
    <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-muted">
      <li>Tapez le début d&apos;un mot : « access » trouve « accessibilité ».</li>
      <li>Majuscules et accents sont ignorés : « eleve » trouve « élève ».</li>
      <li>Avec plusieurs mots, les résultats qui les contiennent tous arrivent en premier.</li>
      <li>Les mots très courts (UX, C1…) sont cherchés tels quels dans le texte.</li>
    </ul>
  );
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n > 1 ? many : one}`;
}

function Results({ q, results }: { q: string; results: SearchResults }) {
  const total = results.pages.length + results.courses.length + results.saes.length;

  if (results.failed) {
    return (
      <p role="alert" className="card text-danger">
        La recherche est momentanément indisponible. Réessayez dans quelques instants.
      </p>
    );
  }

  if (total === 0) {
    return (
      <div className="card flex flex-col gap-3">
        <p>
          Aucun résultat pour <strong className="break-words">« {q} »</strong> dans les cours, pages et SAÉ que vous
          pouvez consulter.
        </p>
        <Tips />
      </div>
    );
  }

  const groups = [
    { id: "res-pages", label: "Pages", count: results.pages.length },
    { id: "res-cours", label: "Cours", count: results.courses.length },
    { id: "res-saes", label: "SAÉ", count: results.saes.length },
  ].filter((g) => g.count > 0);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <p>
          {plural(total, "résultat", "résultats")} pour <strong className="break-words">« {q} »</strong>
        </p>
        <nav aria-label="Types de résultats" className="flex flex-wrap gap-x-4 text-sm">
          {groups.map((g) => (
            <a key={g.id} href={`#${g.id}`} className="inline-flex min-h-11 items-center underline">
              {g.label} ({g.count})
            </a>
          ))}
        </nav>
      </div>

      {results.pages.length > 0 && (
        <section aria-labelledby="res-pages" className="flex flex-col gap-3">
          <h2 id="res-pages" className="text-lg font-semibold">
            Pages de cours
          </h2>
          <ul className="card flex flex-col divide-y divide-line p-0">
            {results.pages.map((hit) => (
              <li key={hit.id} className="flex flex-col gap-1 px-4 py-3">
                <Link href={hit.href} className="inline-flex min-h-11 items-center font-semibold break-words underline-offset-2 hover:underline">
                  {hit.title}
                </Link>
                <p className="text-sm text-muted break-words">
                  {hit.courseTitle} · modifiée{" "}
                  <time dateTime={hit.updatedAt.toISOString()} title={formatDateTime(hit.updatedAt)}>
                    {timeAgo(hit.updatedAt)}
                  </time>
                </p>
                <Snippet parts={hit.snippet} />
              </li>
            ))}
          </ul>
          {results.pages.length >= SEARCH_LIMITS.pages && (
            <p className="text-sm text-muted">
              Seules les {SEARCH_LIMITS.pages} pages les plus pertinentes sont affichées : précisez la recherche.
            </p>
          )}
        </section>
      )}

      {results.courses.length > 0 && (
        <section aria-labelledby="res-cours" className="flex flex-col gap-3">
          <h2 id="res-cours" className="text-lg font-semibold">
            Cours
          </h2>
          <ul className="card flex flex-col divide-y divide-line p-0">
            {results.courses.map((hit) => (
              <li key={hit.id} className="flex flex-col gap-1 px-4 py-3">
                <Link href={hit.href} className="inline-flex min-h-11 items-center font-semibold break-words underline-offset-2 hover:underline">
                  {hit.title}
                </Link>
                <Snippet parts={hit.snippet} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {results.saes.length > 0 && (
        <section aria-labelledby="res-saes" className="flex flex-col gap-3">
          <h2 id="res-saes" className="text-lg font-semibold">
            SAÉ
          </h2>
          <ul className="card flex flex-col divide-y divide-line p-0">
            {results.saes.map((hit) => (
              <li key={hit.id} className="flex flex-col gap-1 px-4 py-3">
                <Link href={hit.href} className="inline-flex min-h-11 flex-wrap items-center gap-x-2 font-semibold break-words underline-offset-2 hover:underline">
                  {hit.code && <span className="badge">{hit.code}</span>}
                  <span className="min-w-0">{hit.title}</span>
                </Link>
                {hit.semester != null && <p className="text-sm text-muted">Semestre {hit.semester}</p>}
                <Snippet parts={hit.snippet} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** Recherche plein texte : pages de cours, cours et SAÉ visibles par l'utilisateur */
export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const user = await requireUser();
  const q = readQuery((await searchParams).q);
  const plan = planSearch(q);
  const results = plan.kind === "empty" ? null : await searchContent(user, plan);

  return (
    <div className="flex max-w-[70ch] flex-col gap-6">
      <h1 className="text-2xl font-semibold">Recherche</h1>

      <form action="/search" method="get" role="search" className="flex flex-col gap-2">
        <label htmlFor="search-q" className="label">
          Rechercher dans les cours, les pages et les SAÉ
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="search-q"
            name="q"
            type="search"
            defaultValue={q}
            maxLength={MAX_QUERY_LENGTH}
            enterKeyHint="search"
            autoComplete="off"
            className="input"
          />
          <button type="submit" className="btn btn-primary shrink-0">
            Rechercher
          </button>
        </div>
      </form>

      {results ? (
        <Results q={q} results={results} />
      ) : (
        <div className="card flex flex-col gap-3">
          <p>
            {q
              ? "Saisissez au moins une lettre ou un chiffre."
              : "Cherchez une notion, un titre de page, un cours ou une SAÉ."}
          </p>
          <Tips />
        </div>
      )}
    </div>
  );
}
