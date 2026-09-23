import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ReadingLayout, ReadingSection } from "@/components/app-shell/reading-layout";
import { CompetenceChip, PageHeader } from "@/components/ui";
import { MMI_COMPETENCES, MMI_CRITICAL_LEARNINGS, MMI_PARCOURS, MMI_SAE_TEMPLATES } from "@/data/referentiel-mmi";
import { CONTRIBUTION_LEVELS, LEVELS } from "@/lib/assessment";

export const metadata: Metadata = { title: "Aide" };

const TOC = [
  { id: "referentiel", label: "Lire le référentiel" },
  { id: "auto-evaluation", label: "S'auto-positionner" },
  { id: "depot", label: "Déposer une URL publique" },
  { id: "agenda", label: "Abonner son agenda" },
  { id: "editeur", label: "Écrire dans l'éditeur" },
  { id: "enseignants", label: "Pour les enseignants" },
];

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex min-h-6 items-center rounded-sm border border-line-strong/50 bg-sunken px-1.5 font-mono text-xs text-ink">
      {children}
    </kbd>
  );
}

const CODE_FENCE = "```";

const SHORTCUTS: { keys: ReactNode; does: string }[] = [
  { keys: <Kbd>/</Kbd>, does: "Ouvre le menu des blocs : titre, liste, tableau, image, code…" },
  {
    keys: (
      <>
        <Kbd>#</Kbd> <Kbd>##</Kbd> <Kbd>###</Kbd> + espace
      </>
    ),
    does: "Titre de niveau 1, 2 ou 3",
  },
  {
    keys: (
      <>
        <Kbd>-</Kbd> + espace
      </>
    ),
    does: "Liste à puces",
  },
  {
    keys: (
      <>
        <Kbd>1.</Kbd> + espace
      </>
    ),
    does: "Liste numérotée",
  },
  {
    keys: (
      <>
        <Kbd>&gt;</Kbd> + espace
      </>
    ),
    does: "Citation",
  },
  { keys: <Kbd>{CODE_FENCE}</Kbd>, does: "Bloc de code" },
  {
    keys: (
      <>
        <Kbd>Ctrl</Kbd> ou <Kbd>⌘</Kbd> + <Kbd>B</Kbd> <Kbd>I</Kbd> <Kbd>U</Kbd>
      </>
    ),
    does: "Gras, italique, souligné",
  },
  {
    keys: (
      <>
        <Kbd>Ctrl</Kbd> ou <Kbd>⌘</Kbd> + <Kbd>Z</Kbd>
      </>
    ),
    does: "Annuler (avec Maj : rétablir)",
  },
  {
    keys: (
      <>
        <Kbd>Tab</Kbd> / <Kbd>Maj</Kbd> + <Kbd>Tab</Kbd>
      </>
    ),
    does: "Indenter / désindenter un élément de liste",
  },
  { keys: "Coller du Markdown", does: "Converti en blocs (titres, listes, code, liens)" },
];

const DEPOSIT_TIPS = [
  {
    t: "Google Drive, Docs, Slides",
    d: "Partager → « Accès général » : « Tous les utilisateurs disposant du lien », rôle « Lecteur » → Copier le lien. Avec un compte universitaire, l'accès peut être limité à l'établissement : vérifiez que vos enseignants y ont un compte.",
  },
  {
    t: "Figma",
    d: "Share → « Anyone with the link » → « can view » → Copy link. Pour un prototype, partagez le lien du mode présentation.",
  },
  {
    t: "GitHub",
    d: "Dépôt public, ou dépôt privé avec vos enseignants en collaborateurs (Settings → Collaborators). Pour un site en ligne, déposez aussi l'URL publiée (GitHub Pages ou hébergement).",
  },
  {
    t: "OneDrive, SharePoint",
    d: "Partager → paramètres du lien : « Toute personne disposant du lien », en affichage seul.",
  },
  {
    t: "Vidéo (YouTube, PeerTube)",
    d: "Choisissez « Non répertoriée » plutôt que « Privée » : une vidéo privée ne s'ouvre pas pour vos enseignants.",
  },
];

