import type { ReactNode } from "react";
import { Icon, type IconName } from "./icon";
import { cx } from "./cx";

/**
 * EmptyState — une phrase utile + l'action suivante, jamais un simple « Aucun résultat ».
 *
 *   <EmptyState title="Aucun jalon" action={<Link className="btn" href="…">Ajouter un jalon</Link>}>
 *     Ajoutez le premier pour que les étudiants voient l'échéance.
 *   </EmptyState>
 */
type Props = {
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
  icon?: IconName;
  className?: string;
};

export function EmptyState({ title, children, action, icon, className }: Props) {
  return (
    <div
      className={cx(
        "flex flex-col items-start gap-3 rounded-lg border border-dashed border-line-strong/40 bg-surface/60 p-4 md:p-5",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        {icon && <Icon name={icon} className="mt-0.5 shrink-0 text-muted" />}
        <div className="flex min-w-0 flex-col gap-1">
          {title && <p className="font-semibold text-ink">{title}</p>}
          {children && <div className="max-w-prose text-muted">{children}</div>}
        </div>
      </div>
      {action && <div className="flex flex-wrap gap-2">{action}</div>}
    </div>
  );
}
