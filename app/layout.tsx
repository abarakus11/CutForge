import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { BRAND } from "@/config/constants";
import "@/styles/globals.css";

const SITE_URL = "https://cutforge.ai";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${BRAND.name} — Cortes virais com IA`,
    template: `%s • ${BRAND.name}`,
  },
  description: BRAND.slogan,
  keywords: [
    "cortes virais",
    "YouTube Shorts",
    "TikTok",
    "Reels",
    "IA",
    "editor de vídeo",
    "clips",
  ],
  authors: [{ name: BRAND.author }],
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: SITE_URL,
    title: `${BRAND.name} — Cortes virais com IA`,
    description: BRAND.slogan,
    siteName: BRAND.name,
  },
  twitter: {
    card: "summary_large_image",
    title: `${BRAND.name} — Cortes virais com IA`,
    description: BRAND.slogan,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#07080C",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="pt-BR"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen font-sans">
        <Navbar />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
