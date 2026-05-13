"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  { href: "/about", label: "About" },
  { href: "/services", label: "Services" },
  { href: "/blockchain", label: "Blockchain" },
  { href: "/ai-chat", label: "AI" },
  { href: "/listings", label: "Listings" },
];

export function Navbar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<{name: string, email: string} | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        setUser(data.user);
      })
      .finally(() => {
        setAuthLoading(false);
      });
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    window.location.reload();
  };

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
            {links.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "text-sm transition-colors relative group",
                    isActive
                      ? "font-bold text-[#D4AF37]"
                      : "font-medium text-[#50080E]/80 hover:text-[#D4AF37]"
                  )}
                >
                  {link.label}
                  {isActive && (
                    <span className="absolute -bottom-1 left-0 h-0.5 w-full rounded-full bg-[#D4AF37]" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right actions */}
          <div className="hidden min-w-40 items-center justify-end gap-3 md:flex">
            {!authLoading && user ? (
              <>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#902941] text-sm font-bold text-white shadow-sm">
                  {user.name ? user.name.charAt(0).toUpperCase() : "A"}
                </div>
                <Button onClick={handleLogout} variant="gold" size="sm" className="rounded-lg px-5 text-xs font-bold uppercase tracking-wider">
                  Logout
                </Button>
              </>
            ) : !authLoading ? (
              <>
                <Button asChild variant="ghost" size="sm" className="text-sm text-[#50080E] hover:bg-transparent hover:text-[#D4AF37]">
                  <Link href="/login">Login</Link>
                </Button>
                <Button asChild variant="gold" size="sm" className="rounded-lg px-5 text-xs font-bold uppercase tracking-wider">
                  <Link href="/dashboard">Dashboard</Link>
                </Button>
              </>
            ) : (
              <div className="h-9 w-32 animate-pulse rounded-md bg-[#DCCDCE]/30" />
            )}
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
              {links.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition",
                      isActive
                        ? "bg-[#50080E]/5 font-bold text-[#D4AF37]"
                        : "font-medium text-[#50080E] hover:bg-[#DCCDCE]/20"
                    )}
                  >
                    {link.label}
                  </Link>
                );
              })}
              <div className="mt-2 grid grid-cols-2 gap-2">
                {!authLoading && user ? (
                  <>
                    <div className="flex items-center justify-center gap-2 rounded-md border border-[#DCCDCE] px-3 py-1.5 text-sm font-bold text-[#50080E]">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#902941] text-xs text-white">
                        {user.name ? user.name.charAt(0).toUpperCase() : "A"}
                      </div>
                      <span className="truncate">{user.name.split(" ")[0]}</span>
                    </div>
                    <Button onClick={() => { handleLogout(); setOpen(false); }} variant="gold" size="sm">
                      Logout
                    </Button>
                  </>
                ) : !authLoading ? (
                  <>
                    <Button asChild variant="outline" size="sm" onClick={() => setOpen(false)}>
                      <Link href="/login">Login</Link>
                    </Button>
                    <Button asChild variant="gold" size="sm" onClick={() => setOpen(false)}>
                      <Link href="/dashboard">Dashboard</Link>
                    </Button>
                  </>
                ) : null}
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
