import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { ROLE_LABELS, isStaff } from "@/lib/permissions";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/app/admin/users/_components/action-form";
import { calendarFeedUrls, resolveBaseUrl } from "@/app/api/calendar/_lib/calendar";
import { disableCalendarToken, regenerateCalendarToken, updateName } from "./actions";
import { CopyField } from "./_components/copy-field";

export const metadata: Metadata = { title: "Réglages" };

async function requestOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return host ? `${proto}://${host}` : "";
}

const CLIENTS: { name: string; steps: string[]; note?: string }[] = [
  {
    name: "Google Agenda",
    steps: [
      "Sur un ordinateur, ouvrez Google Agenda.",
      "À gauche, à côté de « Autres agendas », cliquez sur « + » puis « À partir de l'URL ».",
      "Collez le lien https ci-dessus, puis « Ajouter l'agenda ».",
    ],
    note: "L'agenda apparaît ensuite aussi sur votre téléphone. Google le met à jour toutes les quelques heures (jusqu'à 24 h).",
  },
  {
    name: "Outlook",
    steps: [
      "Dans Outlook (web ou nouvelle application), ouvrez le Calendrier.",
      "« Ajouter un calendrier » puis « S'abonner à partir du web ».",
      "Collez le lien https, donnez un nom (ex. « Cours & SAÉ ») puis « Importer ».",
    ],
    note: "Outlook classique : Accueil › Ajouter un calendrier › À partir d'Internet.",
  },
  {
    name: "Apple Calendrier",
    steps: [
      "Sur iPhone ou iPad : touchez le bouton « Ouvrir dans mon agenda » ci-dessus, puis « S'abonner ».",
      "Sur Mac : Calendrier › Fichier › « Nouvel abonnement à un calendrier… », collez le lien webcal.",
      "Choisissez une actualisation « Toutes les heures ».",
    ],
  },
  {
    name: "Thunderbird",
    steps: [
      "Ouvrez l'onglet Agenda, puis « Nouvel agenda… ».",
      "Choisissez « Sur le réseau », collez le lien https et validez.",
      "Cochez l'agenda proposé puis « S'abonner ».",
    ],
  },
];

