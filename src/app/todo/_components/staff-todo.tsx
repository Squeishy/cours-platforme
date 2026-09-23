import Link from "next/link";
import { formatDateShort, formatDateTime, formatTime, timeAgo } from "@/lib/format";
import { LINK_STATUS_LABELS } from "@/lib/link-check-core";
import { loadStaffTodo } from "../_lib/queries";
import { excerpt, plural } from "../_lib/todo";
import { DeadlineChip, TodoSection, saeLabel } from "./ui";

function hostOf(url: string) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.hostname.replace(/^www\./, "") : null;
  } catch {
    return null;
  }
}

function More({ shown, total, what }: { shown: number; total: number; what: string }) {
  if (total <= shown) return null;
  return (
    <p className="text-sm text-muted">
      {shown} {what} affichés sur {total}.
    </p>
  );
}

export async function StaffTodo({ userId, now }: { userId: string; now: Date }) {
  const data = await loadStaffTodo(userId, now);
  const noSae = "Vous ne gérez aucune SAÉ pour l'instant.";

  const summary = [
    { href: "#a-corriger", label: `${data.toReviewTotal} à corriger`, hot: data.toReviewTotal > 0 },
    { href: "#liens", label: plural(data.linkCount, "lien à problème", "liens à problème"), hot: data.linkCount > 0 },
    { href: "#vitrine", label: `${data.showcaseCount} vitrine${data.showcaseCount > 1 ? "s" : ""} à valider`, hot: data.showcaseCount > 0 },
    { href: "#questions", label: plural(data.questionCount, "question", "questions"), hot: data.questionCount > 0 },
    { href: "#soutenances", label: plural(data.defenses.length, "soutenance"), hot: false },
  ];

  return (
    <div className="flex flex-col gap-8">
      <nav aria-label="Résumé" className="flex flex-wrap gap-2">
        {summary.map((s) => (
          <a key={s.href} href={s.href} className={`badge min-h-11 px-3 text-sm ${s.hot ? "badge-warn" : ""}`}>
            {s.label}
          </a>
        ))}
      </nav>

      <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
        {/* ── À corriger ─────────────────────────────────── */}
        <div className="lg:col-span-2">
          <TodoSection
            id="a-corriger"
            title="À corriger"
            count={data.toReviewTotal}
            hint={data.toReview.length ? "Auto-évaluations soumises dont le retour n'est pas encore publié, par jalon (les plus anciennes d'abord)." : undefined}
            isEmpty={data.toReview.length === 0}
            empty={data.hasSaes ? "Rien à corriger. Les auto-évaluations soumises apparaîtront ici." : noSae}
          >
            {data.toReview.map((r) => (
              <li key={r.milestone.id}>
                <Link
                  href={`/saes/${r.milestone.sae.id}/review?milestone=${encodeURIComponent(r.milestone.id)}`}
                  className="flex min-h-11 flex-col gap-1 px-4 py-3 hover:bg-sunken sm:flex-row sm:items-center sm:gap-4"
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="font-mono text-xs break-words text-muted">{saeLabel(r.milestone.sae)}</span>
                    <span className="font-medium break-words">{r.milestone.title}</span>
                    {r.oldest && (
                      <span className="text-xs text-muted">
                        Plus ancienne soumise{" "}
                        <time dateTime={r.oldest.toISOString()} title={formatDateTime(r.oldest)}>
                          {timeAgo(r.oldest, now)}
                        </time>
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-2">
                    {r.milestone.dueAt && <DeadlineChip due={r.milestone.dueAt} now={now} showDate={false} />}
                    <span className="badge badge-accent font-mono tabular-nums">{plural(r.count, "copie")}</span>
                    <span aria-hidden="true" className="text-muted">
                      →
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </TodoSection>
        </div>

        {/* ── Liens à problème ───────────────────────────── */}
        <div className="flex flex-col gap-2">
          <TodoSection
            id="liens"
            title="Liens à problème"
            count={data.linkCount}
            hint={data.links.length ? "Liens de dépôt privés ou cassés lors de la dernière vérification." : undefined}
            isEmpty={data.links.length === 0}
            empty={data.hasSaes ? "Aucun lien de dépôt privé ou cassé." : noSae}
          >
            {data.links.map((l) => {
              const host = hostOf(l.url);
              return (
                <li key={l.id} className="flex flex-col gap-1 px-4 py-3">
                  <span className="font-mono text-xs break-words text-muted">{saeLabel(l.group.sae)}</span>
                  <Link href={`/saes/${l.group.sae.id}/groups/${l.group.id}`} className="inline-flex min-h-11 items-center self-start font-medium break-words hover:underline">
                    {l.group.name}
                    {l.milestone ? ` · ${l.milestone.title}` : ""}
                  </Link>
                  <span className="flex flex-wrap items-center gap-2 text-sm">
                    {l.checkStatus && (
                      <span className={`badge ${l.checkStatus === "BROKEN" ? "badge-danger" : "badge-warn"}`}>
                        {LINK_STATUS_LABELS[l.checkStatus]}
                      </span>
                    )}
                    {host && (
                      <a
                        href={l.url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="inline-flex min-h-11 items-center break-all text-accent underline"
                      >
                        {l.label ? `${l.label} (${host})` : host}
                        <span className="sr-only"> (nouvel onglet)</span>
                      </a>
                    )}
                  </span>
                  {l.checkNote && <span className="text-xs text-muted">{l.checkNote}</span>}
                </li>
              );
            })}
          </TodoSection>
          <More shown={data.links.length} total={data.linkCount} what="liens" />
        </div>

        {/* ── Vitrine à valider ──────────────────────────── */}
        <div className="flex flex-col gap-2">
          <TodoSection
            id="vitrine"
            title="Vitrine à valider"
            count={data.showcaseCount}
            isEmpty={data.showcases.length === 0}
            empty={data.hasSaes ? "Aucune demande de publication en vitrine." : noSae}
          >
            {data.showcases.map((g) => (
              <li key={g.id}>
                <Link href={`/saes/${g.sae.id}/groups/${g.id}`} className="flex min-h-11 flex-col gap-0.5 px-4 py-3 hover:bg-sunken">
                  <span className="font-mono text-xs break-words text-muted">{saeLabel(g.sae)}</span>
                  <span className="font-medium break-words">{g.showcaseTitle || g.name}</span>
                  <span className="text-xs text-muted">
                    {g.name} · demande{" "}
                    <time dateTime={g.updatedAt.toISOString()} title={formatDateTime(g.updatedAt)}>
                      {timeAgo(g.updatedAt, now)}
                    </time>
                  </span>
                </Link>
              </li>
            ))}
          </TodoSection>
          <More shown={data.showcases.length} total={data.showcaseCount} what="demandes" />
        </div>

        {/* ── Questions sans réponse ─────────────────────── */}
        <div className="flex flex-col gap-2">
          <TodoSection
            id="questions"
            title="Questions sans réponse"
            count={data.questionCount}
            hint={data.questions.length ? "Sur les cours dont vous êtes responsable ou co-éditeur, les plus anciennes d'abord." : undefined}
            isEmpty={data.questions.length === 0}
            empty="Aucune question en attente sur vos cours."
          >
            {data.questions.map((q) => (
              <li key={q.id}>
                <Link
                  href={`/courses/${q.page.course.slug}/pages/${q.page.id}`}
                  className="flex min-h-11 flex-col gap-0.5 px-4 py-3 hover:bg-sunken"
                >
                  <span className="font-mono text-xs break-words text-muted">
                    {q.page.course.title} · {q.page.title}
                  </span>
                  <span className="break-words">« {excerpt(q.body)} »</span>
                  <span className="text-xs text-muted">
                    <time dateTime={q.createdAt.toISOString()} title={formatDateTime(q.createdAt)}>
                      {timeAgo(q.createdAt, now)}
                    </time>
                  </span>
                </Link>
              </li>
            ))}
          </TodoSection>
          <More shown={data.questions.length} total={data.questionCount} what="questions" />
        </div>

        {/* ── Prochaines soutenances ─────────────────────── */}
        <TodoSection
          id="soutenances"
          title="Prochaines soutenances"
          count={data.defenses.length}
          hint={data.defenses.length ? "Créneaux réservés dans les 14 prochains jours." : undefined}
          isEmpty={data.defenses.length === 0}
          empty={data.hasSaes ? "Aucune soutenance réservée dans les 14 prochains jours." : noSae}
        >
          {data.defenses.map((d) => {
            const end = new Date(d.startsAt.getTime() + d.durationMin * 60_000);
            return (
              <li key={d.id}>
                <Link href={`/saes/${d.sae.id}/defenses`} className="flex min-h-11 gap-3 px-4 py-3 hover:bg-sunken">
                  <span className="flex w-24 shrink-0 flex-col font-mono text-xs">
                    <span className="text-ink">{formatDateShort(d.startsAt)}</span>
                    <span className="text-muted tabular-nums">
                      {formatTime(d.startsAt)}–{formatTime(end)}
                    </span>
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="font-medium break-words">{d.group?.name ?? "Groupe"}</span>
                    <span className="text-xs break-words text-muted">
                      {saeLabel(d.sae)}
                      {d.location ? ` · ${d.location}` : ""}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </TodoSection>
      </div>
    </div>
  );
}
