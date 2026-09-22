import { formatDateTime } from "@/lib/format";
import { createSaeAnnouncement, deleteSaeAnnouncement } from "../../actions";
import { ActionForm, SubmitButton } from "../../_components/action-form";
import { Checkbox } from "./fields";

export type ManagedAnnouncement = {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  createdAt: Date;
  author: { name: string };
};

type Props = { saeId: string; published: boolean; cohortLinked: boolean; announcements: ManagedAnnouncement[] };

/** Annonces de la SAÉ : rédaction (texte brut) + liste avec suppression */
export function AnnouncementsSection({ saeId, published, cohortLinked, announcements }: Props) {
  return (
    <section aria-labelledby="annonces" className="scroll-mt-4 space-y-3">
      <h2 id="annonces" className="text-xl font-semibold">
        Annonces
      </h2>
      <p className="text-sm text-muted">
        {published
          ? `Chaque annonce notifie les membres des groupes${cohortLinked ? " et les étudiants de la promo liée" : ""}.`
          : "SAÉ en brouillon : les annonces seront visibles à la publication, sans notification."}
      </p>

      <div className="card">
        <ActionForm action={createSaeAnnouncement} resetOnSuccess className="space-y-3" aria-label="Publier une annonce">
          <input type="hidden" name="saeId" value={saeId} />
          <div>
            <label htmlFor="announcement-title" className="label">
              Titre
            </label>
            <input id="announcement-title" name="title" className="input" required maxLength={190} />
          </div>
          <div>
            <label htmlFor="announcement-body" className="label">
              Message <span className="font-normal text-muted">(texte brut, sauts de ligne conservés)</span>
            </label>
            <textarea id="announcement-body" name="body" className="input py-2" rows={4} required maxLength={10000} />
          </div>
          <Checkbox id="announcement-pinned" name="pinned">
            Épingler en tête de la SAÉ
          </Checkbox>
          <SubmitButton pendingLabel="Publication…">Publier l&apos;annonce</SubmitButton>
        </ActionForm>
      </div>

      {announcements.length === 0 ? (
        <p className="card text-muted">Aucune annonce. Utilisez-les pour les changements de salle, rappels de rendu, etc.</p>
      ) : (
        <ul className="space-y-2">
          {announcements.map((a) => (
            <li key={a.id} className="card space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium break-words">
                    {a.pinned && <span className="badge badge-accent mr-2">Épinglée</span>}
                    {a.title}
                  </p>
                  <p className="text-xs text-muted">
                    {a.author.name} · <time dateTime={a.createdAt.toISOString()}>{formatDateTime(a.createdAt)}</time>
                  </p>
                </div>
                <ActionForm action={deleteSaeAnnouncement} quiet confirmMessage={`Supprimer l'annonce « ${a.title} » ?`}>
                  <input type="hidden" name="announcementId" value={a.id} />
                  <SubmitButton className="btn btn-danger" pendingLabel="Suppression…">
                    Supprimer
                  </SubmitButton>
                </ActionForm>
              </div>
              <p className="text-sm break-words whitespace-pre-line">{a.body}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