export default async function SettingsPage() {
  const session = await requireUser();
  const me = await db.user.findUnique({
    where: { id: session.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      calendarToken: true,
      cohorts: { select: { cohort: { select: { id: true, name: true, academicYear: true } } }, take: 10 },
    },
  });
  if (!me) notFound();

  const staff = isStaff(me);
  const baseUrl = resolveBaseUrl(process.env.BETTER_AUTH_URL, await requestOrigin());
  const feed = me.calendarToken ? calendarFeedUrls(baseUrl, me.calendarToken) : null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-10">
      <PageHeader eyebrow="Mon compte" title="Réglages" lead="Votre nom, votre agenda et vos données personnelles." />

      {/* ── Compte ───────────────────────────────────────── */}
      <section aria-labelledby="account-title" className="flex flex-col gap-4">
        <h2 id="account-title" className="text-lg font-semibold">
          Compte
        </h2>
        <div className="card flex flex-col gap-5">
          <ActionForm action={updateName} className="flex flex-col gap-2">
            <label htmlFor="settings-name" className="label mb-0">
              Nom affiché
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="settings-name"
                name="name"
                required
                minLength={2}
                maxLength={80}
                autoComplete="name"
                defaultValue={me.name}
                className="input sm:flex-1"
              />
              <SubmitButton pendingLabel="Enregistrement…" className="btn btn-primary shrink-0">
                Enregistrer
              </SubmitButton>
            </div>
          </ActionForm>

          <dl className="grid gap-4 sm:grid-cols-2">
            <div className="min-w-0">
              <dt className="text-sm font-medium">E-mail</dt>
              <dd className="break-all text-muted">{me.email}</dd>
              <dd className="mt-1 text-xs text-muted">Identifiant de connexion : il ne se modifie pas ici.</dd>
            </div>
            <div>
              <dt className="text-sm font-medium">Rôle</dt>
              <dd>
                <span className="badge">{ROLE_LABELS[me.role]}</span>
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium">Inscription</dt>
              <dd className="text-muted">
                <time dateTime={me.createdAt.toISOString()}>{formatDate(me.createdAt)}</time>
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium">Promos</dt>
              <dd className="flex flex-wrap gap-1 text-muted">
                {me.cohorts.length === 0
                  ? "Aucune"
                  : me.cohorts.map(({ cohort }) => (
                      <span key={cohort.id} className="badge badge-accent">
                        {cohort.name} · {cohort.academicYear}
                      </span>
                    ))}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {/* ── Agenda ───────────────────────────────────────── */}
      <section id="calendrier" aria-labelledby="calendar-title" className="flex scroll-mt-20 flex-col gap-4">
        <div>
          <h2 id="calendar-title" className="text-lg font-semibold">
            Mes échéances dans mon agenda
          </h2>
          <p className="mt-1 max-w-prose text-muted">
            {staff
              ? "Abonnez votre agenda aux jalons des SAÉ que vous gérez et aux soutenances réservées. Il se met à jour tout seul."
              : "Abonnez votre agenda aux échéances des jalons de vos SAÉ et à la soutenance de votre groupe. Il se met à jour tout seul."}
          </p>
        </div>

        <div className="card flex flex-col gap-5">
          {feed ? (
            <>
              <CopyField id="feed-https" label="Lien d'abonnement (https)" value={feed.https} hint="Pour Google Agenda, Outlook et Thunderbird." />
              <CopyField id="feed-webcal" label="Lien webcal" value={feed.webcal} hint="Pour Apple Calendrier." />
              <a href={feed.webcal} className="btn btn-primary self-start">
                Ouvrir dans mon agenda
              </a>
              <p className="rounded-md bg-warn-soft p-3 text-sm text-warn">
                Ce lien est personnel : toute personne qui le connaît voit vos échéances. Ne le partagez pas ; s&apos;il a
                circulé, créez-en un nouveau.
              </p>
              <div className="flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:flex-wrap">
                <ActionForm
                  action={regenerateCalendarToken}
                  confirmMessage="Créer un nouveau lien ? L'ancien cessera immédiatement de fonctionner : il faudra réabonner vos agendas."
                  className="flex flex-col items-start"
                >
                  <SubmitButton className="btn" pendingLabel="Création…">
                    Créer un nouveau lien
                  </SubmitButton>
                </ActionForm>
                <ActionForm
                  action={disableCalendarToken}
                  confirmMessage="Désactiver le lien ? Vos agendas abonnés ne recevront plus les échéances."
                  className="flex flex-col items-start"
                >
                  <SubmitButton className="btn btn-danger" pendingLabel="Désactivation…">
                    Désactiver le lien
                  </SubmitButton>
                </ActionForm>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-start gap-3">
              <p className="text-sm text-muted">
                Aucun lien d&apos;agenda actif. Créez-en un pour recevoir vos échéances dans Google Agenda, Outlook, Apple
                Calendrier ou Thunderbird.
              </p>
              <ActionForm action={regenerateCalendarToken} className="flex flex-col items-start">
                <SubmitButton pendingLabel="Création…">Créer mon lien d&apos;agenda</SubmitButton>
              </ActionForm>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="text-base font-semibold">Comment s&apos;abonner</h3>
          <ul className="flex flex-col divide-y divide-line rounded-md border border-line bg-surface">
            {CLIENTS.map((c) => (
              <li key={c.name}>
                <details className="group">
                  <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-2 px-4 py-2 font-medium">
                    {c.name}
                    <span aria-hidden="true" className="text-muted transition-transform group-open:rotate-90">
                      ›
                    </span>
                  </summary>
                  <div className="px-4 pb-4">
                    <ol className="list-decimal space-y-1 pl-5 text-sm">
                      {c.steps.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ol>
                    {c.note && <p className="mt-2 text-xs text-muted">{c.note}</p>}
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── RGPD ─────────────────────────────────────────── */}
      <section aria-labelledby="data-title" className="flex flex-col gap-4">
        <div>
          <h2 id="data-title" className="text-lg font-semibold">
            Mes données (RGPD)
          </h2>
          <p className="mt-1 max-w-prose text-muted">
            Téléchargez une copie de vos données personnelles : profil, promos, groupes, auto-évaluations et leurs
            critères, commentaires que vous avez écrits, liens de dépôt ajoutés, traces de portfolio, favoris,
            notifications, évaluations de contribution que vous avez rédigées et sessions de connexion. Les données des
            autres personnes n&apos;y figurent pas.
          </p>
        </div>
        <div className="card flex flex-col items-start gap-3">
          <a href="/me/settings/export" download className="btn">
            Télécharger mes données (JSON)
          </a>
          <p className="text-xs text-muted">
            Pour rectifier ou supprimer votre compte, contactez l&apos;administrateur de la plateforme du département.
          </p>
        </div>
      </section>
    </div>
  );
}
