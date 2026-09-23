// Profil de compétences d'un étudiant : agrège les auto-positionnements (et niveaux
// enseignant publiés) par compétence, à partir des critères rattachés à un AC.
// Fonctions pures — testées dans competences.test.ts.

export type CompetenceRef = { code: string; name: string; color?: string | null };

export type LevelObservation = {
  competenceCode: string;
  learningCode: string;
  /** Auto-positionnement 1..4 */
  selfLevel: number | null;
  /** Niveau enseignant publié 1..4 */
  teacherLevel: number | null;
  /** Date de l'observation (soumission) — la plus récente l'emporte par AC */
  at: Date;
};

export type CompetenceScore = {
  code: string;
  name: string;
  color?: string | null;
  /** Moyenne des derniers niveaux par AC (1..4), null si aucune donnée */
  self: number | null;
  teacher: number | null;
  /** Nombre d'AC observés */
  learnings: number;
};

function avg(values: number[]) {
  return values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : null;
}

/** Dernier niveau connu par AC (auto et enseignant séparément), puis moyenne par compétence */
export function computeCompetenceProfile(competences: CompetenceRef[], observations: LevelObservation[]): CompetenceScore[] {
  const latest = new Map<string, { self?: { v: number; at: number }; teacher?: { v: number; at: number }; comp: string }>();
  for (const o of observations) {
    const cur = latest.get(o.learningCode) ?? { comp: o.competenceCode };
    const t = o.at.getTime();
    if (o.selfLevel != null && (!cur.self || t >= cur.self.at)) cur.self = { v: o.selfLevel, at: t };
    if (o.teacherLevel != null && (!cur.teacher || t >= cur.teacher.at)) cur.teacher = { v: o.teacherLevel, at: t };
    latest.set(o.learningCode, cur);
  }
  return competences.map((c) => {
    const entries = [...latest.values()].filter((e) => e.comp === c.code);
    return {
      code: c.code,
      name: c.name,
      color: c.color,
      self: avg(entries.flatMap((e) => (e.self ? [e.self.v] : []))),
      teacher: avg(entries.flatMap((e) => (e.teacher ? [e.teacher.v] : []))),
      learnings: entries.length,
    };
  });
}

/** Écart auto / enseignant jugé significatif (≥ 2 niveaux) — à signaler dans l'UI */
export function isSignificantGap(self: number | null | undefined, teacher: number | null | undefined) {
  return self != null && teacher != null && Math.abs(self - teacher) >= 2;
}

/** Points d'un polygone de radar (SVG) : valeurs 0..max sur n axes, centre (cx, cy), rayon r */
export function radarPoints(values: (number | null)[], max: number, cx: number, cy: number, r: number) {
  const n = values.length;
  return values.map((v, i) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / n;
    const ratio = Math.max(0, Math.min(1, (v ?? 0) / max));
    return { x: Math.round((cx + r * ratio * Math.cos(angle)) * 100) / 100, y: Math.round((cy + r * ratio * Math.sin(angle)) * 100) / 100 };
  });
}
