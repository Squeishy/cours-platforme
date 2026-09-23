// Radar de compétences (SVG, rendu serveur, sans état).
// Auto-positionnement = polygone au trait plein ; positionnement enseignant publié = zone pleine légère à bord pointillé.
// Aucune information portée par la seule couleur : légende texte + tableau de données pour les lecteurs d'écran.
import { radarPoints, type CompetenceScore } from "@/lib/competences";

const MAX = 4;
const VIEW = 260;
const CENTER = VIEW / 2;
const RADIUS = 88;
const LABEL_RADIUS = RADIUS + 20;

const numberFormatter = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 1,
});
const fmt = (v: number | null) =>
  v == null ? "—" : `${numberFormatter.format(v)} / 4`;

function safeColor(color: string | null | undefined) {
  return color && /^#[0-9a-f]{3,8}$/i.test(color) ? color : null;
}

function toPath(points: { x: number; y: number }[]) {
  return points.map((p) => `${p.x},${p.y}`).join(" ");
}

type Props = {
  scores: CompetenceScore[];
  /** Identifiant unique dans la page (relie titre, description et tableau) */
  id?: string;
  title?: string;
  /** Afficher le positionnement enseignant (désactivé sur le portfolio public) */
  showTeacher?: boolean;
  className?: string;
};

