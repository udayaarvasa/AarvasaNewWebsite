import Link from "next/link";
import { Building2, Mail, MapPin, Phone, ArrowRight } from "lucide-react";

const footerLinks = {
  Platform: [
    { label: "Property Listings", href: "/listings" },
    { label: "AI Advisor", href: "/ai-chat" },
    { label: "Dashboard", href: "/dashboard" },
    { label: "Blockchain", href: "/blockchain" },
  ],
  Company: [
    { label: "About Us", href: "/about" },
    { label: "Our Agents", href: "/agents" },
    { label: "Services", href: "/services" },
    { label: "Contact", href: "/contact" },
  ],
  Legal: [
    { label: "Privacy Policy", href: "#" },
    { label: "Terms of Service", href: "#" },
    { label: "RERA Compliance", href: "#" },
    { label: "Disclaimer", href: "#" },
  ],
};

export function Footer() {
  return (
    <footer className="relative border-t border-border/50 bg-gradient-to-b from-background to-[#0b0b0b]" id="footer">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
          {/* Brand column */}
          <div>
            <Link href="/" className="flex items-center gap-3">
              <span className="relative flex h-12 w-12 items-center justify-center">
                <span className="absolute h-9 w-9 rotate-45 rounded-lg bg-gradient-to-br from-[#f5d27a] via-[#f0a83a] to-[#7a1f3d]" />
                <span className="relative text-xl font-black text-white">A</span>
              </span>
              <span>
                <span className="block text-base font-black uppercase tracking-[0.2em] text-foreground">Aarvasa</span>
                <span className="block text-[7px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Building Dreams, Securing Futures</span>
              </span>
            </Link>
            <p className="mt-6 max-w-sm text-sm leading-relaxed text-muted-foreground">
              India&apos;s premier AI-powered real estate investment platform. Combining machine intelligence, blockchain verification, and luxury curation for discerning investors.
            </p>
            <div className="mt-6 space-y-3">
              <a href="mailto:hello@aarvasa.com" className="flex items-center gap-3 text-sm text-muted-foreground transition hover:text-foreground">
                <Mail className="h-4 w-4 text-primary" /> hello@aarvasa.com
              </a>
              <a href="tel:+919999999999" className="flex items-center gap-3 text-sm text-muted-foreground transition hover:text-foreground">
                <Phone className="h-4 w-4 text-primary" /> +91 99999 99999
              </a>
              <span className="flex items-center gap-3 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 text-primary" /> Mumbai, India
              </span>
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h3 className="text-sm font-bold uppercase tracking-[0.15em] text-foreground">{category}</h3>
              <ul className="mt-5 space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="text-sm text-muted-foreground transition-colors hover:text-primary">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-border/30 pt-8 text-xs text-muted-foreground md:flex-row">
          <p>&copy; {new Date().getFullYear()} Aarvasa Technologies Pvt. Ltd. All rights reserved.</p>
          <p className="flex items-center gap-2">
            Crafted with AI <span className="gold-text font-bold">✦</span> for the discerning investor
          </p>
        </div>
      </div>
    </footer>
  );
}
