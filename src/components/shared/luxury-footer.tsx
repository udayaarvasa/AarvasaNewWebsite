import Link from "next/link";

const platformLinks = [
  { href: "/listings", label: "Property Listings" },
  { href: "/ai-chat", label: "AI Advisor" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/blockchain", label: "Blockchain" },
];

const companyLinks = [
  { href: "/about", label: "About Us" },
  { href: "/agents", label: "Our Agents" },
  { href: "/services", label: "Services" },
  { href: "/contact", label: "Contact" },
];

const legalLinks = [
  { href: "#", label: "Privacy Policy" },
  { href: "#", label: "Terms of Service" },
  { href: "#", label: "Cookie Policy" },
  { href: "#", label: "Investment Disclosure" },
  { href: "#", label: "RERA Compliance" },
  { href: "#", label: "Careers" },
];

export function LuxuryFooter() {
  return (
    <footer className="footer-dark mt-auto">
      <div className="mx-auto max-w-7xl px-6 py-16 sm:px-10">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand column */}
          <div className="lg:col-span-1">
            <Link href="/" className="flex items-center gap-3">
              <span className="relative flex h-12 w-12 items-center justify-center">
                <span className="absolute h-9 w-9 rotate-45 rounded-lg bg-gradient-to-br from-[#f5d27a] via-[#f0a83a] to-[#72383D]" />
                <span className="relative text-xl font-black text-white">A</span>
              </span>
              <span className="leading-none">
                <span className="block text-lg font-black uppercase tracking-[0.22em] text-[#F2F1ED]">
                  Aarvasa
                </span>
                <span className="mt-0.5 block text-[7px] font-bold uppercase tracking-[0.2em] text-[#DCCDCE]">
                  Building Dreams, Securing Futures
                </span>
              </span>
            </Link>
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-[#DCCDCE]/80">
              India&apos;s premier AI-powered real estate investment
              platform. Combining machine intelligence, blockchain
              verification, and luxury curation for discerning investors.
            </p>
          </div>

          {/* Platform links */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[#DCCDCE]">
              Platform
            </h3>
            <ul className="mt-4 space-y-3">
              {platformLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-[#DCCDCE]/70 transition hover:text-[#D4AF37]"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company links */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[#DCCDCE]">
              Company
            </h3>
            <ul className="mt-4 space-y-3">
              {companyLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-[#DCCDCE]/70 transition hover:text-[#D4AF37]"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[#DCCDCE]">
              Legal
            </h3>
            <ul className="mt-4 space-y-3">
              {legalLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-[#DCCDCE]/70 transition hover:text-[#D4AF37]"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-[#DCCDCE]/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-6 py-6 sm:flex-row sm:px-10">
          <p className="text-xs text-[#DCCDCE]/50">
            © {new Date().getFullYear()} Aarvasa PropTech. All rights reserved.
          </p>
          <p className="text-xs text-[#DCCDCE]/40">
            Crafted with AI ✦ for the discerning investor
          </p>
        </div>
      </div>
    </footer>
  );
}
