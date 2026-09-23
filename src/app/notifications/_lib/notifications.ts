// Logique pure de la page /notifications (testée dans notifications.test.ts).

export const NOTIFICATIONS_PAGE_SIZE = 30;

/** Les notifications lues de plus de 90 jours sont supprimées à la visite */
export const READ_RETENTION_DAYS = 90;

/** Nombre maximal de suppressions par visite (nettoyage bon marché, borné) */
export const CLEANUP_BATCH = 200;

const TYPE_LABELS: Record<string, string> = {
  comment: "Commentaire",
  feedback: "Retour enseignant",
  announcement: "Annonce",
  question: "Question",
  answer: "Réponse",
  defense: "Soutenance",
  showcase: "Vitrine",
  reopen: "Auto-évaluation rouverte",
};

export function notificationTypeLabel(type: string) {
  return TYPE_LABELS[type] ?? "Notification";
}

const ORIGIN_PROBE = "https://origine.invalid";

/**
 * Chemin interne sûr pour une redirection : commence par « / », jamais « // » ni « /\ »,
 * sans caractère de contrôle ni espace, et reste sur la même origine une fois résolu.
 * Renvoie null sinon (on reste alors sur /notifications).
 */
export function safeInternalPath(link: string | null | undefined): string | null {
  if (typeof link !== "string") return null;
  if (link.length === 0 || link.length > 2048) return null;
  if (!link.startsWith("/") || link.startsWith("//")) return null;
  if (/[\\\s\u0000-\u001f\u007f]/.test(link)) return null;
  try {
    if (new URL(link, ORIGIN_PROBE).origin !== ORIGIN_PROBE) return null;
  } catch {
    return null;
  }
  return link;
}

/** Numéro de page lu dans l'URL (entier ≥ 1, borné) */
export function parsePage(raw: string | string[] | undefined, max = 1000) {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const n = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, max);
}

type Slice = { skip: number; take: number };

/**
 * Pagination d'une liste « non lues d'abord, puis lues », chacune de la plus récente à la plus ancienne.
 * Renvoie la tranche à lire dans chacune des deux requêtes pour la page demandée.
 */
export function pageSlices(page: number, pageSize: number, unreadCount: number): { unread: Slice; read: Slice } {
  const offset = (Math.max(1, page) - 1) * pageSize;
  const unreadTake = Math.max(0, Math.min(pageSize, unreadCount - offset));
  return {
    unread: { skip: Math.min(offset, unreadCount), take: unreadTake },
    read: { skip: Math.max(0, offset - unreadCount), take: pageSize - unreadTake },
  };
}

export function pageCount(total: number, pageSize: number) {
  return Math.max(1, Math.ceil(total / pageSize));
}
