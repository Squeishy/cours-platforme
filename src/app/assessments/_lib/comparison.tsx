// Vue « auto / enseignant » en lecture seule, critère par critère.
import { isSignificantGap } from "@/lib/competences";
import type { CriterionView } from "./shared";
import { CriterionHeading, GapFlag, LevelMeter } from "./ui";

export type ComparisonCriterion = CriterionView & {
  self: { level: number; justification: string | null } | null;
  teacher: { level: number | null; comment: string | null } | null;
};

type Props = {
  criteria: ComparisonCriterion[];
  /** Colonnes enseignant (équipe, ou étudiant·e une fois le retour publié — jamais les pairs) */
  showTeacher: boolean;
  /** Retour non publié : l'équipe voit une mention « brouillon » */
  teacherDraft?: boolean;
  headingLevel?: 3 | 4;
};

export function CriteriaComparison({ criteria, showTeacher, teacherDraft = false, headingLevel = 3 }: Props) {
  if (criteria.length === 0) return <p className="text-muted">Aucun critère défini pour ce jalon.</p>;

  return (
    <ol className="flex flex-col gap-3">
      {criteria.map((criterion) => {
        const selfLevel = criterion.self?.level ?? null;
        const teacherLevel = criterion.teacher?.level ?? null;
        const gap = showTeacher && isSignificantGap(selfLevel, teacherLevel);
        return (
          <li key={criterion.id} className="card flex flex-col gap-3">
            <CriterionHeading criterion={criterion} level={headingLevel} />
            {gap && selfLevel != null && teacherLevel != null && (
              <p>
                <GapFlag self={selfLevel} teacher={teacherLevel} />
              </p>
            )}
            <div className={showTeacher ? "grid gap-4 md:grid-cols-2" : "flex flex-col"}>
              <div className="flex flex-col gap-2">
                {showTeacher && <p className="eyebrow">Auto-positionnement</p>}
                {criterion.self ? (
                  <>
                    <LevelMeter level={criterion.self.level} prefix={showTeacher ? undefined : "Auto"} />
                    {criterion.self.justification ? (
                      <p className="max-w-prose break-words whitespace-pre-line">{criterion.self.justification}</p>
                    ) : (
                      <p className="text-sm text-muted">Pas de justification.</p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted">Niveau non renseigné.</p>
                )}
              </div>
              {showTeacher && (
                <div className="flex flex-col gap-2 border-t border-line pt-3 md:border-t-0 md:border-l md:pt-0 md:pl-4">
                  <p className="eyebrow">Enseignant{teacherDraft ? " · brouillon non publié" : ""}</p>
                  {teacherLevel != null ? (
                    <LevelMeter level={teacherLevel} tone="teacher" />
                  ) : (
                    <p className="text-sm text-muted">Pas de niveau enseignant.</p>
                  )}
                  {criterion.teacher?.comment && (
                    <p className="max-w-prose break-words whitespace-pre-line">{criterion.teacher.comment}</p>
                  )}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
