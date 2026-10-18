"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { LayoutDashboard, LogOut, Search, Shield, X } from "lucide-react";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { useNavOverlay } from "./nav-overlay";

/**
 * Global navigation — one bar, three states.
 *
 *   default   solid paper, hairline rule
 *   overlay   transparent over a stage hero, until 40px of scroll
 *   drawer    full-screen paper navigation on small viewports
 *
 * There is no mega-menu and no persistent bottom tab bar: contextual actions
 * belong to the page, not to the shell.
 */

type NavLink = { href: string; label: string; match?: string[] };

// Blockchain stays routable but is unlinked: it is roadmap, not product.
// Agents is likewise unlinked: the route requires sign-in, so in the public
// navigation it sent every visitor to a login wall.
const navLinks: NavLink[] = [
  { href: "/listings", label: "Properties", match: ["/listings", "/properties", "/property", "/projects"] },
  { href: "/reef", label: "REEF Collection" },
  { href: "/ai-chat", label: "Advisor" },
  { href: "/about", label: "About" },
  { href: "/services", label: "Services" },
  { href: "/contact", label: "Contact" },
];

function isActivePath(pathname: string, link: NavLink) {
  const paths = link.match ?? [link.href];
  return paths.some((path) =>
    path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(`${path}/`),
  );
}

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { overlay } = useNavOverlay();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
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
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // The drawer is a full screen: stop the page behind it from scrolling.
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
  };

  return (
    <>
      <header
        data-surface={floating ? "stage" : undefined}
        className={cn(
          "sticky top-0 z-50 border-b transition-colors duration-300",
          // Floating over a photograph: a soft stage gradient keeps the white
          // logo and links legible however bright the frame beneath them is.
          floating
            ? "border-transparent bg-transparent bg-gradient-to-b from-[rgba(12,11,10,0.62)] to-transparent"
            : "border-rule bg-paper",
        )}
      >
        <div className="mx-auto flex h-[var(--nav-h)] max-w-[var(--container)] items-center gap-6 px-[var(--gutter)]">
          <Link
            href="/"
            aria-label="Aarvasa home"
            className="flex flex-shrink-0 items-center"
          >
            <Image
              src="/aarvasa-navbar-logo.png"
              alt="Aarvasa"
              width={653}
              height={169}
              sizes="(max-width: 767px) 132px, 160px"
              className={cn("h-8 w-auto", floating && "brightness-0 invert")}
              priority
            />
          </Link>

          <nav className="ml-4 hidden items-center gap-5 lg:flex">
            {navLinks.map((link) => {
              const active = isActivePath(pathname, link);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "border-b border-transparent pb-[3px] text-[13px] font-medium transition-colors duration-200",
                    floating
                      ? "text-stage-ink/80 hover:text-stage-ink"
                      : "text-ink-muted hover:text-ink",
                    active && (floating ? "border-gold text-stage-ink" : "border-gold-ink text-ink"),
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <form
              onSubmit={handleSearch}
              className={cn(
                "hidden items-center gap-2 rounded-xs border px-3 py-[7px] xl:flex",
                floating ? "border-stage-ink/30 bg-stage-ink/10" : "border-rule bg-paper-raised",
              )}
            >
              <Search
                className={cn("h-3.5 w-3.5 flex-shrink-0", floating ? "text-stage-muted" : "text-ink-muted")}
                aria-hidden="true"
              />
              <label htmlFor="navbar-search" className="sr-only">
                Search properties
              </label>
              <input
                id="navbar-search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="City, project or developer"
                className={cn(
                  "w-[200px] min-w-0 bg-transparent text-[13px] outline-none",
                  floating
                    ? "text-stage-ink placeholder:text-stage-muted"
                    : "text-ink placeholder:text-ink-muted",
                )}
              />
            </form>

            {!authLoading && user ? (
              <div id="user-profile-menu" className="relative hidden lg:block">
                <button
                  type="button"
                  onClick={() => setProfileOpen((prev) => !prev)}
                  aria-label="Account menu"
                  aria-expanded={profileOpen}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-burgundy text-[13px] font-semibold text-paper"
                >
                  {user.name ? user.name.charAt(0).toUpperCase() : "A"}
                </button>

                {profileOpen && (
                  <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-60 rounded-sm border border-rule bg-paper-raised p-2 shadow-over">
                    <div className="px-3 py-2">
                      <p className="av-label text-ink-muted">Signed in as</p>
                      <p className="truncate text-sm font-semibold text-ink">{user.name || "User"}</p>
                      <p className="truncate text-xs text-ink-muted">{user.email}</p>
                    </div>
                    <div className="my-1 border-t border-rule" />
                    <Link
                      href="/dashboard"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2.5 rounded-xs px-3 py-2 text-sm text-ink transition-colors hover:bg-paper-sunken"
                    >
                      <LayoutDashboard className="h-4 w-4 text-ink-muted" />
                      Dashboard
                    </Link>
                    {role === "ADMIN" && (
                      <Link
                        href="/admin"
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-2.5 rounded-xs px-3 py-2 text-sm text-ink transition-colors hover:bg-paper-sunken"
                      >
                        <Shield className="h-4 w-4 text-ink-muted" />
                        Admin panel
                      </Link>
                    )}
                    <div className="my-1 border-t border-rule" />
                    <button
                      type="button"
                      onClick={() => {
                        setProfileOpen(false);
                        handleLogout();
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xs px-3 py-2 text-sm text-ink transition-colors hover:bg-paper-sunken"
                    >
                      <LogOut className="h-4 w-4 text-ink-muted" />
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : !authLoading ? (
              <Link
                href="/login"
                className={cn(
                  "av-label hidden rounded-xs border px-4 py-2.5 transition-colors duration-300 lg:inline-flex",
                  floating
                    ? "border-stage-ink/35 text-stage-ink hover:border-stage-ink"
                    : "border-rule-firm text-ink hover:bg-paper-sunken",
                )}
              >
                Sign in
              </Link>
            ) : null}

            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Open navigation"
              aria-expanded={open}
              className={cn(
                "av-label lg:hidden",
                floating ? "text-stage-ink" : "text-ink",
              )}
            >
              Menu
            </button>
          </div>
        </div>
      </header>

      {/* ── Full-screen drawer ─────────────────────────────────────────────
          Mobile navigation is its own screen, not a squeezed desktop menu. */}
      {open && (
        <div className="fixed inset-0 z-[60] flex flex-col overflow-y-auto bg-paper lg:hidden">
          <div className="flex items-center justify-between border-b border-rule px-[var(--gutter)] py-4">
            <Image
              src="/aarvasa-navbar-logo.png"
              alt="Aarvasa"
              width={653}
              height={169}
              sizes="132px"
              className="h-8 w-auto"
            />
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close navigation"
              className="av-label flex items-center gap-2 text-ink"
            >
              Close
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="px-[var(--gutter)] pt-5">
            <form
              onSubmit={handleSearch}
              className="flex items-center gap-2 rounded-xs border border-rule-firm bg-paper-raised px-3 py-3"
            >
              <Search className="h-4 w-4 flex-shrink-0 text-ink-muted" aria-hidden="true" />
              <label htmlFor="drawer-search" className="sr-only">
                Search properties
              </label>
              <input
                id="drawer-search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="City, project or developer"
                className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted"
              />
            </form>
          </div>

          <nav className="flex-1 px-[var(--gutter)] py-6">
            {navLinks.map((link) => {
              const active = isActivePath(pathname, link);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "av-display block border-b border-rule py-3.5 text-[30px] leading-[1.25]",
                    active ? "text-burgundy" : "text-ink",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-rule px-[var(--gutter)] py-5">
            {!authLoading && user ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-burgundy text-[13px] font-semibold text-paper">
                    {user.name ? user.name.charAt(0).toUpperCase() : "A"}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink">{user.name || "User"}</span>
                    <span className="block truncate text-xs text-ink-muted">{user.email}</span>
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href="/dashboard"
                    onClick={() => setOpen(false)}
                    className="av-label rounded-xs border border-rule-firm px-4 py-2.5 text-ink"
                  >
                    Dashboard
                  </Link>
                  {role === "ADMIN" && (
                    <Link
                      href="/admin"
                      onClick={() => setOpen(false)}
                      className="av-label rounded-xs border border-rule-firm px-4 py-2.5 text-ink"
                    >
                      Admin panel
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      handleLogout();
                    }}
                    className="av-label rounded-xs border border-rule-firm px-4 py-2.5 text-ink"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            ) : !authLoading ? (
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="av-label inline-flex rounded-xs bg-burgundy px-5 py-3 text-paper"
              >
                Sign in
              </Link>
            ) : null}
          </div>

          <div data-surface="stage" className="bg-stage px-[var(--gutter)] py-5">
            <p className="av-meta text-gold">Discover · Explore · Evaluate</p>
            <p className="mt-2 text-[13px] leading-relaxed text-stage-muted">
              Investment and ownership services are in development and are not offered today.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
