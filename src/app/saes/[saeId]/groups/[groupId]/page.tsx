import type { Metadata } from "next";
import { showcaseSnapshot } from "@/app/vitrine/_lib/showcase";
import { getPeertubeHosts } from "@/components/editor/peertube";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { assertAllowed, requireUser } from "@/lib/session";
import {
  canContributeToGroup,
  canManageSae,
  canPublishShowcase,
  canRequestShowcase,
  canViewAssessment,
  canViewSae,
  isGroupMember,
} from "@/lib/permissions";
import { PROVIDER_LABELS } from "@/lib/deposit";
import { formatDate, formatDateTime, formatTime } from "@/lib/format";
import { BlockEditor } from "@/components/editor";
import { publicName } from "@/app/me/portfolio/_lib/shared";
import { ActionButton } from "@/app/me/portfolio/_components/action-button";
import {
  AssessmentStatusBadge,
  BackLink,
  ExternalLink,
  LinkCheckStatusView,
} from "@/app/me/portfolio/_components/ui";
import { ShowcaseCard } from "@/app/vitrine/_components/showcase-card";
import { ModerationControls } from "@/app/vitrine/_components/moderation-controls";
import { cancelShowcaseRequest, moderateShowcase, requestShowcase } from "@/app/vitrine/actions";
import {
  addDepositLink,
  checkAllDepositLinks,
  checkDepositLink,
  deleteDepositLink,
  saveGroupContent,
} from "./actions";
import { DepositForm } from "./deposit-form";
import { ShowcaseForm } from "./showcase-form";

export const metadata: Metadata = { title: "Espace de groupe" };

