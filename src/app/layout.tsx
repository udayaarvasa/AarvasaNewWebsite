import type { Metadata } from "next";
import { Bodoni_Moda, IBM_Plex_Mono, Inter } from "next/font/google";
import { Navbar } from "@/components/layout/navbar";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { LuxuryFooter } from "@/components/shared/luxury-footer";
import { SessionProvider } from "@/components/auth/session-provider";
import { FloatingActions } from "@/components/shared/floating-actions";
import { Toaster } from "react-hot-toast";
import "./globals.css";

/* Three faces, three jobs.
   Bodoni  — property and project identity, page titles, the hero line.
   Inter   — every interface surface and all running copy.
   Plex Mono — restrained metadata: slugs, capability marks, level counts. */
const bodoni = Bodoni_Moda({
  subsets: ["latin"],
  weight: ["400", "600"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-bodoni",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-inter",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-plex-mono",
});

export const metadata: Metadata = {
  title: "Aarvasa | AI Real Estate Investment Platform",
  description:
    "A premium PropTech platform for AI-powered real estate recommendations, ROI insights, and investment dashboards.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${bodoni.variable} ${inter.variable} ${plexMono.variable}`}>
      <body className="flex min-h-screen flex-col antialiased">
        <SessionProvider>
          <ThemeProvider>
            <Navbar />
            <main className="flex-1">{children}</main>
            <LuxuryFooter />
            <FloatingActions />
            <Toaster position="top-center" />
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
