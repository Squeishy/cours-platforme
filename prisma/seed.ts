// `npm run db:seed` — idempotent :
//  1. Référentiel BUT MMI officiel (toujours, upsert) ;
//  2. Données de démonstration SYNTHÉTIQUES (hors production, sauf SEED_FORCE=1).
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { Prisma, PrismaClient, type Role } from "../src/generated/prisma/client";
import { MMI_COMPETENCES, MMI_CRITICAL_LEARNINGS } from "../src/data/referentiel-mmi";

const db = new PrismaClient({ adapter: new PrismaMariaDb(process.env.DATABASE_URL!) });
const DEMO_PASSWORD = "demo-password-2026";
const isProd = process.env.NODE_ENV === "production" && process.env.SEED_FORCE !== "1";

// ─────────────────────────────────────────────────────────────
// 1. Référentiel
// ─────────────────────────────────────────────────────────────
async function seedReferentiel() {
  for (const [i, c] of MMI_COMPETENCES.entries()) {
    const comp = await db.competence.upsert({
      where: { code: c.code },
      update: { name: c.name, description: c.description, color: c.color, position: i, levelLabels: [...c.levelLabels] },
      create: { code: c.code, name: c.name, description: c.description, color: c.color, position: i, levelLabels: [...c.levelLabels] },
    });
    for (const [j, label] of c.components.entries()) {
      const code = `CE${c.code.slice(1)}.0${j + 1}`;
      await db.essentialComponent.upsert({
        where: { code },
        update: { label, competenceId: comp.id },
        create: { code, label, competenceId: comp.id },
      });
    }
  }
  const comps = await db.competence.findMany({ select: { id: true, code: true } });
  const compId = new Map(comps.map((c) => [c.code, c.id]));
  for (const ac of MMI_CRITICAL_LEARNINGS) {
    const data = { label: ac.label, level: ac.level, parcours: ac.parcours, competenceId: compId.get(ac.competence)! };
    await db.criticalLearning.upsert({ where: { code: ac.code }, update: data, create: { code: ac.code, ...data } });
  }
  console.log(`Référentiel MMI : ${MMI_COMPETENCES.length} compétences, ${MMI_CRITICAL_LEARNINGS.length} apprentissages critiques.`);
}

async function learning(code: string) {
  const l = await db.criticalLearning.findUnique({ where: { code } });
  if (!l) throw new Error(`AC inconnu : ${code}`);
  return l;
}

/** Critère relié à un AC du référentiel (libellé = libellé officiel) */
async function criterion(code: string, position: number) {
  const l = await learning(code);
  return { label: l.label, acCode: l.code, learningId: l.id, position };
}

// ─────────────────────────────────────────────────────────────
// 2. Démo
// ─────────────────────────────────────────────────────────────
async function upsertUser(name: string, email: string, role: Role) {
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return existing;
  const id = randomUUID();
  return db.user.create({
    data: {
      id,
      name,
      email,
      role,
      emailVerified: true,
      accounts: {
        create: { id: randomUUID(), accountId: id, providerId: "credential", password: await hashPassword(DEMO_PASSWORD) },
      },
    },
  });
}

const COURSE_SLUG = "r2-02-developpement-web";
const SAE_SUBJECT = `# Sujet

Par groupes de 2, concevez et mettez en ligne le **site vitrine d'une association étudiante** du campus.

## Livrables (URL uniquement)

- Dépôt Git (GitHub ou GitLab de l'IUT), public ou partagé avec l'équipe pédagogique
- Maquettes (Figma, lien « Anyone with the link »)
- Site en ligne (hébergement de votre choix)

Aucun fichier n'est déposé sur la plateforme : fournissez uniquement les **URL de dépôt** dans l'espace de votre groupe.`;

