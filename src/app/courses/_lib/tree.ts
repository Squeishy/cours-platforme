export type FlatPage = { id: string; title: string; parentId: string | null; position: number };
export type PageNode = FlatPage & { children: PageNode[] };

/** Construit l'arbre des pages (parentId) trié par position */
export function buildPageTree(pages: FlatPage[]): PageNode[] {
  const nodes = new Map<string, PageNode>();
  for (const p of pages) nodes.set(p.id, { ...p, children: [] });

  const roots: PageNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  const sort = (list: PageNode[]) => {
    list.sort((a, b) => a.position - b.position || a.title.localeCompare(b.title, "fr"));
    for (const n of list) sort(n.children);
  };
  sort(roots);
  return roots;
}

/** Ancêtres d'une page, de la racine vers le parent direct */
export function pageAncestors(pages: FlatPage[], pageId: string): FlatPage[] {
  const byId = new Map(pages.map((p) => [p.id, p]));
  const chain: FlatPage[] = [];
  const seen = new Set<string>([pageId]);
  let current = byId.get(pageId)?.parentId ?? null;
  while (current && !seen.has(current)) {
    const parent = byId.get(current);
    if (!parent) break;
    chain.unshift(parent);
    seen.add(current);
    current = parent.parentId;
  }
  return chain;
}
