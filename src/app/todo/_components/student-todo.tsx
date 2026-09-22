import Link from "next/link";
import type { ReactNode } from "react";
import { formatDateShort, formatTime } from "@/lib/format";
import { LINK_STATUS_LABELS } from "@/lib/link-check-core";
import { loadStudentTodo, type StudentItem, type StudentMilestoneItem } from "../_lib/queries";
import { ASSESSMENT_LABELS, BUCKET_LABELS, groupByBucket, nextStudentAction, plural, type Bucket } from "../_lib/todo";
import { EmptyState } from "@/components/ui";
import { DeadlineChip, TodoSection, saeLabel } from "./ui";

function Row({ chip, children, action }: { chip: ReactNode; children: ReactNode; action?: ReactNode }) {
  return (
    <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:gap-4">
      <div className="shrink-0 sm:w-36">{chip}</div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">{children}</div>
      {action && <div className="shrink-0 sm:self-center">{action}</div>}
    </li>
  );
}

function MilestoneRow({ item, now }: { item: StudentMilestoneItem; now: Date }) {
  const complete = item.progress.done && !item.deposit.problem;
  const next = nextStudentAction({
    saeId: item.sae.id,
    milestoneId: item.milestoneId,
    groupId: item.groupId,
    hasCriteria: item.hasCriteria,
    assessmentId: item.assessment.id,
    assessmentStatus: item.assessment.status,
    feedbackPublished: item.assessment.feedbackPublished,
    depositRequired: item.deposit.required,
    depositCount: item.deposit.count,
    depositProblem: item.deposit.problem,
    peerPending: item.peer.pending,
  });
  const status = item.assessment.status;

  return (
    <Row
      chip={<DeadlineChip due={item.due} now={now} done={complete} showDate />}
      action={
        next && (
          <Link href={next.href} className={`btn w-full sm:w-auto ${next.primary ? "btn-primary" : ""}`}>
            {next.label}
          </Link>
        )
      }
    >
      <span className="font-mono text-xs break-words text-muted">{saeLabel(item.sae)}</span>
      <Link href={`/saes/${item.sae.id}/milestones/${item.milestoneId}`} className="inline-flex min-h-11 items-center font-medium break-words hover:underline sm:min-h-0">
        {item.title}
      </Link>
      <ul aria-label="État du jalon" className="flex flex-wrap gap-1.5">
        {item.hasCriteria && (
          <li className={`badge ${status === "SUBMITTED" ? "badge-ok" : status === "DRAFT" ? "badge-warn" : ""}`}>
            Auto-évaluation : {ASSESSMENT_LABELS[status ?? "NONE"]}
          </li>
        )}
        {item.assessment.feedbackPublished && <li className="badge badge-ok">Retour enseignant publié</li>}
        {item.deposit.required && item.deposit.count === 0 && <li className="badge badge-danger">URL de dépôt manquante</li>}
        {item.deposit.problem && (
          <li className={`badge ${item.deposit.problem === "BROKEN" ? "badge-danger" : "badge-warn"}`}>
            Lien : {LINK_STATUS_LABELS[item.deposit.problem]}
          </li>
        )}
        {item.deposit.required && item.deposit.count > 0 && !item.deposit.problem && <li className="badge badge-ok">URL déposée</li>}
        {item.peer.pending > 0 && (
          <li className="badge badge-warn">
            {plural(item.peer.pending, "coéquipier")} à évaluer
          </li>
        )}
      </ul>
    </Row>
  );
}