async function seedV1Demo(u: Record<string, { id: string }>) {
  const course = await db.course.create({
    data: {
      slug: COURSE_SLUG,
      title: "Intégration web — les bases",
      summary: "Ressource de S1 : HTML sémantique, CSS (Flexbox, Grid), accessibilité, mise en ligne.",
      published: true,
      ownerId: u.prof.id,
      editors: { connect: [{ id: u.prof2.id }] },
    },
  });
  const intro = await db.page.create({
    data: {
      courseId: course.id,
      title: "Introduction",
      position: 0,
      markdown:
        "# Introduction\n\nCette ressource prépare la **SAÉ 1.05 — Produire un site Web**.\n\n## Objectifs\n\n- Structurer une page en HTML sémantique\n- Mettre en forme avec CSS (Flexbox, Grid)\n- Respecter les bases de l'accessibilité (RGAA)\n\n> Astuce : tapez `/` dans l'éditeur pour insérer un bloc.",
    },
  });
  await db.page.create({
    data: {
      courseId: course.id,
      parentId: intro.id,
      title: "TP 1 — HTML sémantique",
      position: 0,
      markdown:
        "# TP 1 — HTML sémantique\n\n1. Créez `index.html`\n2. Utilisez `header`, `main`, `nav`, `footer`\n\n```html\n<main>\n  <h1>Mon portfolio</h1>\n</main>\n```",
    },
  });

  const sae = await db.sae.create({
    data: {
      code: "SAÉ 1.05",
      title: "Produire un site Web",
      semester: 1,
      competences: "C4 — Développer (niveau 1)",
      published: true,
      courseId: course.id,
      ownerId: u.prof.id,
      teachers: { connect: [{ id: u.prof2.id }] },
      startsAt: new Date("2026-09-28"),
      endsAt: new Date("2026-12-18"),
      markdown: SAE_SUBJECT,
      milestones: {
        create: [
          {
            title: "Point d'étape 1 — Maquettes et structure",
            description: "Maquettes validées, dépôt Git initialisé, pages HTML structurées.",
            dueAt: new Date("2026-10-16T16:00:00Z"),
            position: 0,
            requiresDepositUrl: true,
            peerReviewEnabled: true,
            criteria: { create: [await criterion("AC14.01", 0), await criterion("AC14.02", 1)] },
          },
          {
            title: "Rendu final",
            description: "Site en ligne, données structurées, démonstration.",
            dueAt: new Date("2026-12-18T17:00:00Z"),
            position: 1,
            requiresDepositUrl: true,
            criteria: { create: [await criterion("AC14.03", 0), await criterion("AC14.04", 1)] },
          },
        ],
      },
    },
    include: { milestones: { include: { criteria: true }, orderBy: { position: "asc" } } },
  });

  const g1 = await db.group.create({
    data: {
      saeId: sae.id,
      name: "Groupe A",
      markdown: "# Espace du groupe\n\n## Répartition\n\n- Léa : maquettes\n- Hugo : intégration",
      members: { create: [{ userId: u.lea.id, saeId: sae.id }, { userId: u.hugo.id, saeId: sae.id }] },
    },
  });
  await db.group.create({
    data: { saeId: sae.id, name: "Groupe B", members: { create: [{ userId: u.ines.id, saeId: sae.id }, { userId: u.nathan.id, saeId: sae.id }] } },
  });

  const m1 = sae.milestones[0];
  await db.depositLink.create({
    data: { groupId: g1.id, milestoneId: m1.id, url: "https://github.com/exemple/asso-campus", label: "Dépôt principal", provider: "GITHUB", addedById: u.lea.id },
  });
  const a = await db.selfAssessment.create({
    data: {
      milestoneId: m1.id,
      userId: u.lea.id,
      groupId: g1.id,
      status: "SUBMITTED",
      submittedAt: new Date(),
      reflection: "Les maquettes ont été validées rapidement. Difficulté : organiser le dépôt Git à deux.",
      items: {
        create: [
          { criterionId: m1.criteria[0].id, level: 2, justification: "VS Code + Live Server, mais je découvre Git." },
          { criterionId: m1.criteria[1].id, level: 3, justification: "Balises sémantiques et navigation au clavier vérifiées." },
        ],
      },
    },
  });
  await db.comment.create({
    data: { assessmentId: a.id, authorId: u.prof.id, body: "Bon travail sur la sémantique. Pour AC14.01, montrez vos commits réguliers." },
  });
}

/** Les données de démo v1 utilisaient des AC du BUT Informatique : on les convertit en MMI */
async function upgradeLegacyDemo() {
  const legacy = await db.sae.findFirst({
    where: { title: "Développement d'une application" },
    include: { milestones: { include: { criteria: { orderBy: { position: "asc" } } }, orderBy: { position: "asc" } } },
  });
  if (!legacy) return;
  await db.sae.update({
    where: { id: legacy.id },
    // content remis à null : l'éditeur reconstruira les blocs depuis le nouveau Markdown
    data: { code: "SAÉ 1.05", title: "Produire un site Web", semester: 1, competences: "C4 — Développer (niveau 1)", markdown: SAE_SUBJECT, content: Prisma.DbNull },
  });
  const codes = [
    ["AC14.01", "AC14.02"],
    ["AC14.03", "AC14.04"],
  ];
  for (const [mi, m] of legacy.milestones.entries()) {
    if (mi === 0) await db.milestone.update({ where: { id: m.id }, data: { title: "Point d'étape 1 — Maquettes et structure", peerReviewEnabled: true } });
    for (const [ci, c] of m.criteria.entries()) {
      const code = codes[mi]?.[ci];
      if (!code) continue;
      const l = await learning(code);
      await db.criterion.update({ where: { id: c.id }, data: { label: l.label, acCode: l.code, learningId: l.id } });
    }
  }
  await db.course.updateMany({
    where: { slug: COURSE_SLUG },
    data: { title: "Intégration web — les bases", summary: "Ressource de S1 : HTML sémantique, CSS (Flexbox, Grid), accessibilité, mise en ligne." },
  });
  console.log("Démo v1 convertie au référentiel MMI.");
}

