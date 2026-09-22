import Link from "next/link";
import type { PageNode } from "../_lib/tree";

type Props = { nodes: PageNode[]; slug: string; currentId?: string; depth?: number };

/** Sommaire imbriqué d'un cours */
export function PageTree({ nodes, slug, currentId, depth = 0 }: Props) {
  return (
    <ol className={depth === 0 ? "flex flex-col" : "ml-4 flex flex-col border-l border-line pl-2"}>
      {nodes.map((node) => {
        const current = node.id === currentId;
        return (
          <li key={node.id}>
            <Link
              href={`/courses/${slug}/pages/${node.id}`}
              aria-current={current ? "page" : undefined}
              className={`flex min-h-11 items-center rounded-md px-2 break-words hover:bg-bg ${
                current ? "font-semibold text-accent" : ""
              }`}
            >
              {node.title}
            </Link>
            {node.children.length > 0 && (
              <PageTree nodes={node.children} slug={slug} currentId={currentId} depth={depth + 1} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
