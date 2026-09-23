import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "./cx";

/**
 * PageHeader — fil d'Ariane, surtitre mono, H1, chapeau, méta, actions à droite (≥ 768 px).
 *
 *   <PageHeader
 *     breadcrumbs={[{ label: "SAÉ", href: "/saes" }, { label: "SAÉ 2.03" }]}
 *     eyebrow="SAÉ 2.03 · S2"
 *     title="Concevoir un site web avec une source de données"
 *     lead="Chapeau d'une ou deux phrases."
 *     meta={<><span>6 jalons</span><span>4 groupes</span></>}
 *     actions={<Link className="btn btn-primary" href="…">Gérer</Link>}
 *   />
 */
export type Crumb = { label: string; href?: string };

type Props = {
  title: ReactNode;
  eyebrow?: ReactNode;
  lead?: ReactNode;
  /** Éléments courts, rendus en mono et séparés par des points médians */
  meta?: ReactNode;
  actions?: ReactNode;
  breadcrumbs?: Crumb[];
  className?: string;
};

export function PageHeader({ title, eyebrow, lead, meta, actions, breadcrumbs, className }: Props) {
  return (
    <header className={cx("flex flex-col gap-4 border-b border-line pb-6 md:flex-row md:items-end md:justify-between", className)}>
      <div className="flex min-w-0 flex-col gap-2">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav aria-label="Fil d'Ariane">
            <ol className="flex flex-wrap items-center gap-x-1.5 text-sm text-muted">
              {breadcrumbs.map((c, i) => (
                <li key={`${c.label}-${i}`} className="flex min-w-0 items-center gap-1.5">
                  {i > 0 && (
                    <span aria-hidden="true" className="text-line-strong">
                      /
                    </span>
                  )}
                  {c.href ? (
                    <Link href={c.href} className="break-words hover:text-ink hover:underline">
                      {c.label}
                    </Link>
                  ) : (
                    <span aria-current="page" className="break-words text-ink">
                      {c.label}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        )}
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="text-2xl font-semibold break-words">{title}</h1>
        {lead && <div className="max-w-prose text-muted">{lead}</div>}
        {meta && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-muted [&>*+*]:before:mr-3 [&>*+*]:before:content-['·']">
            {meta}
          </div>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2 md:shrink-0 md:justify-end">{actions}</div>}
    </header>
  );
}
