// Données de démonstration (synthétiques) — `npm run db:seed`
// Refuse de tourner en production sauf SEED_FORCE=1.
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient, type Role } from "../src/generated/prisma/client";

if (process.env.NODE_ENV === "production" && process.env.SEED_FORCE !== "1") {
  console.error("Seed refusé en production (SEED_FORCE=1 pour forcer).");
  process.exit(1);
}

const db = new PrismaClient({ adapter: new PrismaMariaDb(process.env.DATABASE_URL!) });

const DEMO_PASSWORD = "demo-password-2026";

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
        create: {
          id: randomUUID(),
          accountId: id,
          providerId: "credential",
          password: await hashPassword(DEMO_PASSWORD),
        },
      },
    },
  });
}

async function main() {
  const admin = await upsertUser("Admin Démo", "admin@demo.fr", "ADMIN");
  const prof = await upsertUser("Claire Martin", "prof@demo.fr", "TEACHER");
  const prof2 = await upsertUser("Julien Petit", "prof2@demo.fr", "TEACHER");
  const students = await Promise.all(
    [
      ["Léa Bernard", "lea@demo.fr"],
      ["Hugo Moreau", "hugo@demo.fr"],
      ["Inès Laurent", "ines@demo.fr"],
      ["Nathan Roux", "nathan@demo.fr"],
    ].map(([n, e]) => upsertUser(n, e, "STUDENT")),
  );
  const [lea, hugo, ines, nathan] = students;

  if (await db.course.findUnique({ where: { slug: "r2-02-developpement-web" } })) {
    console.log("Données de démo déjà présentes.");
    return;
  }

  // Cours : contenu fourni en Markdown uniquement → converti en blocs par l'éditeur à la 1re ouverture
  const course = await db.course.create({
    data: {
      slug: "r2-02-developpement-web",
      title: "R2.02 — Développement web",
      summary: "Ressource de S2 : HTML sémantique, CSS, accessibilité, JavaScript côté client.",
      published: true,
      ownerId: prof.id,
      editors: { connect: [{ id: prof2.id }] },
    },
  });
  const intro = await db.page.create({
    data: {
      courseId: course.id,
      title: "Introduction",
      position: 0,
      markdown:
        "# Introduction\n\nCette ressource prépare la **SAÉ 2.01**.\n\n## Objectifs\n\n- Structurer une page en HTML sémantique\n- Mettre en forme avec CSS (Flexbox, Grid)\n- Respecter les bases de l'accessibilité (RGAA)\n\n> Astuce : tapez `/` dans l'éditeur pour insérer un bloc.",
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

  // SAÉ avec jalons et critères rattachés à des apprentissages critiques (exemple BUT Informatique, C1 niveau 2)
  const sae = await db.sae.create({
    data: {
      code: "SAÉ 2.01",
      title: "Développement d'une application",
      semester: 2,
      competences: "C1 — Réaliser un développement d'application",
      published: true,
      courseId: course.id,
      ownerId: prof.id,
      teachers: { connect: [{ id: prof2.id }] },
      startsAt: new Date("2026-09-28"),
      endsAt: new Date("2026-12-18"),
      markdown:
        "# Sujet\n\nPar groupes de 2, concevez et développez une application web de réservation de salles pour le département.\n\n## Livrables\n\n- Dépôt Git (GitHub ou GitLab de l'IUT)\n- Maquettes (Figma)\n- Rapport de tests\n\nAucun fichier n'est déposé sur la plateforme : fournissez uniquement les **URL de dépôt**.",
      milestones: {
        create: [
          {
            title: "Point d'étape 1 — Spécifications et maquettes",
            description: "Spécifications fonctionnelles, maquettes validées, dépôt Git initialisé.",
            dueAt: new Date("2026-10-16T18:00:00"),
            position: 0,
            requiresDepositUrl: true,
            criteria: {
              create: [
                {
                  acCode: "AC21.01",
                  label: "Élaborer et implémenter les spécifications fonctionnelles et non fonctionnelles à partir des exigences",
                  position: 0,
                },
                { acCode: "AC21.02", label: "Appliquer des principes d'accessibilité et d'ergonomie", position: 1 },
              ],
            },
          },
          {
            title: "Rendu final",
            description: "Application fonctionnelle, tests, démonstration.",
            dueAt: new Date("2026-12-18T18:00:00"),
            position: 1,
            requiresDepositUrl: true,
            criteria: {
              create: [
                { acCode: "AC21.03", label: "Adopter de bonnes pratiques de conception et de programmation", position: 0 },
                { acCode: "AC21.04", label: "Vérifier et valider la qualité de l'application par les tests", position: 1 },
              ],
            },
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
      markdown: "# Espace du groupe\n\n## Répartition\n\n- Léa : maquettes\n- Hugo : base de données",
      members: { create: [{ userId: lea.id }, { userId: hugo.id }] },
    },
  });
  await db.group.create({
    data: { saeId: sae.id, name: "Groupe B", members: { create: [{ userId: ines.id }, { userId: nathan.id }] } },
  });

  const m1 = sae.milestones[0];
  await db.depositLink.create({
    data: {
      groupId: g1.id,
      milestoneId: m1.id,
      url: "https://github.com/exemple/reservation-salles",
      label: "Dépôt principal",
      provider: "GITHUB",
      addedById: lea.id,
    },
  });

  const assessment = await db.selfAssessment.create({
    data: {
      milestoneId: m1.id,
      userId: lea.id,
      groupId: g1.id,
      status: "SUBMITTED",
      submittedAt: new Date(),
      reflection: "Les maquettes ont été validées rapidement. Difficulté : prioriser les exigences non fonctionnelles.",
      items: {
        create: [
          { criterionId: m1.criteria[0].id, level: 2, justification: "Spécifications rédigées avec l'aide du groupe." },
          { criterionId: m1.criteria[1].id, level: 3, justification: "Contrastes et navigation clavier vérifiés." },
        ],
      },
    },
  });
  await db.comment.create({
    data: {
      assessmentId: assessment.id,
      authorId: prof.id,
      body: "Bon travail sur l'accessibilité. Pour AC21.01, précisez les critères d'acceptation de chaque exigence.",
    },
  });

  console.log(`Seed OK — comptes (mot de passe « ${DEMO_PASSWORD} ») :`);
  for (const u of [admin, prof, prof2, ...students]) console.log(`  ${u.role.padEnd(8)} ${u.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