const CALENDAR_TIPS = [
  { t: "Google Agenda (ordinateur)", d: "« Autres agendas » → « + » → « À partir de l'URL », puis collez le lien." },
  { t: "Apple Calendrier (Mac)", d: "Fichier → « Nouvel abonnement à un calendrier… », puis collez le lien." },
  {
    t: "iPhone, iPad",
    d: "Réglages → Calendrier → Comptes → Ajouter un compte → Autre → « Ajouter un calendrier avec abonnement ».",
  },
  { t: "Outlook", d: "« Ajouter un calendrier » → « S'abonner à partir du web », puis collez le lien." },
];

function TipList({ rows }: { rows: { t: string; d: string }[] }) {
  return (
    <dl className="flex flex-col divide-y divide-line border-y border-line">
      {rows.map((row) => (
        <div key={row.t} className="flex flex-col gap-1 py-3">
          <dt className="font-semibold">{row.t}</dt>
          <dd className="text-muted">{row.d}</dd>
        </div>
      ))}
    </dl>
  );
}

function Bullets({ children }: { children: ReactNode }) {
  return <ul className="flex list-disc flex-col gap-2 pl-5 marker:text-line-strong">{children}</ul>;
}

function CodePart({ value, hint, strong = false }: { value: string; hint: string; strong?: boolean }) {
  return (
    <span className="flex flex-col items-center gap-1">
      <span className={`rounded-sm px-2 py-1 ${strong ? "bg-accent-soft text-accent" : "bg-sunken text-ink"}`}>{value}</span>
      <span className="font-sans text-xs text-muted">{hint}</span>
    </span>
  );
}

