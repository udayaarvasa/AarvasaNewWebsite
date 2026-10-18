"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, LayoutDashboard, LogOut, Menu, Search, Shield, X } from "lucide-react";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { useNavOverlay } from "./nav-overlay";

/**
 * Global navigation — a floating glass bar.
 *
 *   over a hero   clear glass, wide, until the page scrolls
 *   scrolled      denser glass, drawn in toward the centre
 *   mobile        a full-screen menu over warm light, links cascading in
 *
 * Blockchain stays unlinked from the main bar: it is roadmap, not product.
 * Agents is unlinked: the route requires sign-in, so in the public navigation
 * it sent every visitor to a login wall.
 */

type NavLink = { href: string; label: string; match?: string[] };

const navLinks: NavLink[] = [
  { href: "/listings", label: "Properties", match: ["/listings", "/properties", "/property", "/projects"] },
  { href: "/reef", label: "REEF Collection" },
  { href: "/ai-chat", label: "Advisor" },
  { href: "/services", label: "Services" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

const EASE = [0.16, 1, 0.3, 1] as const;

function isActivePath(pathname: string, link: NavLink) {
  const paths = link.match ?? [link.href];
  return paths.some((path) => (path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(`${path}/`)));
}

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const reduced = useReducedMotion();
  const { overlay } = useNavOverlay();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { data: session, status } = useSession();

  const user = session?.user;
  const authLoading = status === "loading";
  const role = (user as { role?: string } | undefined)?.role;
  const floating = overlay && !scrolled;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!(event.target as HTMLElement).closest("#user-profile-menu")) setProfileOpen(false);
    };
    if (profileOpen) document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [profileOpen]);

  // Close the menus when the route changes. Adjusting state during render is
  // React's own recommendation here; an effect would cause a cascading render.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setProfileOpen(false);
    setOpen(false);
    setSearchOpen(false);
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setProfileOpen(false);
        setSearchOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // The menu is a full screen: stop the page behind it from scrolling.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const handleLogout = () => {
    window.location.href = "/api/auth/logout";
  };

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = searchQuery.trim();
    router.push(query ? `/listings?search=${encodeURIComponent(query)}` : "/listings");
    setOpen(false);
    setSearchOpen(false);
  };

  const initial = user?.name ? user.name.charAt(0).toUpperCase() : "A";

  return (
    <>
      <header data-surface="stage" className="sticky top-0 z-50 h-[var(--nav-h)]">
        <motion.div
          initial={reduced ? false : { y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.9, ease: EASE }}
          className={cn(
            "mx-3 flex items-center gap-4 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] md:mx-auto",
            floating
              ? "mt-4 h-[64px] max-w-[1360px] rounded-full border border-white/10 bg-black/20 px-5 backdrop-blur-md md:px-7"
              : "mt-3 h-[60px] max-w-[1240px] rounded-full border border-[var(--glass-rule)] bg-[rgba(14,9,10,0.82)] px-5 shadow-[0_20px_50px_rgba(0,0,0,0.45)] backdrop-blur-xl md:px-6",
          )}
        >
          <Link href="/" aria-label="Aarvasa home" className="flex flex-shrink-0 items-center">
            <Image
              src="/aarvasa-navbar-logo-light.png"
              alt="Aarvasa"
              width={652}
              height={143}
              sizes="140px"
              className="h-[30px] w-auto"
              priority
            />
          </Link>

          <nav className="ml-auto hidden items-center gap-1 lg:flex">
            {navLinks.map((link) => {
              const active = isActivePath(pathname, link);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group relative isolate rounded-full px-3.5 py-2 text-[13px] font-medium transition-colors duration-300",
                    active ? "text-gold" : "text-stage-ink/80 hover:text-stage-ink",
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="nav-active"
                      className="absolute inset-0 -z-10 rounded-full border border-gold/30 bg-gold/[0.08]"
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                  {link.label}
                  <span className="absolute inset-x-3.5 bottom-1 h-px origin-left scale-x-0 bg-gold/70 transition-transform duration-500 group-hover:scale-x-100" />
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2 lg:ml-3">
            <button
              type="button"
              onClick={() => setSearchOpen((v) => !v)}
              aria-label="Search properties"
              aria-expanded={searchOpen}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-stage-ink/80 transition-colors hover:border-gold hover:text-gold"
            >
              <Search className="h-4 w-4" aria-hidden="true" />
            </button>

            {!authLoading && user ? (
              <div id="user-profile-menu" className="relative hidden lg:block">
                <button
                  type="button"
                  onClick={() => setProfileOpen((prev) => !prev)}
                  aria-label="Account menu"
                  aria-expanded={profileOpen}
                  className="av-gold flex h-10 w-10 items-center justify-center rounded-full text-[14px] font-bold"
                >
                  {initial}
                </button>
                <AnimatePresence>
                  {profileOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.97 }}
                      transition={{ duration: 0.25, ease: EASE }}
                      className="lux-glass-strong absolute right-0 top-[calc(100%+12px)] z-50 w-64 rounded-2xl p-2 shadow-over"
                    >
                      <div className="px-3 py-2">
                        <p className="av-meta text-[10px] text-ink-muted">Signed in as</p>
                        <p className="truncate text-sm font-semibold text-ink">{user.name || "User"}</p>
                        <p className="truncate text-xs text-ink-muted">{user.email}</p>
                      </div>
                      <div className="my-1 border-t border-rule" />
                      <Link href="/dashboard" onClick={() => setProfileOpen(false)} className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-ink transition-colors hover:bg-white/5">
                        <LayoutDashboard className="h-4 w-4 text-gold" /> Dashboard
                      </Link>
                      {role === "ADMIN" && (
                        <Link href="/admin" onClick={() => setProfileOpen(false)} className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-ink transition-colors hover:bg-white/5">
                          <Shield className="h-4 w-4 text-gold" /> Admin panel
                        </Link>
                      )}
                      <div className="my-1 border-t border-rule" />
                      <button
                        type="button"
                        onClick={() => {
                          setProfileOpen(false);
                          handleLogout();
                        }}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-ink transition-colors hover:bg-white/5"
                      >
                        <LogOut className="h-4 w-4 text-gold" /> Sign out
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : !authLoading ? (
              <Link href="/login" className="hidden rounded-full px-4 py-2 text-[13px] font-medium text-stage-ink/80 transition-colors hover:text-gold lg:inline-flex">
                Sign in
              </Link>
            ) : null}

            <Link
              href="/listings"
              className="av-gold hidden items-center gap-2 rounded-full px-5 py-2.5 text-[12px] font-bold uppercase tracking-[0.12em] md:inline-flex"
            >
              Explore <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>

            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Open navigation"
              aria-expanded={open}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-stage-ink lg:hidden"
            >
              <Menu className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </motion.div>

        {/* Search drops down beneath the bar */}
        <AnimatePresence>
          {searchOpen && (
            <motion.form
              onSubmit={handleSearch}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: EASE }}
              className="lux-glass-strong mx-3 mt-3 flex max-w-[720px] items-center gap-3 rounded-full p-2 pl-5 shadow-over md:mx-auto"
            >
              <Search className="h-4 w-4 shrink-0 text-gold" aria-hidden="true" />
              <label htmlFor="navbar-search" className="sr-only">
                Search properties
              </label>
              <input
                id="navbar-search"
                autoFocus
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="City, project or developer"
                className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-muted"
              />
              <button type="submit" className="av-gold rounded-full px-6 py-3 text-[12px] font-bold uppercase tracking-[0.12em]">
                Search
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </header>

      {/* ── Full-screen menu ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            data-surface="stage"
            initial={{ clipPath: "circle(0% at 92% 4%)" }}
            animate={{ clipPath: "circle(150% at 92% 4%)" }}
            exit={{ clipPath: "circle(0% at 92% 4%)" }}
            transition={{ duration: reduced ? 0 : 0.7, ease: EASE }}
            className="fixed inset-0 z-[60] flex flex-col overflow-y-auto bg-[#0a0707] lg:hidden"
          >
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="lux-aurora" />
            </div>
            <div className="relative flex items-center justify-between px-[var(--gutter)] py-5">
              <Image src="/aarvasa-navbar-logo-light.png" alt="Aarvasa" width={652} height={143} sizes="132px" className="h-8 w-auto" />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close navigation"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 text-stage-ink"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSearch} className="relative mx-[var(--gutter)] mt-2 flex items-center gap-3 rounded-full border border-white/15 bg-white/5 px-5 py-3.5">
              <Search className="h-4 w-4 flex-shrink-0 text-gold" aria-hidden="true" />
              <label htmlFor="drawer-search" className="sr-only">
                Search properties
              </label>
              <input
                id="drawer-search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="City, project or developer"
                className="min-w-0 flex-1 bg-transparent text-[15px] text-stage-ink outline-none placeholder:text-stage-muted"
              />
            </form>

            <motion.nav
              className="relative flex-1 px-[var(--gutter)] py-8"
              initial="hidden"
              animate="shown"
              variants={{ hidden: {}, shown: { transition: { staggerChildren: 0.06, delayChildren: 0.25 } } }}
            >
              {navLinks.map((link, i) => {
                const active = isActivePath(pathname, link);
                return (
                  <motion.div
                    key={link.href}
                    variants={{ hidden: { opacity: 0, x: -30 }, shown: { opacity: 1, x: 0, transition: { duration: 0.7, ease: EASE } } }}
                  >
                    <Link
                      href={link.href}
                      onClick={() => setOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className="group flex items-baseline gap-4 border-b border-white/10 py-4"
                    >
                      <span className="av-meta text-[10px] text-gold/70">0{i + 1}</span>
                      <span className={cn("av-display text-[40px] font-light leading-none", active ? "lux-gold-text italic" : "text-stage-ink")}>
                        {link.label}
                      </span>
                      <ArrowUpRight className="ml-auto h-5 w-5 text-stage-muted transition-transform group-hover:rotate-45 group-hover:text-gold" aria-hidden="true" />
                    </Link>
                  </motion.div>
                );
              })}
            </motion.nav>

            <div className="relative px-[var(--gutter)] pb-8">
              {!authLoading && user ? (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <span className="av-gold flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-[14px] font-bold">{initial}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-stage-ink">{user.name || "User"}</span>
                      <span className="block truncate text-xs text-stage-muted">{user.email}</span>
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link href="/dashboard" onClick={() => setOpen(false)} className="rounded-full border border-white/15 px-5 py-2.5 text-[13px] text-stage-ink">
                      Dashboard
                    </Link>
                    {role === "ADMIN" && (
                      <Link href="/admin" onClick={() => setOpen(false)} className="rounded-full border border-white/15 px-5 py-2.5 text-[13px] text-stage-ink">
                        Admin panel
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        handleLogout();
                      }}
                      className="rounded-full border border-white/15 px-5 py-2.5 text-[13px] text-stage-ink"
                    >
                      Sign out
                    </button>
                  </div>
                </div>
              ) : !authLoading ? (
                <div className="flex gap-3">
                  <Link href="/listings" onClick={() => setOpen(false)} className="av-gold flex-1 rounded-full px-5 py-3.5 text-center text-[12px] font-bold uppercase tracking-[0.14em]">
                    Explore properties
                  </Link>
                  <Link href="/login" onClick={() => setOpen(false)} className="rounded-full border border-white/15 px-5 py-3.5 text-[13px] text-stage-ink">
                    Sign in
                  </Link>
                </div>
              ) : null}
              <p className="mt-6 text-[12px] leading-relaxed text-stage-muted">
                Investment and ownership services are in development and are not offered today.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
