// Composants d'interface partagés — direction « la table de montage » (docs/DESIGN.md).
// Tous sont purs (sans "use client") : utilisables dans les composants serveur et client.
export { Icon, type IconName } from "./icon";
export { cx } from "./cx";
export { PageHeader, type Crumb } from "./page-header";
export {
  StatusBadge,
  AssessmentStatusBadge,
  ASSESSMENT_STATUS,
  type StatusTone,
  type AssessmentStatusValue,
} from "./status-badge";
export { DeadlineChip } from "./deadline-chip";
export { ProgressRing } from "./progress-ring";
export { EmptyState } from "./empty-state";
export {
  MilestoneTrack,
  type MilestoneTrackProps,
  type TrackMilestone,
  type MilestoneStatus,
} from "./milestone-track";
export { CompetenceChip, competenceIndex } from "./competence-chip";
