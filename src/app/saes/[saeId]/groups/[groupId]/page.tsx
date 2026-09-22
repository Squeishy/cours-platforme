import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { assertAllowed, requireUser } from "@/lib/session";
import {
  canContributeToGroup,
  canManageSae,
  canViewAssessment,
  canViewSae,
  isGroupMember,
} from "@/lib/permissions";
import { PROVIDER_LABELS } from "@/lib/deposit";
import { BlockEditor } from "@/components/editor";
import { formatDate, formatDateTime } from "@/app/assessments/_lib/shared";
import { BackLink, StatusBadge } from "@/app/assessments/_lib/ui";
import { ConfirmActionButton } from "@/app/assessments/_lib/confirm-action-button";
import { addDepositLink, deleteDepositLink, saveGroupContent } from "./actions";
import { DepositForm } from "./deposit-form";

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
          ownerId: true,
          published: true,
          teachers: { select: { id: true } },
          milestones: {
            orderBy: [{ position: "asc" }, { dueAt: "asc" }],
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
        select: {
          id: true,
          url: true,
          label: true,
          provider: true,
          milestoneId: true,
          addedById: true,
          createdAt: true,
          addedBy: { select: { name: true } },
        },
      },
    },
  });
  if (!group || group.saeId !== saeId) notFound();

  const { sae } = group;
  assertAllowed(canViewSae(user, sae) && (isGroupMember(user, group) || canManageSae(user, sae)));

  const isManager = canManageSae(user, sae);
  const canContribute = canContributeToGroup(user, group, sae);
  const memberIds = group.members.map((m) => m.userId);

  // Auto-évaluations des membres sur les jalons de cette SAÉ (quel que soit le groupe enregistré)
  const assessments = await db.selfAssessment.findMany({
    where: { userId: { in: memberIds }, milestone: { saeId: sae.id } },
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

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <BackLink href={`/saes/${sae.id}`}>
          {sae.code ? `${sae.code} — ` : ""}
          {sae.title}
        </BackLink>
        <h1 className="text-2xl font-semibold text-balance break-words">{group.name}</h1>
        <p className="text-sm text-muted">Espace de groupe</p>
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
        />
      </section>

      <section id="depots" aria-labelledby="deposits-title" className="flex scroll-mt-4 flex-col gap-4">
        <h2 id="deposits-title" className="text-lg font-semibold">
          URL de dépôt
        </h2>

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
                    return (
                      <li key={link.id} className="card flex flex-col gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="badge">{providerLabel}</span>
                          {link.label && <span className="font-medium break-words">{link.label}</span>}
                        </div>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          className="text-accent underline break-all"
                        >
                          {link.url}
                          <span className="sr-only"> (s&apos;ouvre dans un nouvel onglet)</span>
                        </a>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm text-muted">
                            Ajouté par {link.addedBy.name} le {formatDateTime(link.createdAt)}
                          </p>
                          {canDelete && (
                            <ConfirmActionButton
                              action={deleteDepositLink.bind(null, link.id)}
                              label="Supprimer"
                              pendingLabel="Suppression…"
                              confirmMessage="Supprimer ce lien de dépôt ?"
                              ariaLabel={`Supprimer le lien ${link.label ?? providerLabel}`}
                              variant="danger"
                            />
                          )}
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
                      <StatusBadge status={assessment?.status ?? null} />
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