async function seedV2Demo(u: Record<string, { id: string }>) {
  const marker = await db.announcement.findFirst({ where: { title: "Bienvenue sur la nouvelle plateforme" } });
  if (marker) return;

  const sae = await db.sae.findFirstOrThrow({
    where: { code: "SAÉ 1.05" },
    include: {
      milestones: { include: { criteria: true }, orderBy: { position: "asc" } },
      groups: { include: { members: true }, orderBy: { name: "asc" } },
    },
  });
  const [g1] = sae.groups;

  // Promo
  const cohort = await db.cohort.upsert({
    where: { name_academicYear: { name: "MMI 1 — TD A", academicYear: "2026-2027" } },
    update: {},
    create: {
      name: "MMI 1 — TD A",
      year: 1,
      academicYear: "2026-2027",
      members: { create: [u.lea, u.hugo, u.ines, u.nathan].map((s) => ({ userId: s.id })) },
    },
  });
  await db.sae.update({ where: { id: sae.id }, data: { cohortId: cohort.id } });

  // Annonces
  await db.announcement.create({
    data: {
      scope: "GLOBAL",
      title: "Bienvenue sur la nouvelle plateforme",
      body: "Cours, SAÉ, auto-évaluations et portfolio sont désormais au même endroit.\nAbonnez votre agenda aux échéances depuis Paramètres.",
      pinned: true,
      authorId: u.admin.id,
    },
  });
  await db.announcement.create({
    data: {
      scope: "SAE",
      saeId: sae.id,
      title: "Soutenances du rendu final",
      body: "Les créneaux de soutenance sont ouverts : réservez-en un par groupe avant le 10 décembre.",
      authorId: u.prof.id,
    },
  });

  // Retour enseignant publié sur l'auto-évaluation de Léa
  const m1 = sae.milestones[0];
  const lea = await db.selfAssessment.findUnique({ where: { milestoneId_userId: { milestoneId: m1.id, userId: u.lea.id } }, include: { items: true } });
  if (lea) {
    const levels = [3, 3];
    for (const [i, item] of lea.items.entries()) {
      await db.selfAssessmentItem.update({
        where: { id: item.id },
        data: { teacherLevel: levels[i] ?? 3, teacherComment: i === 0 ? "Git est bien utilisé : commits réguliers et messages clairs." : null },
      });
    }
    await db.selfAssessment.update({ where: { id: lea.id }, data: { feedbackPublishedAt: new Date(), feedbackById: u.prof.id } });
    await db.notification.create({
      data: { userId: u.lea.id, type: "feedback", title: `Retour publié : ${m1.title}`, link: `/assessments/${lea.id}` },
    });
  }

  // Contribution entre pairs (Hugo → Léa)
  await db.peerReview.create({
    data: { milestoneId: m1.id, groupId: g1.id, reviewerId: u.hugo.id, revieweeId: u.lea.id, contribution: 4, comment: "A porté les maquettes." },
  });

  // Banque de commentaires
  await db.commentSnippet.createMany({
    data: [
      { authorId: u.prof.id, tag: "AC14.02", body: "Vérifiez la hiérarchie des titres (un seul h1, pas de saut de niveau)." },
      { authorId: u.prof.id, tag: "AC14.01", body: "Faites des commits plus petits et plus fréquents, avec des messages explicites." },
      { authorId: u.prof.id, tag: "accessibilité", body: "Testez la navigation au clavier et le contraste avec l'outil WAVE." },
    ],
  });

  // Soutenances (17/12, 9h Paris = 8h UTC)
  for (let i = 0; i < 4; i++) {
    await db.defenseSlot.create({
      data: {
        saeId: sae.id,
        startsAt: new Date(Date.UTC(2026, 11, 17, 8, i * 25)),
        durationMin: 20,
        location: "Salle B204",
        jury: "C. Martin, J. Petit",
        groupId: i === 0 ? g1.id : null,
        bookedAt: i === 0 ? new Date() : null,
      },
    });
  }

  // Vitrine (données synthétiques)
  await db.group.update({
    where: { id: g1.id },
    data: {
      showcaseStatus: "PUBLISHED",
      showcaseTitle: "Asso Campus — site vitrine",
      showcaseSummary: "Site vitrine responsive d'une association étudiante : agenda des événements, adhésion en ligne, accessibilité vérifiée au clavier.",
      showcaseUrl: "https://github.com/exemple/asso-campus",
      showcaseCategory: "WEB",
    },
  });

  // Portfolio de Léa
  await db.portfolioEvidence.create({
    data: {
      userId: u.lea.id,
      learningId: (await learning("AC13.05")).id,
      title: "Wireframes du site Asso Campus",
      url: "https://www.figma.com/design/exemple/asso-campus",
      reflection: "Premier projet de maquette complet : j'ai appris à partir des contenus avant de dessiner l'interface.",
      level: 3,
    },
  });

  // Question anonyme + réponse (FAQ)
  const intro = await db.page.findFirst({ where: { course: { slug: COURSE_SLUG }, title: "Introduction" } });
  if (intro) {
    await db.pageQuestion.create({
      data: {
        pageId: intro.id,
        authorId: u.hugo.id,
        anonymous: true,
        inFaq: true,
        resolved: true,
        body: "A-t-on le droit d'utiliser Bootstrap pour la SAÉ 1.05 ?",
        answers: { create: { authorId: u.prof.id, body: "Non : l'objectif est de maîtriser Flexbox et Grid. Les frameworks CSS viendront en S3." } },
      },
    });
  }

  // Deuxième SAÉ, créée depuis un modèle du programme national, échéance proche
  const sae103 = await db.sae.create({
    data: {
      code: "SAÉ 1.03",
      title: "Produire les éléments d'une communication visuelle",
      semester: 1,
      competences: "C3 — Exprimer (niveau 1)",
      published: true,
      ownerId: u.prof2.id,
      cohortId: cohort.id,
      startsAt: new Date("2026-09-14"),
      endsAt: new Date("2026-11-06"),
      markdown: "# Sujet\n\nDéclinez l'identité visuelle de l'association : planche d'inspiration, pistes graphiques, visuels pour les réseaux sociaux.",
      milestones: {
        create: [
          {
            title: "Planches d'inspiration",
            dueAt: new Date(Date.now() + 2 * 24 * 3600 * 1000),
            position: 0,
            requiresDepositUrl: true,
            criteria: { create: [await criterion("AC13.02", 0)] },
          },
          {
            title: "Visuels finaux",
            dueAt: new Date("2026-11-06T17:00:00Z"),
            position: 1,
            requiresDepositUrl: true,
            criteria: { create: [await criterion("AC13.03", 0), await criterion("AC13.06", 1)] },
          },
        ],
      },
    },
  });
  for (const [name, members] of [
    ["Équipe Bleue", [u.lea.id, u.ines.id]],
    ["Équipe Rouge", [u.hugo.id, u.nathan.id]],
  ] as const) {
    await db.group.create({
      data: { saeId: sae103.id, name, members: { create: members.map((userId) => ({ userId, saeId: sae103.id })) } },
    });
  }

  console.log("Démo v2 : promo, annonces, retour publié, pairs, soutenances, vitrine, portfolio, FAQ, 2e SAÉ.");
}

async function main() {
  await seedReferentiel();
  if (isProd) {
    console.log("Production : données de démo ignorées (SEED_FORCE=1 pour forcer).");
    return;
  }
  const u = {
    admin: await upsertUser("Admin Démo", "admin@demo.fr", "ADMIN"),
    prof: await upsertUser("Claire Martin", "prof@demo.fr", "TEACHER"),
    prof2: await upsertUser("Julien Petit", "prof2@demo.fr", "TEACHER"),
    lea: await upsertUser("Léa Bernard", "lea@demo.fr", "STUDENT"),
    hugo: await upsertUser("Hugo Moreau", "hugo@demo.fr", "STUDENT"),
    ines: await upsertUser("Inès Laurent", "ines@demo.fr", "STUDENT"),
    nathan: await upsertUser("Nathan Roux", "nathan@demo.fr", "STUDENT"),
  };
  if (!(await db.course.findUnique({ where: { slug: COURSE_SLUG } }))) await seedV1Demo(u);
  await upgradeLegacyDemo();
  await seedV2Demo(u);
  console.log(`Comptes de démo (mot de passe « ${DEMO_PASSWORD} ») : admin@, prof@, prof2@, lea@, hugo@, ines@, nathan@demo.fr`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
