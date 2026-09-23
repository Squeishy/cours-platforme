import type { Metadata } from "next";
import { showcaseSnapshot } from "@/app/vitrine/_lib/showcase";
import Link from "next/link";
import { db } from "@/lib/db";
import { assertAllowed, requireUser } from "@/lib/session";
import { canPublishShowcase, isAdmin, isStaff } from "@/lib/permissions";
import type { Prisma } from "@/generated/prisma/client";
import { BackLink } from "@/app/me/portfolio/_components/ui";
import { ShowcaseCard } from "../_components/showcase-card";
import { ModerationControls } from "../_components/moderation-controls";
import { moderateShowcase } from "../actions";

export const metadata: Metadata = { title: "Modération de la vitrine", robots: { index: false, follow: false } };

const LIMIT = 50;

export default async function ModerationPage() {
  const user = await requireUser();
  assertAllowed(isStaff(user));

  // SAÉ gérées par l'enseignant (toutes pour un administrateur)
  const managed: Prisma.GroupWhereInput = isAdmin(user)
    ? {}
    : { sae: { OR: [{ ownerId: user.id }, { teachers: { some: { id: user.id } } }] } };

  const select = {
    id: true,
    name: true,
    saeId: true,
    showcaseStatus: true,
    showcaseTitle: true,
    showcaseSummary: true,
    showcaseUrl: true,
    showcaseImageUrl: true,
    showcaseCategory: true,
    updatedAt: true,
    sae: {
      select: { code: true, title: true, semester: true, ownerId: true, published: true, teachers: { select: { id: true } } },
    },
    members: { orderBy: { joinedAt: "asc" as const }, take: 12, select: { user: { select: { name: true } } } },
  } satisfies Prisma.GroupSelect;

  const [pending, published] = await Promise.all([
    db.group.findMany({
      where: { ...managed, showcaseStatus: "PENDING" },
      orderBy: { updatedAt: "asc" },
      take: LIMIT,
      select,
    }),
    db.group.findMany({
      where: { ...managed, showcaseStatus: "PUBLISHED" },
      orderBy: [{ sae: { semester: "desc" } }, { createdAt: "desc" }],
      take: LIMIT,
      select,
    }),
  ]);

  const sections = [
    {
      key: "pending",
      title: `En attente de validation (${pending.length}${pending.length === LIMIT ? "+" : ""})`,
      empty: "Aucune demande en attente sur vos SAÉ.",
      groups: pending,
    },
    {
      key: "published",
      title: `Publiés (${published.length}${published.length === LIMIT ? "+" : ""})`,
      empty: "Aucun projet publié sur vos SAÉ.",
      groups: published,
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <BackLink href="/vitrine">Vitrine des projets</BackLink>
        <h1 className="text-2xl font-semibold text-balance">Modération de la vitrine</h1>
        <p className="max-w-prose text-muted">
          Les groupes proposent leur projet ; vous le publiez ou le refusez. Les noms des membres apparaissent en
          public sous la forme « Prénom N. ». Chaque décision est notifiée aux membres du groupe.
        </p>
      </header>

      {sections.map((section) => (
        <section key={section.key} aria-labelledby={`mod-${section.key}`} className="flex flex-col gap-4">
          <h2 id={`mod-${section.key}`} className="text-lg font-semibold">
            {section.title}
          </h2>
          {section.groups.length === 0 ? (
            <p className="text-muted">{section.empty}</p>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2">
              {section.groups.map((g) => (
                <li key={g.id} className="flex flex-col gap-3">
                  <ShowcaseCard
                    headingLevel="h3"
                    title={g.showcaseTitle ?? "Projet sans titre"}
                    summary={g.showcaseSummary}
                    url={g.showcaseUrl}
                    imageUrl={g.showcaseImageUrl}
                    category={g.showcaseCategory}
                    saeCode={g.sae.code}
                    saeTitle={g.sae.title}
                    semester={g.sae.semester}
                    members={g.members.map((m) => m.user.name)}
                  />
                  <div className="flex flex-col gap-2">
                    <Link
                      href={`/saes/${g.saeId}/groups/${g.id}#vitrine`}
                      className="inline-flex min-h-11 items-center self-start text-sm text-accent underline"
                    >
                      Espace du groupe « {g.name} »
                    </Link>
                    {canPublishShowcase(user, g.sae) && (g.showcaseStatus === "PENDING" || g.showcaseStatus === "PUBLISHED") && (
                      <ModerationControls
                        status={g.showcaseStatus}
                        groupName={g.name}
                        action={moderateShowcase.bind(null, g.id, showcaseSnapshot(g))}
                      />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
