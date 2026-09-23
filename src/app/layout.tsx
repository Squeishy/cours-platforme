import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, JetBrains_Mono, Source_Sans_3 } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/session";
import "./globals.css";

// Trois familles, graisses limitées (DESIGN.md « Risque assumé ») ; next/font les auto-héberge.
const display = Bricolage_Grotesque({ variable: "--ff-display", subsets: ["latin"], weight: "600", display: "swap" });
const body = Source_Sans_3({ variable: "--ff-body", subsets: ["latin"], weight: ["400", "600"], display: "swap" });
const mono = JetBrains_Mono({ variable: "--ff-mono", subsets: ["latin"], weight: "500", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Cours & SAÉ — BUT MMI", template: "%s — Cours & SAÉ" },
  description: "Cours, sujets de SAÉ, jalons et auto-évaluations du département MMI.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#1e1c19" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();

  return (
    <html lang="fr" className={`${display.variable} ${body.variable} ${mono.variable} antialiased`}>
      <body className="min-h-[100dvh]">
        <a href="#contenu" className="skip-link">
          Aller au contenu
        </a>
        {user ? (
          <AppShell user={user}>{children}</AppShell>
        ) : (
          <div className="flex min-h-[100dvh] flex-col">
            <SiteHeader />
            <main id="contenu" tabIndex={-1} className="public-main mx-auto w-full max-w-6xl flex-1 py-8 outline-none md:py-12">
              {children}
            </main>
            <SiteFooter />
          </div>
        )}
      </body>
    </html>
  );
}