export default function HelpPage() {
  const c4 = MMI_COMPETENCES.find((c) => c.code === "C4");
  const ac = MMI_CRITICAL_LEARNINGS.find((l) => l.code === "AC14.02");
  const sae105 = MMI_SAE_TEMPLATES.find((s) => s.code === "SAÉ 1.05");
  const firstLevel = LEVELS[0];
  const secondLevel = LEVELS[1];

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        eyebrow="Aide · étudiants et enseignants"
        title="Bien utiliser la plateforme"
        lead="Six repères pratiques : comprendre le référentiel, s'auto-évaluer, rendre un travail, suivre ses échéances et écrire dans l'éditeur."
      />

      <ReadingLayout toc={TOC}>
        <ReadingSection id="referentiel" title="Lire le référentiel de compétences">
          <p>
            Le BUT MMI est organisé en <strong>{MMI_COMPETENCES.length} compétences</strong>. Chacune se construit par{" "}
            <strong>niveaux</strong> (à peu près une année de BUT chacun), et chaque niveau se décompose en{" "}
            <strong>apprentissages critiques</strong> (AC), {MMI_CRITICAL_LEARNINGS.length} au total. Ce sont eux que
            les SAÉ font travailler et sur lesquels vous vous positionnez.
          </p>
          <ul className="flex flex-col divide-y divide-line border-y border-line">
            {MMI_COMPETENCES.map((c) => (
              <li key={c.code} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-baseline sm:gap-3">
                <CompetenceChip code={c.code} label={c.name} className="self-start" />
                <span className="text-muted">{c.description}</span>
              </li>
            ))}
          </ul>

          {c4 && ac && (
            <>
              <figure className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
                <figcaption className="eyebrow">Exemple : de la compétence à l&apos;AC</figcaption>
                <ol className="flex flex-col gap-3">
                  <li className="flex flex-col gap-1">
                    <span className="font-mono text-xs text-muted">Compétence</span>
                    <span>
                      <CompetenceChip code={c4.code} label={c4.name} /> {c4.description}
                    </span>
                  </li>
                  <li className="flex flex-col gap-1 border-l-2 border-line pl-3">
                    <span className="font-mono text-xs text-muted">Niveau 1</span>
                    <span>{c4.levelLabels[0]}</span>
                  </li>
                  <li className="ml-3 flex flex-col gap-1 border-l-2 border-line pl-3">
                    <span className="font-mono text-xs text-muted">Apprentissage critique</span>
                    <span>
                      <CompetenceChip code={ac.code} /> {ac.label}
                    </span>
                  </li>
                </ol>
              </figure>

              <p>Le code d&apos;un AC se lit chiffre par chiffre :</p>
              <p aria-hidden="true" className="flex flex-wrap items-start gap-1 font-mono text-sm">
                <CodePart value="AC" hint="" />
                <CodePart value="1" hint="niveau" strong />
                <CodePart value="4" hint="compétence" strong />
                <CodePart value=".02" hint="numéro" />
              </p>
              <p>
                <strong>{ac.code}</strong> = niveau 1, compétence 4 ({c4.name}), apprentissage n° 02.
              </p>
              <p>
                Les <strong>composantes essentielles</strong> disent <em>comment</em> la compétence doit être
                exercée : pour « {c4.name} », par exemple, « {c4.components[0]} ».
                {sae105 && (
                  <>
                    {" "}
                    Une SAÉ mobilise plusieurs AC : la {sae105.code} « {sae105.title} » vise {sae105.acs[0]} à{" "}
                    {sae105.acs[sae105.acs.length - 1]}.
                  </>
                )}
              </p>
            </>
          )}

          <p>À partir de la deuxième année, votre parcours détermine les compétences approfondies :</p>
          <Bullets>
            {MMI_PARCOURS.map((p) => (
              <li key={p.code}>
                {p.name} : {p.competences.join(" et ")}
              </li>
            ))}
          </Bullets>
          <p>
            Votre progression, compétence par compétence :{" "}
            <Link href="/me/competences" className="link">
              Mes compétences
            </Link>
            .
          </p>
        </ReadingSection>

        <ReadingSection id="auto-evaluation" title="S'auto-positionner honnêtement">
          <p>À chaque jalon, vous vous situez sur chaque critère avec la même échelle :</p>
          <ol className="flex flex-col divide-y divide-line border-y border-line">
            {LEVELS.map((l) => (
              <li key={l.value} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 py-3">
                <span className="font-mono text-lg font-medium text-ink tabular-nums">{l.value}</span>
                <span className="flex flex-col">
                  <span className="font-semibold">{l.label}</span>
                  <span className="text-muted">« {l.hint} »</span>
                </span>
              </li>
            ))}
          </ol>
          <Bullets>
            <li>
              Positionnez-vous sur ce que <strong>vous</strong> savez faire <strong>aujourd&apos;hui</strong>, pas
              sur ce que le groupe a produit ni sur ce que vous visez.
            </li>
            <li>
              Justifiez chaque niveau par une trace vérifiable : un commit, un écran de la maquette, une partie du
              rendu, un retour utilisateur.
            </li>
            <li>
              « {secondLevel.label} » n&apos;est pas une mauvaise note : c&apos;est l&apos;état normal d&apos;un
              apprentissage en cours de semestre. « {firstLevel.label} » est une information utile, pas un aveu.
            </li>
            <li>
              L&apos;enseignant se positionne à son tour sur les mêmes critères. Un écart est un sujet de discussion,
              pas une sanction ; son retour vous est visible une fois publié.
            </li>
            <li>
              Enregistrez en brouillon autant que nécessaire. Une fois soumise, l&apos;auto-évaluation n&apos;est
              plus modifiable ; l&apos;enseignant peut la rouvrir.
            </li>
          </Bullets>
          <p>
            Si le jalon le prévoit, vous évaluez aussi la contribution de chaque coéquipier, de «{" "}
            {CONTRIBUTION_LEVELS[0].label} » à « {CONTRIBUTION_LEVELS[CONTRIBUTION_LEVELS.length - 1].label} ». La
            personne évaluée ne voit pas qui a noté quoi : seule l&apos;équipe pédagogique voit le détail.
          </p>
        </ReadingSection>

        <ReadingSection id="depot" title="Déposer une URL publique">
          <p>
            La plateforme ne stocke aucun fichier : vous déposez un <strong>lien</strong> (http ou https) vers votre
            travail. Il doit s&apos;ouvrir <strong>sans compte</strong> pour vos enseignants.
          </p>
          <TipList rows={DEPOSIT_TIPS} />
          <p>
            Le bon réflexe : ouvrez votre lien dans une <strong>fenêtre de navigation privée</strong>. S&apos;il
            demande de se connecter, il n&apos;est pas public. Quand un lien déposé est vérifié, les statuts « Privé /
            connexion requise » ou « Lien cassé » signalent qu&apos;il ne s&apos;ouvrira pas chez vos enseignants.
          </p>
        </ReadingSection>

        <ReadingSection id="agenda" title="Abonner son agenda aux échéances">
          <p>
            <Link href="/me/settings" className="link">
              Paramètres
            </Link>{" "}
            fournit un lien d&apos;abonnement personnel (format iCalendar) : les jalons de vos SAÉ et vos créneaux de
            soutenance s&apos;ajoutent à votre agenda habituel.
          </p>
          <TipList rows={CALENDAR_TIPS} />
          <p>
            Les agendas se mettent à jour seuls, avec un délai qui dépend du service (jusqu&apos;à plusieurs heures
            pour Google Agenda). Le lien est personnel : s&apos;il a circulé, créez-en un nouveau depuis Paramètres,
            l&apos;ancien cesse aussitôt de fonctionner.
          </p>
        </ReadingSection>

        <ReadingSection id="editeur" title="Écrire dans l'éditeur">
          <p>
            Cours, sujets de SAÉ et espaces de groupe utilisent le même éditeur par blocs. Le Markdown est reconnu à
            la frappe et au collage ; l&apos;enregistrement est automatique une seconde après la dernière frappe
            (l&apos;état s&apos;affiche en haut de l&apos;éditeur).
          </p>
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">Raccourcis de l&apos;éditeur</caption>
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="py-2 pr-4 font-mono text-xs font-medium text-muted uppercase">
                  Saisir
                </th>
                <th scope="col" className="py-2 font-mono text-xs font-medium text-muted uppercase">
                  Résultat
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {SHORTCUTS.map((s) => (
                <tr key={s.does} className="align-top">
                  <td className="py-2.5 pr-4 text-sm">{s.keys}</td>
                  <td className="py-2.5">{s.does}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            Pour déplacer un bloc, saisissez la poignée qui apparaît à sa gauche au survol, ou coupez-le puis
            collez-le à sa nouvelle place.
          </p>
        </ReadingSection>

        <ReadingSection id="enseignants" title="Pour les enseignants">
          <Bullets>
            <li>
              Créez la SAÉ, posez ses jalons datés, puis rattachez chaque critère à un apprentissage critique du
              référentiel : les étudiants s&apos;auto-positionnent sur ces critères.
            </li>
            <li>Ajoutez les étudiants aux groupes par adresse e-mail ; une liste collée suffit.</li>
            <li>
              Positionnez-vous à votre tour sur une auto-évaluation soumise : votre retour reste un brouillon
              jusqu&apos;à sa publication, puis l&apos;étudiant le voit.
            </li>
            <li>
              La{" "}
              <Link href="/me/comment-bank" className="link">
                banque de commentaires
              </Link>{" "}
              garde vos formulations récurrentes (par code AC, par thème) pour les réutiliser.
            </li>
            <li>
              L&apos;accueil liste ce qui attend une action : auto-évaluations sans retour publié, demandes de
              vitrine, questions sans réponse sur vos cours.
            </li>
          </Bullets>
        </ReadingSection>
      </ReadingLayout>
    </div>
  );
}