export function CompetenceRadar({
  scores,
  id = "radar",
  title = "Profil de compétences",
  showTeacher = true,
  className = "",
}: Props) {
  const n = scores.length;
  const hasSelf = scores.some((s) => s.self != null);
  const hasTeacher = showTeacher && scores.some((s) => s.teacher != null);
  const titleId = `${id}-title`;
  const descId = `${id}-desc`;
  const tableId = `${id}-table`;

  const description =
    n === 0
      ? "Aucune compétence dans le référentiel."
      : `Radar à ${n} axes, échelle de 0 à 4. ` +
        scores
          .map(
            (s) =>
              `${s.code} ${s.name} : auto-positionnement ${fmt(s.self)}` +
              (showTeacher ? `, enseignant ${fmt(s.teacher)}` : ""),
          )
          .join(" ; ") +
        ". Détail dans le tableau qui suit.";

  const canDraw = n >= 3;
  const rings = canDraw
    ? [1, 2, 3, 4].map((level) =>
        radarPoints(Array(n).fill(level), MAX, CENTER, CENTER, RADIUS),
      )
    : [];
  const axisEnds = canDraw
    ? radarPoints(Array(n).fill(MAX), MAX, CENTER, CENTER, RADIUS)
    : [];
  const labelPoints = canDraw
    ? radarPoints(Array(n).fill(MAX), MAX, CENTER, CENTER, LABEL_RADIUS)
    : [];
  const selfPoints = canDraw
    ? radarPoints(
        scores.map((s) => s.self),
        MAX,
        CENTER,
        CENTER,
        RADIUS,
      )
    : [];
  const teacherPoints = canDraw
    ? radarPoints(
        scores.map((s) => s.teacher),
        MAX,
        CENTER,
        CENTER,
        RADIUS,
      )
    : [];

  return (
    <figure className={`flex flex-col gap-4 ${className}`}>
      {canDraw && (
        <svg
          viewBox={`0 0 ${VIEW} ${VIEW}`}
          role="img"
          aria-labelledby={`${titleId} ${descId}`}
          className="mx-auto h-auto w-full max-w-72 print:max-w-56"
        >
          <title id={titleId}>{title}</title>
          <desc id={descId}>{description}</desc>

          {/* Anneaux 1..4 */}
          {rings.map((ring, i) => (
            <polygon
              key={`ring-${i}`}
              points={toPath(ring)}
              className={`fill-none ${i === rings.length - 1 ? "stroke-muted/60" : "stroke-line"}`}
              strokeWidth={1}
            />
          ))}
          {/* Axes */}
          {axisEnds.map((p, i) => (
            <line
              key={`axis-${i}`}
              x1={CENTER}
              y1={CENTER}
              x2={p.x}
              y2={p.y}
              className="stroke-line"
              strokeWidth={1}
            />
          ))}
          {/* Graduations le long du premier axe */}
          {rings.map((ring, i) => (
            <text
              key={`tick-${i}`}
              x={ring[0].x + 4}
              y={ring[0].y + 3}
              className="fill-muted font-mono"
              fontSize={9}
            >
              {i + 1}
            </text>
          ))}

          {hasTeacher && (
            <polygon
              points={toPath(teacherPoints)}
              className="fill-ink/10 stroke-muted"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              strokeLinejoin="round"
            />
          )}
          {hasSelf && (
            <>
              <polygon
                points={toPath(selfPoints)}
                className="fill-none stroke-accent"
                strokeWidth={2.5}
                strokeLinejoin="round"
              />
              {selfPoints.map((p, i) =>
                scores[i].self != null ? (
                  <circle
                    key={`self-${i}`}
                    cx={p.x}
                    cy={p.y}
                    r={3.5}
                    className="fill-accent stroke-surface"
                    strokeWidth={1}
                  />
                ) : null,
              )}
            </>
          )}

          {/* Étiquettes des axes : code de compétence + pastille de couleur */}
          {labelPoints.map((p, i) => {
            const anchor =
              Math.abs(p.x - CENTER) < 8
                ? "middle"
                : p.x > CENTER
                  ? "start"
                  : "end";
            const dy =
              p.y < CENTER - RADIUS ? -2 : p.y > CENTER + RADIUS / 2 ? 10 : 4;
            const color = safeColor(scores[i].color);
            const dotX =
              anchor === "start"
                ? p.x - 8
                : anchor === "end"
                  ? p.x + 8
                  : p.x - 16;
            const dotY = p.y + dy - 4;
            return (
              <g key={`label-${i}`}>
                <circle
                  cx={dotX}
                  cy={dotY}
                  r={4}
                  fill={color ?? "currentColor"}
                  className={color ? "" : "text-muted"}
                />
                <text
                  x={p.x}
                  y={p.y + dy}
                  textAnchor={anchor}
                  className="fill-ink font-mono font-semibold"
                  fontSize={12}
                >
                  {scores[i].code}
                </text>
              </g>
            );
          })}
        </svg>
      )}

      <figcaption className="flex flex-col gap-3 text-sm">
        <ul
          className="flex flex-wrap gap-x-4 gap-y-1 text-muted"
          aria-hidden="true"
        >
          <li className="inline-flex items-center gap-2">
            <svg
              width="24"
              height="10"
              viewBox="0 0 24 10"
              className="shrink-0"
            >
              <line
                x1="0"
                y1="5"
                x2="24"
                y2="5"
                className="stroke-accent"
                strokeWidth={2.5}
              />
              <circle cx="12" cy="5" r="3" className="fill-accent" />
            </svg>
            Auto-positionnement
          </li>
          {showTeacher && (
            <li className="inline-flex items-center gap-2">
              <svg
                width="24"
                height="12"
                viewBox="0 0 24 12"
                className="shrink-0"
              >
                <rect
                  x="1"
                  y="1"
                  width="22"
                  height="10"
                  className="fill-ink/10 stroke-muted"
                  strokeDasharray="4 3"
                />
              </svg>
              Positionnement enseignant (publié)
            </li>
          )}
        </ul>

        {/* Légende visible (valeurs) — masquée aux lecteurs d'écran qui disposent du tableau ci-dessous */}
        <ul className="grid gap-1 sm:grid-cols-2" aria-hidden="true">
          {scores.map((s) => {
            const color = safeColor(s.color);
            return (
              <li key={s.code} className="flex items-baseline gap-2">
                <span
                  className="inline-block size-2.5 shrink-0 -translate-y-px rounded-full bg-muted"
                  style={color ? { backgroundColor: color } : undefined}
                />
                <span className="min-w-0">
                  <span className="font-mono text-xs font-semibold">
                    {s.code}
                  </span>{" "}
                  {s.name}
                  <span className="block font-mono text-xs text-muted tabular-nums">
                    auto {fmt(s.self)}
                    {showTeacher ? ` · ens. ${fmt(s.teacher)}` : ""} ·{" "}
                    {s.learnings} AC
                  </span>
                </span>
              </li>
            );
          })}
        </ul>

        {!hasSelf && !hasTeacher && (
          <p className="text-muted">
            Pas encore de données : le radar se remplit avec vos
            auto-évaluations et vos traces.
          </p>
        )}
      </figcaption>

      {/* sr-only sur un conteneur : un <table> ignore width:1px et déborderait */}
      <div className="sr-only">
        <table id={tableId}>
          <caption>
            {title} : niveaux moyens par compétence (échelle de 1 à 4)
          </caption>
          <thead>
            <tr>
              <th scope="col">Compétence</th>
              <th scope="col">Auto-positionnement</th>
              {showTeacher && <th scope="col">Positionnement enseignant</th>}
              <th scope="col">AC observés</th>
            </tr>
          </thead>
          <tbody>
            {scores.map((s) => (
              <tr key={s.code}>
                <th scope="row">
                  {s.code} {s.name}
                </th>
                <td>{s.self == null ? "Aucune donnée" : fmt(s.self)}</td>
                {showTeacher && (
                  <td>
                    {s.teacher == null ? "Aucune donnée" : fmt(s.teacher)}
                  </td>
                )}
                <td>{s.learnings}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
