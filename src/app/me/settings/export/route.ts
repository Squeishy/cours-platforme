import { getCurrentUser } from "@/lib/session";
import { buildPersonalExport } from "../_lib/personal-export";

export const dynamic = "force-dynamic";

/** GET /me/settings/export — téléchargement JSON de ses propres données (session requise) */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return new Response("Connexion requise.", {
      status: 401,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  const data = await buildPersonalExport(user.id);
  if (!data) {
    return new Response("Compte introuvable.", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  const day = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
  return new Response(JSON.stringify(data, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="mes-donnees-cours-sae-${day}.json"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
