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

/**
 * Pages groupées par profondeur (racines d'abord) : pour recopier un arbre en insérant
 * toujours les parents avant leurs enfants. Une page dont le parent est introuvable est traitée comme racine.
 */
export function pagesByDepth<T extends { id: string; parentId: string | null }>(pages: T[]): T[][] {
  const ids = new Set(pages.map((p) => p.id));
  const children = new Map<string | null, T[]>();
  for (const p of pages) {
    const key = p.parentId && ids.has(p.parentId) ? p.parentId : null;
    const list = children.get(key);
    if (list) list.push(p);
    else children.set(key, [p]);
  }
  const levels: T[][] = [];
  const seen = new Set<string>();
  let current = children.get(null) ?? [];
  while (current.length > 0) {
    const level = current.filter((p) => !seen.has(p.id));
    level.forEach((p) => seen.add(p.id));
    if (level.length === 0) break;
    levels.push(level);
    current = level.flatMap((p) => children.get(p.id) ?? []);
  }
  return levels;
}

/** Ordre de lecture (parcours en profondeur du sommaire) : pour « page précédente / suivante » */
export function readingOrder(nodes: PageNode[]): PageNode[] {
  return nodes.flatMap((n) => [n, ...readingOrder(n.children)]);
}