function ItemRow({ item, now }: { item: StudentItem; now: Date }) {
  if (item.kind === "milestone") return <MilestoneRow item={item} now={now} />;
  if (item.kind === "defense") {
    const end = new Date(item.due.getTime() + item.durationMin * 60_000);
    return (
      <Row
        chip={<DeadlineChip due={item.due} now={now} showDate />}
        action={
          <Link href={`/saes/${item.sae.id}/defenses`} className="btn w-full sm:w-auto">
            Voir le créneau
          </Link>
        }
      >
        <span className="font-mono text-xs break-words text-muted">{saeLabel(item.sae)}</span>
        <span className="font-medium">Soutenance · {item.groupName}</span>
        <span className="text-sm text-muted">
          {formatTime(item.due)} – {formatTime(end)}
          {item.location ? ` · ${item.location}` : ""}
        </span>
      </Row>
    );
  }
  return (
    <Row
      chip={<DeadlineChip due={item.due} now={now} showDate />}
      action={
        <Link href={`/saes/${item.sae.id}/defenses`} className="btn btn-primary w-full sm:w-auto">
          Réserver un créneau
        </Link>
      }
    >
      <span className="font-mono text-xs break-words text-muted">{saeLabel(item.sae)}</span>
      <span className="font-medium">Soutenance à réserver</span>
      <span className="text-sm text-muted">
        {plural(item.freeSlots, "créneau libre", "créneaux libres")} · premier créneau le {formatDateShort(item.due)}
      </span>
    </Row>
  );
}

const EMPTY: Record<Bucket, string> = {
  overdue: "Rien en retard. Bravo.",
  week: "Rien à rendre dans les 7 prochains jours.",
  later: "Aucune échéance plus lointaine pour l'instant.",
};

const HINT: Record<Bucket, string | undefined> = {
  overdue: "Échéance dépassée : terminez au plus vite ou prévenez votre enseignant.",
  week: "Les 7 prochains jours.",
  later: undefined,
};

export async function StudentTodo({ userId, now }: { userId: string; now: Date }) {
  const { hasGroups, items } = await loadStudentTodo(userId, now);

  if (!hasGroups) {
    return (
      <EmptyState
        title="Vous n'êtes membre d'aucun groupe de SAÉ publiée."
        action={
          <Link href="/saes" className="btn">
            Voir les SAÉ
          </Link>
        }
      >
        Dès que l&apos;équipe pédagogique vous aura placé·e dans un groupe, vos jalons, dépôts et soutenances apparaîtront
        ici.
      </EmptyState>
    );
  }

  const buckets = groupByBucket(items, now);
  const order: Bucket[] = ["overdue", "week", "later"];
  // Le résumé ne compte que ce qui demande encore une action (les jalons « Fait » restent visibles dans la liste)
  const pending = (b: Bucket) => buckets[b].filter((i) => !(i.kind === "milestone" && i.progress.done && !i.deposit.problem)).length;
  const counts = { overdue: pending("overdue"), week: pending("week"), later: pending("later") };

  return (
    <div className="flex flex-col gap-8">
      <nav className="flex flex-wrap gap-2" aria-label="Résumé">
        <a href="#en-retard" className={`badge min-h-11 px-3 text-sm ${counts.overdue ? "badge-danger" : ""}`}>
          {counts.overdue} en retard
        </a>
        <a href="#cette-semaine" className={`badge min-h-11 px-3 text-sm ${counts.week ? "badge-warn" : ""}`}>
          {counts.week} à faire cette semaine
        </a>
        <a href="#plus-tard" className="badge min-h-11 px-3 text-sm">
          {counts.later} à faire plus tard
        </a>
      </nav>

      {order.map((b) => (
        <TodoSection
          key={b}
          id={b === "overdue" ? "en-retard" : b === "week" ? "cette-semaine" : "plus-tard"}
          title={BUCKET_LABELS[b]}
          count={buckets[b].length}
          hint={buckets[b].length ? HINT[b] : undefined}
          isEmpty={buckets[b].length === 0}
          empty={EMPTY[b]}
          tone={b === "overdue" ? "danger" : "default"}
        >
          {buckets[b].map((item) => (
            <ItemRow key={item.key} item={item} now={now} />
          ))}
        </TodoSection>
      ))}
    </div>
  );
}
