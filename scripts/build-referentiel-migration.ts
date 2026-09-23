// Génère la migration SQL de données du référentiel MMI à partir de src/data/referentiel-mmi.ts.
// Usage : npx tsx scripts/build-referentiel-migration.ts <dossier-de-migration>
// (Le référentiel est ainsi chargé en production par `prisma migrate deploy`, sans seed.)
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { MMI_COMPETENCES, MMI_CRITICAL_LEARNINGS } from "../src/data/referentiel-mmi";

const dir = process.argv[2];
if (!dir) throw new Error("Dossier de migration manquant");

const q = (s: string | null) => (s === null ? "NULL" : `'${s.replace(/\\/g, "\\\\").replace(/'/g, "''")}'`);

const lines = [
  "-- Référentiel BUT MMI (Programme national 2022) — données officielles.",
  "-- Idempotent : INSERT IGNORE sur les codes uniques (le seed met ensuite à jour par code).",
  "",
];
MMI_COMPETENCES.forEach((c, i) => {
  lines.push(
    `INSERT IGNORE INTO \`Competence\` (\`id\`, \`code\`, \`name\`, \`description\`, \`color\`, \`position\`, \`levelLabels\`) VALUES (${q(`ref-${c.code}`)}, ${q(c.code)}, ${q(c.name)}, ${q(c.description)}, ${q(c.color)}, ${i}, ${q(JSON.stringify(c.levelLabels))});`,
  );
});
lines.push("");
for (const c of MMI_COMPETENCES) {
  c.components.forEach((label, j) => {
    const code = `CE${c.code.slice(1)}.0${j + 1}`;
    lines.push(
      `INSERT IGNORE INTO \`EssentialComponent\` (\`id\`, \`code\`, \`label\`, \`competenceId\`) SELECT ${q(`ref-${code}`)}, ${q(code)}, ${q(label)}, \`id\` FROM \`Competence\` WHERE \`code\` = ${q(c.code)};`,
    );
  });
}
lines.push("");
for (const a of MMI_CRITICAL_LEARNINGS) {
  lines.push(
    `INSERT IGNORE INTO \`CriticalLearning\` (\`id\`, \`code\`, \`label\`, \`level\`, \`parcours\`, \`competenceId\`) SELECT ${q(`ref-${a.code}`)}, ${q(a.code)}, ${q(a.label)}, ${a.level}, ${q(a.parcours)}, \`id\` FROM \`Competence\` WHERE \`code\` = ${q(a.competence)};`,
  );
}
writeFileSync(join(dir, "migration.sql"), lines.join("\n") + "\n");
console.log(`${lines.length} lignes écrites dans ${dir}/migration.sql`);
