import "server-only";
import { cache } from "react";
import { listFavorites, type ResolvedFavorite } from "@/lib/favorites";
import { unreadNotificationCount } from "@/lib/notify";

// Données de la coquille, mémoïsées par requête (la page d'accueil réutilise les favoris sans 2e requête).
// Une panne ici ne doit jamais casser toutes les pages : repli silencieux + trace serveur.

export const getFavorites = cache(async (userId: string): Promise<ResolvedFavorite[]> => {
  try {
    return await listFavorites(userId);
  } catch (e) {
    console.error("Coquille : favoris indisponibles", e);
    return [];
  }
});

export const getUnreadCount = cache(async (userId: string): Promise<number> => {
  try {
    return await unreadNotificationCount(userId);
  } catch (e) {
    console.error("Coquille : compteur de notifications indisponible", e);
    return 0;
  }
});
