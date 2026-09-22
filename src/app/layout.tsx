import type { Metadata } from "next";
import { Source_Sans_3 } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const body = Source_Sans_3({ variable: "--font-body", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Cours & SAÉ", template: "%s — Cours & SAÉ" },
  description: "Cours, sujets de SAÉ et auto-évaluations des étudiants.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${body.variable} antialiased`}>
      <body className="flex min-h-[100dvh] flex-col">
        <SiteHeader />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 md:px-6">{children}</main>
      </body>
    </html>
  );
}
