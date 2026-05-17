"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import {
  BrainCircuit,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Shield,
  Sparkles,
  X,
} from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./theme-toggle";

type NavLink = {
  href: string;
  label: string;
  match?: string[];
  children?: { href: string; label: string }[];
};

const navLinks: NavLink[] = [
  { href: "/", label: "Home" },
  { href: "/properties", label: "Properties", match: ["/properties", "/listings"] },
  { href: "/blockchain", label: "Blockchain" },
  {
    href: "/services",
    label: "Services",
    children: [
      { href: "/services#buyers", label: "For Buyers" },
      { href: "/services#investors", label: "For Investors" },
      { href: "/services#builders", label: "For Builders" },
      { href: "/services#agents", label: "For Agents" },
    ],
  },
  { href: "/agents", label: "Agents" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

function isActivePath(pathname: string, link: NavLink) {
  const paths = link.match ?? [link.href];
  return paths.some((path) =>
    path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(`${path}/`),
  );
}

function DesktopNavLink({
  link,
  active,
}: {
  link: NavLink;
  active: boolean;
}) {
  return (
    <Link
      href={link.href}
      className={cn(
        "group relative inline-flex h-10 items-center gap-1.5 rounded-full px-1 text-[13px] font-semibold transition-all duration-300 ease-out will-change-transform",
        active
          ? "text-[#50080E]"
          : "text-[#50080E]/72 hover:-translate-y-0.5 hover:text-[#50080E]",
      )}
    >
      <span className="relative z-10">{link.label}</span>
      <span
        className={cn(
          "absolute inset-x-0 bottom-1 mx-auto h-0.5 rounded-full bg-[#D4AF37] transition-all duration-300",
          active ? "w-full opacity-100 shadow-[0_0_16px_rgba(212,175,55,0.45)]" : "w-0 opacity-0 group-hover:w-full group-hover:opacity-100",
        )}
      />
      <span className="absolute inset-0 -z-0 rounded-full bg-[#D4AF37]/0 transition-colors duration-300 group-hover:bg-[#D4AF37]/10" />
    </Link>
  );
}

function MobileNavLink({
  link,
  active,
  onClick,
}: {
  link: NavLink;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Link
      href={link.href}
      onClick={onClick}
      className={cn(
        "group flex items-center justify-between rounded-2xl border px-4 py-3 text-sm transition-all duration-300",
        active
          ? "border-[#D4AF37]/35 bg-[#D4AF37]/10 font-bold text-[#50080E] shadow-[0_10px_28px_rgba(212,175,55,0.12)]"
          : "border-transparent font-semibold text-[#50080E]/82 hover:border-[#DCCDCE]/60 hover:bg-white/45 hover:text-[#50080E]",
      )}
    >
      <span>{link.label}</span>
      <span className="h-1.5 w-1.5 rounded-full bg-[#D4AF37]/0 transition-colors group-hover:bg-[#D4AF37]" />
    </Link>
  );
}

function LogoLockup() {
  return (
    <Link
      href="/"
      className="group flex min-w-0 items-center rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]/70"
      aria-label="Aarvasa home"
    >
      <Image
        src="/aarvasa-navbar-logo.png"
        alt="Aarvasa Logo"
        width={653}
        height={169}
        sizes="(max-width: 640px) 164px, (max-width: 1024px) 184px, 206px"
        className="h-10 w-auto max-w-[164px] transition-transform duration-300 group-hover:scale-[1.03] sm:h-11 sm:max-w-[184px] lg:h-12 lg:max-w-[206px]"
        priority
      />
    </Link>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { data: session, status } = useSession();
  
  const user = session?.user;
  const authLoading = status === "loading";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 18);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSearchOpen(false);
        setOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleLogout = async () => {
    await signOut({ callbackUrl: "/" });
  };

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = searchQuery.trim();

    if (query) {
      router.push(`/listings?search=${encodeURIComponent(query)}`);
    } else {
      router.push("/listings");
    }

    setSearchOpen(false);
    setOpen(false);
  };

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 px-2 pt-2 transition-all duration-300 sm:px-4",
          scrolled ? "drop-shadow-[0_18px_42px_rgba(80,8,14,0.12)]" : "bg-transparent",
        )}
      >
        <div className="relative mx-auto max-w-7xl">
          <div className="flex h-16 items-center justify-between gap-3 rounded-2xl border border-[#DCCDCE]/45 bg-[#F2F1ED]/92 px-4 shadow-luxury-sm backdrop-blur-2xl transition-all duration-300 sm:px-6 lg:h-[4.35rem] lg:px-7">
            <div className="flex flex-1 items-center justify-start">
              <LogoLockup />
            </div>

            <nav className="hidden min-w-0 flex-1 items-center justify-center gap-5 px-4 xl:flex xl:gap-6">
              {navLinks.map((link) => (
                <DesktopNavLink
                  key={link.href}
                  link={link}
                  active={isActivePath(pathname, link)}
                />
              ))}
            </nav>

            <div className="hidden flex-1 items-center justify-end gap-2 xl:flex">
              <Button
                type="button"
                variant="glass"
                size="icon"
                onClick={() => setSearchOpen((value) => !value)}
                aria-label="Search properties"
                aria-expanded={searchOpen}
                className="h-10 w-10 rounded-full border-[#DCCDCE]/55 bg-white/35 text-[#50080E] shadow-luxury-sm hover:-translate-y-0.5 hover:border-[#D4AF37]/45 hover:bg-[#D4AF37]/10 hover:text-[#50080E]"
              >
                <Search className="h-4 w-4" />
              </Button>

              {!authLoading && user ? (
                <>
                  <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className="rounded-full px-4 text-sm text-[#50080E] hover:bg-[#50080E]/5 hover:text-[#D4AF37]"
                  >
                    <Link href="/dashboard">
                      <LayoutDashboard className="h-3.5 w-3.5" />
                      Dashboard
                    </Link>
                  </Button>
                  {(user as any).role === "ADMIN" && (
                    <Button
                      asChild
                      variant="ghost"
                      size="sm"
                      className="rounded-full px-3 text-sm text-[#50080E] hover:bg-[#50080E]/5 hover:text-[#D4AF37]"
                    >
                      <Link href="/admin">
                        <Shield className="h-3.5 w-3.5" />
                        Admin
                      </Link>
                    </Button>
                  )}
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#902941] text-sm font-bold text-white shadow-[0_8px_22px_rgba(80,8,14,0.18)]">
                    {user.name ? user.name.charAt(0).toUpperCase() : "A"}
                  </div>
                  <Button
                    onClick={handleLogout}
                    variant="gold"
                    size="sm"
                    className="rounded-full px-4 text-xs font-bold uppercase tracking-wider"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Logout
                  </Button>
                </>
              ) : !authLoading ? (
                <>
                  <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className="rounded-full px-4 text-sm text-[#50080E] hover:bg-[#50080E]/5 hover:text-[#D4AF37]"
                  >
                    <Link href="/login">Login</Link>
                  </Button>
                  <Button
                    asChild
                    variant="gold"
                    size="sm"
                    className="rounded-full px-5 text-xs font-bold uppercase tracking-wider shadow-[0_10px_26px_rgba(212,175,55,0.26)]"
                  >
                    <Link href="/dashboard">
                      <LayoutDashboard className="h-3.5 w-3.5" />
                      Dashboard
                    </Link>
                  </Button>
                </>
              ) : (
                <div className="h-9 w-32 animate-pulse rounded-full bg-[#DCCDCE]/35" />
              )}
            </div>

            <div className="flex items-center gap-2 xl:hidden">
              <Button
                type="button"
                variant="glass"
                size="icon"
                onClick={() => setSearchOpen((value) => !value)}
                aria-label="Search properties"
                aria-expanded={searchOpen}
                className="h-9 w-9 rounded-full bg-white/35 text-[#50080E]"
              >
                <Search className="h-4 w-4" />
              </Button>
              <Button
                variant="glass"
                size="icon"
                onClick={() => setOpen((value) => !value)}
                aria-label={open ? "Close navigation" : "Open navigation"}
                aria-expanded={open}
                className="h-9 w-9 rounded-full bg-white/35 text-[#50080E]"
              >
                {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {searchOpen ? (
            <div className="absolute right-0 top-[calc(100%+0.5rem)] w-full max-w-md animate-fade-up rounded-2xl border border-[#DCCDCE]/55 bg-[#F2F1ED]/96 p-3 shadow-luxury-lg backdrop-blur-2xl sm:right-2">
              <form onSubmit={handleSearch} className="flex items-center gap-2">
                <label htmlFor="navbar-search" className="sr-only">
                  Search properties
                </label>
                <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-[#DCCDCE]/60 bg-white/60 px-4 py-2 text-[#50080E] shadow-inner">
                  <Search className="h-4 w-4 flex-shrink-0 text-[#D4AF37]" aria-hidden="true" />
                  <input
                    id="navbar-search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search city, ROI, property type"
                    autoFocus
                    className="min-w-0 flex-1 bg-transparent text-sm font-medium text-[#50080E] outline-none placeholder:text-[#72383D]/55"
                  />
                </div>
                <Button type="submit" variant="gold" size="sm" className="rounded-full px-4">
                  Search
                </Button>
              </form>
            </div>
          ) : null}

          {open ? (
            <div className="animate-fade-up xl:hidden">
              <div className="mt-2 rounded-2xl border border-[#DCCDCE]/45 bg-[#F2F1ED]/97 p-3 shadow-luxury-lg backdrop-blur-2xl">
                <div className="mb-3 flex items-center justify-between rounded-2xl border border-[#DCCDCE]/35 bg-white/35 px-4 py-3">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#50080E]/70">
                    <Sparkles className="h-3.5 w-3.5 text-[#D4AF37]" />
                    Investor Navigation
                  </div>
                  <div className="rounded-full bg-[#50080E] p-1 text-white sm:hidden">
                    <ThemeToggle />
                  </div>
                </div>

                <div className="grid gap-1.5 md:grid-cols-2">
                  {navLinks.map((link) => (
                    <MobileNavLink
                      key={link.href}
                      link={link}
                      active={isActivePath(pathname, link)}
                      onClick={() => setOpen(false)}
                    />
                  ))}
                </div>

                <div className="mt-3 grid gap-2 border-t border-[#DCCDCE]/45 pt-3 sm:grid-cols-2">
                  {!authLoading && user ? (
                    <>
                      <div className="flex items-center justify-center gap-2 rounded-full border border-[#DCCDCE]/70 bg-white/40 px-3 py-2 text-sm font-bold text-[#50080E]">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#902941] text-xs text-white">
                          {user.name ? user.name.charAt(0).toUpperCase() : "A"}
                        </div>
                        <span className="truncate">{user.name ? user.name.split(" ")[0] : "User"}</span>
                      </div>
                      <Button
                        onClick={() => {
                          handleLogout();
                          setOpen(false);
                        }}
                        variant="gold"
                        size="sm"
                        className="rounded-full"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        Logout
                      </Button>
                    </>
                  ) : !authLoading ? (
                    <>
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        onClick={() => setOpen(false)}
                        className="rounded-full bg-white/35"
                      >
                        <Link href="/login">Login</Link>
                      </Button>
                      <Button
                        asChild
                        variant="gold"
                        size="sm"
                        onClick={() => setOpen(false)}
                        className="rounded-full"
                      >
                        <Link href="/dashboard">
                          <LayoutDashboard className="h-3.5 w-3.5" />
                          Dashboard
                        </Link>
                      </Button>
                    </>
                  ) : (
                    <div className="h-10 animate-pulse rounded-full bg-[#DCCDCE]/35 sm:col-span-2" />
                  )}
                </div>

                <div className="mt-3 rounded-2xl border border-[#D4AF37]/20 bg-[#D4AF37]/10 px-4 py-3">
                  <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#50080E]/75">
                    <BrainCircuit className="h-3.5 w-3.5 text-[#D4AF37]" />
                    AI-ranked property intelligence
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </header>

      <div className="fixed inset-x-4 bottom-4 z-40 md:hidden">
        <Button asChild className="h-12 w-full rounded-xl shadow-[0_16px_38px_rgba(80,8,14,0.18)]">
          <Link href="/listings">Explore Properties</Link>
        </Button>
      </div>
    </>
  );
}
