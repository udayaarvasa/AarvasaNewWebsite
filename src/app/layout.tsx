import type { Metadata } from "next";
import { Navbar } from "@/components/layout/navbar";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { LuxuryFooter } from "@/components/shared/luxury-footer";
import "./globals.css";

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
    <html lang="en" data-theme="light">
      <body className="flex min-h-screen flex-col antialiased">
        <ThemeProvider>
          <Navbar />
          <main className="flex-1">{children}</main>
          <LuxuryFooter />
        </ThemeProvider>
      </body>
    </html>
  );
}