export default async function GroupPage({ params }: PageProps<"/saes/[saeId]/groups/[groupId]">) {
  const { saeId, groupId } = await params;
  const user = await requireUser();

  const group = await db.group.findUnique({
    where: { id: groupId },
    include: {
      sae: {
        select: {
          id: true,
          code: true,
          title: true,
          semester: true,
          ownerId: true,
          published: true,
          teachers: { select: { id: true } },
          milestones: {
            orderBy: [{ position: "asc" }, { dueAt: "asc" }],
            take: 100,
            select: { id: true, title: true, dueAt: true, requiresDepositUrl: true },
          },
        },
      },
      members: {
        orderBy: { joinedAt: "asc" },
        select: { userId: true, user: { select: { id: true, name: true } } },
      },
      depositLinks: {
        orderBy: { createdAt: "desc" },
        take: 200,
        select: {
          id: true,
          url: true,
          label: true,
          provider: true,
          milestoneId: true,
          addedById: true,
          createdAt: true,
          checkedAt: true,
          checkStatus: true,
          checkHttp: true,
          checkNote: true,
          addedBy: { select: { name: true } },
        },
      },
      defenseSlot: {
        select: { startsAt: true, durationMin: true, location: true, jury: true },
      },
    },
  });
  if (!group || group.saeId !== saeId) notFound();

  const { sae } = group;
  assertAllowed(canViewSae(user, sae) && (isGroupMember(user, group) || canManageSae(user, sae)));

  const isManager = canManageSae(user, sae);
  const canContribute = canContributeToGroup(user, group, sae);
  const canRequest = canRequestShowcase(user, group);
  const canModerate = canPublishShowcase(user, sae);
  const memberIds = group.members.map((m) => m.userId);

  // Auto-évaluations des membres sur les jalons de cette SAÉ (quel que soit le groupe enregistré)
  const assessments = await db.selfAssessment.findMany({
    where: { userId: { in: memberIds }, milestone: { saeId: sae.id } },
    take: 1000,
    select: {
      id: true,
      userId: true,
      milestoneId: true,
      status: true,
      submittedAt: true,
      group: { select: { members: { select: { userId: true } } } },
    },
  });
  const assessmentByKey = new Map(assessments.map((a) => [`${a.milestoneId}:${a.userId}`, a]));

  const linkSections = [
    ...sae.milestones.map((m) => ({
      key: m.id,
      title: m.title,
      requiresDepositUrl: m.requiresDepositUrl,
      links: group.depositLinks.filter((l) => l.milestoneId === m.id),
    })),
    {
      key: "general",
      title: "Général",
      requiresDepositUrl: false,
      links: group.depositLinks.filter((l) => !l.milestoneId || !sae.milestones.some((m) => m.id === l.milestoneId)),
    },
  ];
  const linkCount = group.depositLinks.length;
  const linkProblems = group.depositLinks.filter((l) => l.checkStatus && l.checkStatus !== "OK").length;
  const linkUnchecked = group.depositLinks.filter((l) => !l.checkStatus).length;

  const slot = group.defenseSlot;
  const showcaseStatus = group.showcaseStatus;
  const hasShowcaseContent = !!group.showcaseTitle;
  const showcaseInitial = {
    title: group.showcaseTitle ?? "",
    summary: group.showcaseSummary ?? "",
    url: group.showcaseUrl ?? "",
    imageUrl: group.showcaseImageUrl ?? "",
    category: group.showcaseCategory ?? "",
  };

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-2">
        <BackLink href={`/saes/${sae.id}`}>
          {sae.code ? `${sae.code} — ` : ""}
          {sae.title}
        </BackLink>
        <p className="eyebrow font-mono">
          {sae.code ?? "SAÉ"}
          {sae.semester ? ` · S${sae.semester}` : ""} · Espace de groupe
        </p>
        <h1 className="text-2xl font-semibold text-balance break-words">{group.name}</h1>
      </header>

      <section aria-labelledby="members-title" className="flex flex-col gap-3">
        <h2 id="members-title" className="text-lg font-semibold">
          Membres ({group.members.length})
        </h2>
        {group.members.length === 0 ? (
          <p className="text-muted">Aucun membre dans ce groupe pour l&apos;instant.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {group.members.map((m) => (
              <li key={m.userId} className="badge text-sm text-ink">
                {m.user.name}
                {m.userId === user.id ? " (vous)" : ""}
              </li>
            ))}
          </ul>
        )}
      </section>

      {slot && (
        <section aria-labelledby="defense-title" className="flex flex-col gap-3">
          <h2 id="defense-title" className="text-lg font-semibold">
            Soutenance
          </h2>
          <div className="card flex flex-col gap-2">
            <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-semibold">
                <time dateTime={slot.startsAt.toISOString()}>{formatDate(slot.startsAt)}</time>
              </span>
              <span className="font-mono text-sm text-muted tabular-nums">
                {formatTime(slot.startsAt)} – {formatTime(new Date(slot.startsAt.getTime() + slot.durationMin * 60_000))} ·{" "}
                {slot.durationMin} min
              </span>
            </p>
            {slot.location && (
              <p className="text-sm">
                <span className="text-muted">Lieu : </span>
                <span className="break-words">{slot.location}</span>
              </p>
            )}
            {slot.jury && (
              <p className="text-sm">
                <span className="text-muted">Jury : </span>
                <span className="break-words whitespace-pre-line">{slot.jury}</span>
              </p>
            )}
            <Link
              href={`/saes/${sae.id}/defenses`}
              className="inline-flex min-h-11 items-center self-start text-sm text-accent underline"
            >
              Voir le planning des soutenances
            </Link>
          </div>
        </section>
      )}

      <section aria-labelledby="workspace-title" className="flex flex-col gap-3">
        <div>
          <h2 id="workspace-title" className="text-lg font-semibold">
            Espace de travail du groupe
          </h2>
          <p className="text-sm text-muted">
            Notes, planning, répartition des tâches : une page partagée par tout le groupe
            {canContribute ? ", enregistrée automatiquement." : "."}
          </p>
        </div>
        <BlockEditor
          initialContent={group.content}
          initialMarkdown={group.markdown}
          editable={canContribute}
          onSave={canContribute ? saveGroupContent.bind(null, group.id) : undefined}
          peertubeHosts={getPeertubeHosts()}
        />
      </section>

      <section id="depots" aria-labelledby="deposits-title" className="flex scroll-mt-4 flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 id="deposits-title" className="text-lg font-semibold">
              URL de dépôt
            </h2>
            {linkCount > 0 && (
              <p className="font-mono text-xs text-muted tabular-nums">
                {linkCount} lien{linkCount > 1 ? "s" : ""}
                {linkProblems > 0 ? ` · ${linkProblems} à corriger` : ""}
                {linkUnchecked > 0 ? ` · ${linkUnchecked} non vérifié${linkUnchecked > 1 ? "s" : ""}` : ""}
              </p>
            )}
          </div>
          {canContribute && linkCount > 0 && (
            <ActionButton
              action={checkAllDepositLinks.bind(null, group.id)}
              label="Tout vérifier"
              pendingLabel="Vérification des liens…"
              showSuccess
            />
          )}
        </div>
        <p className="text-sm text-muted">
          Chaque lien est testé sans connexion, comme le verra l&apos;enseignant : « Privé » signifie qu&apos;il faut
          ouvrir le partage.
        </p>

        <div className="flex flex-col gap-4">
          {linkSections.map((section) => (
            <div key={section.key} className="flex flex-col gap-2">
              <h3 className="flex flex-wrap items-center gap-2 text-base font-semibold">
                <span className="break-words">{section.title}</span>
                {section.requiresDepositUrl && <span className="badge">Dépôt d&apos;URL requis</span>}
              </h3>
              {section.links.length === 0 ? (
                <p className="text-sm text-muted">
                  {section.requiresDepositUrl
                    ? "Aucune URL déposée — ce jalon en attend au moins une."
                    : "Aucune URL déposée."}
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {section.links.map((link) => {
                    const canDelete = isManager || (canContribute && link.addedById === user.id);
                    const providerLabel = PROVIDER_LABELS[link.provider];
                    const name = link.label ?? providerLabel;
                    return (
                      <li key={link.id} className="card flex flex-col gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="badge">{providerLabel}</span>
                          {link.label && <span className="font-medium break-words">{link.label}</span>}
                        </div>
                        <ExternalLink href={link.url}>{link.url}</ExternalLink>
                        <LinkCheckStatusView
                          status={link.checkStatus}
                          note={link.checkNote}
                          http={link.checkHttp}
                          checkedAt={link.checkedAt}
                        />
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="text-sm text-muted">
                            Ajouté par {link.addedBy.name} le {formatDateTime(link.createdAt)}
                          </p>
                          <div className="flex flex-wrap items-start gap-2">
                            {canContribute && (
                              <ActionButton
                                action={checkDepositLink.bind(null, link.id)}
                                label="Vérifier"
                                pendingLabel="Vérification…"
                                ariaLabel={`Vérifier le lien ${name}`}
                                showSuccess
                              />
                            )}
                            {canDelete && (
                              <ActionButton
                                action={deleteDepositLink.bind(null, link.id)}
                                label="Supprimer"
                                pendingLabel="Suppression…"
                                confirmMessage="Supprimer ce lien de dépôt ?"
                                ariaLabel={`Supprimer le lien ${name}`}
                                variant="danger"
                              />
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ))}
        </div>

        {canContribute && (
          <DepositForm
            action={addDepositLink.bind(null, group.id)}
            milestones={sae.milestones.map((m) => ({ id: m.id, title: m.title }))}
          />
        )}
      </section>

      <section id="vitrine" aria-labelledby="showcase-title" className="flex scroll-mt-4 flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="showcase-title" className="text-lg font-semibold">
            Vitrine
          </h2>
          {showcaseStatus === "PENDING" && <span className="badge badge-warn">En attente de validation</span>}
          {showcaseStatus === "PUBLISHED" && <span className="badge badge-ok">Publié</span>}
        </div>

        {showcaseStatus === "NONE" && (
          <>
            {canRequest ? (
              <>
                {hasShowcaseContent && (
                  <p className="text-sm text-muted">
                    Votre dernière proposition n&apos;est pas publiée (refusée, retirée ou annulée). Vous pouvez la
                    modifier et la renvoyer.
                  </p>
                )}
                <ShowcaseForm
                  action={requestShowcase.bind(null, group.id)}
                  initial={showcaseInitial}
                  isUpdate={false}
                  isPublished={false}
                />
              </>
            ) : (
              <p className="text-muted">Le groupe n&apos;a pas proposé son projet à la vitrine.</p>
            )}
          </>
        )}

        {showcaseStatus !== "NONE" && (
          <div className="grid gap-4 md:grid-cols-2 md:items-start">
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted">
                {showcaseStatus === "PUBLISHED" ? (
                  <>
                    Visible publiquement sur{" "}
                    <Link href="/vitrine" className="text-accent underline">
                      la vitrine
                    </Link>
                    .
                  </>
                ) : (
                  "Aperçu tel qu'il apparaîtra sur la vitrine publique :"
                )}
              </p>
              <ShowcaseCard
                headingLevel="h3"
                title={group.showcaseTitle ?? "Projet sans titre"}
                summary={group.showcaseSummary}
                url={group.showcaseUrl}
                imageUrl={group.showcaseImageUrl}
                category={group.showcaseCategory}
                saeCode={sae.code}
                saeTitle={sae.title}
                semester={sae.semester}
                members={group.members.map((m) => publicName(m.user.name))}
              />
            </div>

            <div className="flex flex-col gap-4">
              {canModerate && (showcaseStatus === "PENDING" || showcaseStatus === "PUBLISHED") && (
                <div className="flex flex-col gap-2">
                  <h3 className="text-base font-semibold">Décision de l&apos;équipe pédagogique</h3>
                  <ModerationControls
                    status={showcaseStatus}
                    groupName={group.name}
                    action={moderateShowcase.bind(null, group.id, showcaseSnapshot(group))}
                  />
                </div>
              )}
              {canRequest && (
                <div className="flex flex-col gap-3">
                  {showcaseStatus === "PENDING" && (
                    <ActionButton
                      action={cancelShowcaseRequest.bind(null, group.id)}
                      label="Annuler la demande"
                      pendingLabel="Annulation…"
                      confirmMessage="Annuler la demande de publication dans la vitrine ?"
                      variant="ghost"
                    />
                  )}
                  <details>
                    <summary className="btn cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                      Modifier la proposition
                    </summary>
                    <div className="mt-3">
                      <ShowcaseForm
                        action={requestShowcase.bind(null, group.id)}
                        initial={showcaseInitial}
                        isUpdate
                        isPublished={showcaseStatus === "PUBLISHED"}
                      />
                    </div>
                  </details>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      <section aria-labelledby="assessments-title" className="flex flex-col gap-4">
        <h2 id="assessments-title" className="text-lg font-semibold">
          Auto-évaluations
        </h2>
        {sae.milestones.length === 0 ? (
          <p className="text-muted">Aucun jalon pour l&apos;instant.</p>
        ) : group.members.length === 0 ? (
          <p className="text-muted">Aucun membre, donc aucune auto-évaluation.</p>
        ) : (
          sae.milestones.map((milestone) => (
            <div key={milestone.id} className="card flex flex-col gap-3">
              <h3 className="flex flex-wrap items-baseline gap-x-2 text-base font-semibold">
                <Link href={`/saes/${sae.id}/milestones/${milestone.id}`} className="break-words hover:underline">
                  {milestone.title}
                </Link>
                {milestone.dueAt && (
                  <span className="text-sm font-normal text-muted">échéance le {formatDate(milestone.dueAt)}</span>
                )}
              </h3>
              <ul className="flex flex-col divide-y divide-line">
                {group.members.map((member) => {
                  const assessment = assessmentByKey.get(`${milestone.id}:${member.userId}`);
                  const viewable =
                    !!assessment &&
                    canViewAssessment(
                      user,
                      { userId: assessment.userId, status: assessment.status, group: assessment.group },
                      sae,
                    );
                  return (
                    <li key={member.userId} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                      <span className="mr-auto break-words">{member.user.name}</span>
                      <AssessmentStatusBadge status={assessment?.status ?? null} />
                      {assessment?.submittedAt && (
                        <span className="text-sm text-muted">le {formatDate(assessment.submittedAt)}</span>
                      )}
                      {assessment && viewable && (
                        <Link
                          href={`/assessments/${assessment.id}`}
                          className="inline-flex min-h-11 items-center px-1 text-accent underline"
                          aria-label={`Voir l'auto-évaluation de ${member.user.name} — ${milestone.title}`}
                        >
                          Voir
                        </Link>
                      )}
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
