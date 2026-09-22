import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { assertAllowed, requireUser } from "@/lib/session";
import { canBookDefense, canManageSae, canViewSae, isGroupMember } from "@/lib/permissions";
import { formatDateTime, formatTime } from "@/lib/format";
import { ActionForm, SubmitButton } from "../../_components/action-form";
import { toInputDate } from "../../_lib/dates";
import { isDefenseLocked } from "../../_lib/defense-slots";
import {
  assignDefenseSlot,
  bookDefenseSlot,
  cancelDefenseBooking,
  deleteDefenseSlot,
  generateDefenseSlots,
  unassignDefenseSlot,
} from "./actions";

export const metadata: Metadata = { title: "Soutenances" };

const dayFormatter = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

function endOf(startsAt: Date, durationMin: number) {
  return new Date(startsAt.getTime() + durationMin * 60_000);
}

export default async function DefensesPage({ params }: PageProps<"/saes/[saeId]/defenses">) {
  const { saeId } = await params;
  const user = await requireUser();

  const sae = await db.sae.findUnique({
    where: { id: saeId },
    select: {
      id: true,
      code: true,
      title: true,
      semester: true,
      published: true,
      ownerId: true,
      teachers: { select: { id: true } },
      groups: {
        orderBy: { name: "asc" },
        take: 500,
        select: { id: true, name: true, members: { select: { userId: true } } },
      },
      defenseSlots: {
        orderBy: { startsAt: "asc" },
        take: 400,
        select: {
          id: true,
          startsAt: true,
          durationMin: true,
          location: true,
          jury: true,
          groupId: true,
          bookedAt: true,
          group: { select: { id: true, name: true } },
        },
      },
    },
  });
  if (!sae) notFound();
  assertAllowed(canViewSae(user, sae));

  const canManage = canManageSae(user, sae);
  const myGroup = sae.groups.find((g) => isGroupMember(user, g));
  const canBook = !!myGroup && canBookDefense(user, myGroup, sae);
  const mySlot = myGroup ? sae.defenseSlots.find((s) => s.groupId === myGroup.id) : undefined;
  const groupsWithSlot = new Set(sae.defenseSlots.map((s) => s.groupId).filter(Boolean));
  const now = new Date();
  const taken = sae.defenseSlots.filter((s) => s.groupId).length;

  // Regroupement par jour (heure de Paris)
  const days = new Map<string, typeof sae.defenseSlots>();
  for (const slot of sae.defenseSlots) {
    const key = toInputDate(slot.startsAt);
    days.set(key, [...(days.get(key) ?? []), slot]);
  }

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <Link href={`/saes/${sae.id}`} className="inline-flex min-h-11 items-center text-sm text-muted hover:underline">
          ← Retour à la SAÉ
        </Link>
        <p className="eyebrow font-mono">
          {sae.code ?? "SAÉ"}
          {sae.semester ? ` · S${sae.semester}` : ""} · Soutenances
        </p>
        <h1 className="text-2xl font-semibold text-balance break-words">Soutenances — {sae.title}</h1>
        <p className="max-w-prose text-muted">
          {canManage
            ? "Générez les créneaux, puis laissez les groupes réserver ou attribuez-les vous-même. Les réservations se figent 24 h avant chaque créneau."
            : "Chaque groupe réserve un seul créneau. Vous pouvez annuler ou changer jusqu'à 24 h avant le passage."}
        </p>
        {sae.defenseSlots.length > 0 && (
          <p className="font-mono text-sm text-muted">
            {taken}/{sae.defenseSlots.length} créneaux attribués
          </p>
        )}
      </header>

      {/* ── Mon groupe ─────────────────────────────────────── */}
      {!canManage && (
        <section aria-labelledby="mon-creneau" className="card space-y-2 border-accent">
          <h2 id="mon-creneau" className="font-semibold">
            {myGroup ? `Créneau de ${myGroup.name}` : "Votre créneau"}
          </h2>
          {!myGroup ? (
            <p className="text-sm text-muted">
              Vous n&apos;êtes dans aucun groupe de cette SAÉ : la réservation est faite par les membres d&apos;un groupe.
            </p>
          ) : mySlot ? (
            <p>
              <time dateTime={mySlot.startsAt.toISOString()} className="font-medium">
                {formatDateTime(mySlot.startsAt)}
              </time>
              <span className="text-muted">
                {" "}
                · {mySlot.durationMin} min{mySlot.location ? ` · ${mySlot.location}` : ""}
              </span>
            </p>
          ) : sae.defenseSlots.length === 0 ? (
            <p className="text-sm text-muted">L&apos;équipe pédagogique n&apos;a pas encore ouvert de créneaux.</p>
          ) : (
            <p className="text-sm text-muted">Aucun créneau réservé. Choisissez un créneau libre ci-dessous.</p>
          )}
        </section>
      )}

      {/* ── Génération (équipe) ────────────────────────────── */}
      {canManage && (
        <section aria-labelledby="generer" className="space-y-3">
          <h2 id="generer" className="text-xl font-semibold">
            Ajouter des créneaux
          </h2>
          <ActionForm action={generateDefenseSlots} className="card space-y-4" aria-label="Générer des créneaux">
            <input type="hidden" name="saeId" value={sae.id} />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label htmlFor="slot-date" className="label">
                  Jour
                </label>
                <input id="slot-date" name="date" type="date" required className="input" />
              </div>
              <div>
                <label htmlFor="slot-start" className="label">
                  Premier créneau <span className="font-normal text-muted">(heure de Paris)</span>
                </label>
                <input id="slot-start" name="startTime" type="time" required defaultValue="09:00" className="input" />
              </div>
              <div>
                <label htmlFor="slot-count" className="label">
                  Nombre de créneaux
                </label>
                <input
                  id="slot-count"
                  name="count"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={60}
                  defaultValue={8}
                  required
                  className="input"
                />
              </div>
              <div>
                <label htmlFor="slot-duration" className="label">
                  Durée (min)
                </label>
                <input
                  id="slot-duration"
                  name="durationMin"
                  type="number"
                  inputMode="numeric"
                  min={5}
                  max={240}
                  defaultValue={20}
                  required
                  className="input"
                />
              </div>
              <div>
                <label htmlFor="slot-break" className="label">
                  Pause entre créneaux (min)
                </label>
                <input
                  id="slot-break"
                  name="breakMin"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={120}
                  defaultValue={10}
                  required
                  className="input"
                />
              </div>
              <div>
                <label htmlFor="slot-location" className="label">
                  Lieu <span className="font-normal text-muted">(optionnel)</span>
                </label>
                <input id="slot-location" name="location" maxLength={190} className="input" placeholder="Salle 204" />
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <label htmlFor="slot-jury" className="label">
                  Jury <span className="font-normal text-muted">(optionnel)</span>
                </label>
                <input id="slot-jury" name="jury" maxLength={190} className="input" placeholder="C. Martin, J. Petit" />
              </div>
            </div>
            <SubmitButton pendingLabel="Création…">Créer les créneaux</SubmitButton>
          </ActionForm>
        </section>
      )}

      {/* ── Liste des créneaux ─────────────────────────────── */}
      <section aria-labelledby="creneaux" className="space-y-4">
        <h2 id="creneaux" className="text-xl font-semibold">
          Créneaux
        </h2>
        {sae.defenseSlots.length === 0 ? (
          <p className="card text-muted">
            {canManage
              ? "Aucun créneau. Générez une série ci-dessus : jour, heure du premier passage, durée et pause."
              : "Aucun créneau pour l'instant."}
          </p>
        ) : (
          [...days.entries()].map(([day, slots]) => (
            <div key={day} className="space-y-2">
              <h3 className="font-medium first-letter:uppercase">{dayFormatter.format(slots[0].startsAt)}</h3>
              <ul className="divide-y divide-line rounded-md border border-line bg-surface">
                {slots.map((slot) => {
                  const locked = isDefenseLocked(slot.startsAt, now);
                  const mine = !!myGroup && slot.groupId === myGroup.id;
                  const time = `${formatTime(slot.startsAt)}–${formatTime(endOf(slot.startsAt, slot.durationMin))}`;
                  return (
                    <li
                      key={slot.id}
                      className={`flex flex-col gap-3 p-3 md:flex-row md:items-center md:justify-between ${
                        mine ? "bg-accent-soft" : ""
                      }`}
                    >
                      <div className="min-w-0 space-y-1">
                        <p className="flex flex-wrap items-center gap-2">
                          <time dateTime={slot.startsAt.toISOString()} className="font-mono font-medium tabular-nums">
                            {time}
                          </time>
                          {slot.group ? (
                            <span className={`badge ${mine ? "badge-accent" : "badge-ok"}`}>
                              {mine ? `Votre groupe · ${slot.group.name}` : slot.group.name}
                            </span>
                          ) : (
                            <span className="badge">Libre</span>
                          )}
                          {locked && <span className="badge badge-warn">Verrouillé</span>}
                        </p>
                        {(slot.location || slot.jury) && (
                          <p className="text-sm text-muted break-words">
                            {slot.location}
                            {slot.location && slot.jury ? " · " : ""}
                            {slot.jury ? `Jury : ${slot.jury}` : ""}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-start gap-2">
                        {canManage ? (
                          <>
                            {sae.groups.length > 0 && (
                              <ActionForm
                                action={assignDefenseSlot}
                                quiet
                                className="w-full md:w-auto"
                                aria-label={`Attribuer le créneau ${time}`}
                              >
                                <input type="hidden" name="slotId" value={slot.id} />
                                <div className="flex w-full gap-2 md:w-auto">
                                  <label htmlFor={`assign-${slot.id}`} className="sr-only">
                                    Groupe pour le créneau {time}
                                  </label>
                                  <select
                                    id={`assign-${slot.id}`}
                                    name="groupId"
                                    required
                                    className="input min-w-0 flex-1 md:w-48 md:flex-none"
                                    defaultValue=""
                                  >
                                    <option value="" disabled>
                                      Groupe…
                                    </option>
                                    {sae.groups.map((g) => (
                                      <option key={g.id} value={g.id} disabled={g.id === slot.groupId}>
                                        {g.name}
                                        {groupsWithSlot.has(g.id) && g.id !== slot.groupId ? " (déjà placé)" : ""}
                                      </option>
                                    ))}
                                  </select>
                                  <SubmitButton className="btn shrink-0" pendingLabel="…">
                                    {slot.group ? "Réattribuer" : "Attribuer"}
                                  </SubmitButton>
                                </div>
                              </ActionForm>
                            )}
                            {slot.group ? (
                              <ActionForm
                                action={unassignDefenseSlot}
                                quiet
                                confirmMessage={`Libérer le créneau ${time} de ${slot.group.name} ? Le groupe sera notifié.`}
                              >
                                <input type="hidden" name="slotId" value={slot.id} />
                                <SubmitButton className="btn" pendingLabel="Libération…">
                                  Libérer
                                </SubmitButton>
                              </ActionForm>
                            ) : (
                              <ActionForm action={deleteDefenseSlot} quiet confirmMessage={`Supprimer le créneau ${time} ?`}>
                                <input type="hidden" name="slotId" value={slot.id} />
                                <SubmitButton className="btn btn-danger" pendingLabel="Suppression…">
                                  Supprimer
                                </SubmitButton>
                              </ActionForm>
                            )}
                          </>
                        ) : mine && !locked ? (
                          <ActionForm
                            action={cancelDefenseBooking}
                            confirmMessage="Annuler la réservation de votre groupe ? Le créneau redeviendra libre."
                          >
                            <input type="hidden" name="slotId" value={slot.id} />
                            <SubmitButton className="btn btn-danger" pendingLabel="Annulation…">
                              Annuler la réservation
                            </SubmitButton>
                          </ActionForm>
                        ) : canBook && !slot.group && !mySlot && !locked ? (
                          <ActionForm action={bookDefenseSlot}>
                            <input type="hidden" name="slotId" value={slot.id} />
                            <SubmitButton pendingLabel="Réservation…" aria-label={`Réserver le créneau ${time}`}>
                              Réserver
                            </SubmitButton>
                          </ActionForm>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
