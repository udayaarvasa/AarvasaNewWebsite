"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Building2,
  ChevronRight,
  Menu,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Home" },
  { href: "/listings", label: "Buy" },
  { href: "/services", label: "Invest" },
  { href: "/ai-chat", label: "AI Insights" },
  { href: "/blockchain", label: "Fractional" },
  { href: "/about", label: "About" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 18);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 px-2 pt-2 transition-all duration-300 sm:px-4",
          scrolled
            ? "drop-shadow-[0_8px_32px_rgba(80,8,14,0.08)]"
            : "bg-transparent",
        )}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between rounded-2xl border border-[#DCCDCE]/40 bg-[#F2F1ED]/95 px-5 shadow-luxury-sm backdrop-blur-2xl sm:px-8">
          {/* Logo */}
          <Link href="/" className="flex min-w-40 items-center gap-2.5">
            <span className="relative flex h-10 w-10 items-center justify-center">
              <span className="absolute h-8 w-8 rotate-45 rounded-lg bg-gradient-to-br from-[#f5d27a] via-[#f0a83a] to-[#72383D]" />
              <span className="relative text-lg font-black text-white">A</span>
            </span>
            <span className="hidden leading-none sm:block">
              <span className="block text-sm font-black uppercase tracking-[0.2em] text-[#50080E]">
                Aarvasa
              </span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-8 lg:flex">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-[#50080E]/80 transition hover:text-[#D4AF37]"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right actions */}
          <div className="hidden min-w-40 items-center justify-end gap-3 md:flex">
            <Button asChild variant="ghost" size="sm" className="text-sm text-[#50080E] hover:bg-transparent hover:text-[#D4AF37]">
              <Link href="/login">Login</Link>
            </Button>
            <Button asChild variant="gold" size="sm" className="rounded-lg px-5 text-xs font-bold uppercase tracking-wider">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
            <div className="rounded-full bg-[#50080E] p-1 text-white">
              <ThemeToggle />
            </div>
          </div>

          {/* Mobile toggle */}
          <div className="flex items-center gap-2 lg:hidden">
            <div className="rounded-full bg-[#50080E] p-1 text-white">
              <ThemeToggle />
            </div>
            <Button
              variant="glass"
              size="icon"
              onClick={() => setOpen((value) => !value)}
              aria-label="Open navigation"
              className="h-9 w-9"
            >
              {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Mobile menu */}
        {open ? (
          <div className="mt-1 rounded-2xl border border-[#DCCDCE]/40 bg-[#F2F1ED]/98 p-4 shadow-luxury backdrop-blur-2xl lg:hidden">
            <div className="grid gap-1.5">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-[#50080E] transition hover:bg-[#DCCDCE]/20"
                >
                  {link.label}
                </Link>
              ))}
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href="/login">Login</Link>
                </Button>
                <Button asChild variant="gold" size="sm">
                  <Link href="/dashboard">Dashboard</Link>
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </header>

      {/* Mobile bottom CTA */}
      <div className="fixed inset-x-4 bottom-4 z-40 md:hidden">
        <Button asChild className="h-12 w-full rounded-xl">
          <Link href="/listings">Explore Properties</Link>
        </Button>
      </div>
    </>
  );
}
