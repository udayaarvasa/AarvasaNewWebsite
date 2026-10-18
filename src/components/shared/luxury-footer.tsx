import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Mail, MapPin } from "lucide-react";
import { ContourField, Grain } from "@/components/av/graphics";
import { DrawnTower, RevealGroup, RevealItem, SlideIn } from "@/components/av/motion";

/**
 * Footer — the one dark band on every page that is not media.
 *
 * It closes the page the way a stage hero opens it, and it carries the
 * roadmap disclosure so that statement appears on every surface without being
 * sold on any of them.
 *
 * All company, legal and contact details are as filed and are reproduced here
 * verbatim.
 */

const quickLinks = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About us" },
  { href: "/services", label: "Services" },
  { href: "/about#team", label: "Our team" },
];

const discoverLinks = [
  { href: "/listings", label: "All properties" },
  { href: "/ai-chat", label: "Advisor" },
  { href: "/contact", label: "Contact" },
];

const privacyTermsLinks = [
  { href: "/terms", label: "Terms and Conditions" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/refund", label: "Refund and Cancellation Policy" },
  { href: "/security", label: "Security" },
];

const socials = [
  { href: "https://www.linkedin.com/company/aarvasa", label: "LinkedIn" },
  { href: "https://x.com/aarvasa", label: "X" },
  { href: "https://www.instagram.com/theaarvasa/", label: "Instagram" },
  { href: "https://www.facebook.com/aarvasa", label: "Facebook" },
];

/* Brand marks, drawn inline: the icon set carries no logos. */
const SOCIAL_ICONS: Record<string, React.ReactNode> = {
  LinkedIn: (
    <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9.75h4v11H3zM9.5 9.75h3.8v1.6h.06c.53-.95 1.83-1.95 3.77-1.95 4.03 0 4.77 2.55 4.77 5.87v5.48h-4v-4.86c0-1.16-.02-2.65-1.66-2.65-1.66 0-1.92 1.25-1.92 2.56v4.95h-4z" />
  ),
  X: <path d="M17.6 3h3.1l-6.8 7.8 8 10.2h-6.3l-4.9-6.4-5.6 6.4H2l7.3-8.3L1.6 3h6.4l4.4 5.9zm-1.1 16.2h1.7L7.1 4.7H5.3z" />,
  Instagram: (
    <path d="M12 2.2c3.2 0 3.58.01 4.85.07 3.25.15 4.77 1.69 4.92 4.92.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.15 3.23-1.66 4.77-4.92 4.92-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-3.26-.15-4.77-1.7-4.92-4.92C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85C2.38 3.92 3.9 2.38 7.15 2.23 8.42 2.17 8.8 2.16 12 2.16zm0 4.78a5.02 5.02 0 1 0 0 10.04 5.02 5.02 0 0 0 0-10.04zm0 8.28a3.26 3.26 0 1 1 0-6.52 3.26 3.26 0 0 1 0 6.52zm5.22-9.65a1.17 1.17 0 1 0 0 2.34 1.17 1.17 0 0 0 0-2.34z" />
  ),
  Facebook: <path d="M14 8.5V6.6c0-.85.2-1.3 1.53-1.3H17.5V2h-2.9C11.4 2 10.3 3.6 10.3 6.3v2.2H8v3.3h2.3V22H14V11.8h3.1l.4-3.3z" />,
};

/* The three listed towers, as a strip of frames above the footer. */
const FOOTER_FRAMES = [
  { href: "/projects/reef-996-dubai-production-city", src: "/images/reef-996/hero/reef-996-balconies-stacked-4x5.jpg", label: "REEF 996" },
  { href: "/projects/reef-997-dubai-islands", src: "/images/reef-997/hero/reef-997-pool-sunset-4x5.jpg", label: "REEF 997" },
  { href: "/projects/reef-998-dlrc", src: "/images/reef-998/hero/reef-998-pool-facade-4x5.jpg", label: "REEF 998" },
];

function Column({ heading, links }: { heading: string; links: { href: string; label: string }[] }) {
  return (
    <div>
      <h3 className="av-label text-stage-ink">{heading}</h3>
      <ul className="mt-4 space-y-2">
        {links.map((link) => (
          <li key={link.label}>
            <Link
              href={link.href}
              className="text-[13px] text-stage-muted transition-colors duration-200 hover:text-gold"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LuxuryFooter() {
  return (
    <footer data-surface="stage" className="relative isolate overflow-hidden bg-stage text-stage-muted">
      {/* ── The closing call, on wine ─────────────────────────────────── */}
      <div data-surface="wine" className="relative isolate overflow-hidden">
        <ContourField tone="stage" seed={21} className="opacity-25" />
        <div className="relative z-[2] mx-auto grid max-w-[var(--container)] items-center gap-[var(--s-10)] px-[var(--gutter)] py-[var(--s-14)] lg:grid-cols-[1fr_1.1fr]">
          <SlideIn from="left">
            <span className="av-label text-gold">Aarvasa</span>
            <p className="av-display mt-3 max-w-[18ch] text-[clamp(28px,3.6vw,44px)] leading-[1.06] text-wine-ink">
              See the building before you visit it.
            </p>
            <p className="mt-3 max-w-[44ch] text-[14.5px] leading-relaxed text-wine-muted">
              Open a project, read what its developer filed, and send one enquiry when you are ready.
            </p>
            <div className="mt-[var(--s-6)] flex flex-wrap gap-[var(--s-3)]">
              <Link href="/listings" className="av-gold av-label inline-flex items-center gap-2 px-6 py-[13px]">
                Browse properties <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href="/contact"
                className="av-label rounded-sm border border-wine-ink/30 px-6 py-[13px] text-wine-ink transition-colors hover:border-wine-ink hover:bg-wine-raised"
              >
                Talk to the desk
              </Link>
            </div>
          </SlideIn>

          <RevealGroup className="grid grid-cols-3 gap-[var(--s-3)]">
            {FOOTER_FRAMES.map((f, i) => (
              <RevealItem key={f.href} className={i === 1 ? "lg:-translate-y-6" : undefined}>
                <Link
                  href={f.href}
                  className="group relative block aspect-[4/5] overflow-hidden rounded-xs border border-wine-rule"
                >
                  <Image
                    src={f.src}
                    alt={`${f.label}, developer render`}
                    fill
                    sizes="(min-width: 1024px) 200px, 30vw"
                    className="object-cover transition-transform duration-[1200ms] ease-[var(--ease-enter)] group-hover:scale-110"
                  />
                  <span className="absolute inset-0 bg-gradient-to-t from-[rgba(12,11,10,0.75)] via-transparent to-transparent" />
                  <span className="absolute inset-x-3 bottom-3 flex items-center justify-between text-[13px] font-medium text-stage-ink">
                    {f.label}
                    <ArrowUpRight className="h-4 w-4 text-gold transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
                  </span>
                </Link>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </div>

      <ContourField tone="stage" seed={17} className="opacity-30" />
      <Grain opacity={0.05} />
      <div aria-hidden="true" className="pointer-events-none absolute -right-10 bottom-0 hidden h-[300px] w-[180px] opacity-20 xl:block">
        <DrawnTower tone="stage" />
      </div>

      <div className="relative z-[2] mx-auto max-w-[var(--container)] px-[var(--gutter)] pt-[var(--s-14)] pb-[var(--s-8)]">
        <div className="grid gap-[var(--s-10)] border-b border-stage-rule pb-[var(--s-10)] lg:grid-cols-[1.6fr_repeat(4,1fr)]">
          <div>
            <Link href="/" aria-label="Aarvasa home" className="inline-block">
              <Image
                src="/aarvasa-navbar-logo-light.png"
                alt="Aarvasa"
                width={652}
                height={143}
                sizes="160px"
                className="h-9 w-auto"
              />
            </Link>
            <p className="mt-5 max-w-[34ch] text-[13px] leading-relaxed">
              Premium property, examined properly. Find it, explore what has been captured, and
              compare what you found on the specification that decides it.
            </p>
            <p className="av-meta mt-5 text-gold">Discover · Explore · Evaluate</p>

            <ul className="mt-6 flex flex-wrap gap-3">
              {socials.map((social) => (
                <li key={social.label}>
                  <a
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Aarvasa on ${social.label}`}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-stage-rule text-stage-muted transition-all duration-300 hover:-translate-y-0.5 hover:border-gold hover:bg-gold hover:text-stage"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" className="h-[17px] w-[17px]" aria-hidden="true">
                      {SOCIAL_ICONS[social.label]}
                    </svg>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <Column heading="Discover" links={discoverLinks} />
          <Column heading="Company" links={quickLinks} />
          <Column heading="Legal" links={privacyTermsLinks} />

          <div>
            <h3 className="av-label text-stage-ink">Contact us</h3>
            <address className="mt-4 space-y-3 text-[13px] not-italic leading-relaxed">
              <p className="flex gap-2">
                <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-gold" aria-hidden="true" />
                <span>3 Flr, off Windsar Sq Opp, Vishal Megamart Kolar Rd, Kolar Road, Huzur, Bhopal -
                462042, Madhya Pradesh.</span>
              </p>
              <p className="flex items-center gap-2">
                <Mail className="h-4 w-4 flex-shrink-0 text-gold" aria-hidden="true" />
                <a
                  href="mailto:contact@aarvasa.com"
                  className="transition-colors duration-200 hover:text-gold"
                >
                  contact@aarvasa.com
                </a>
              </p>
            </address>
          </div>
        </div>

        <div className="flex flex-col gap-3 pt-[var(--s-6)] text-[12px] sm:flex-row sm:items-start sm:justify-between">
          <p>
            © Aarvasa Innovations Pvt. Ltd. | All rights reserved &nbsp;&nbsp; GSTIN -
            23ADPPD8193B1ZN &nbsp;&nbsp; CIN - U68200MP2025PTC076282
          </p>
          <p className="sm:max-w-[38ch] sm:text-right">
            Investment and ownership services are in development and are not offered today.
          </p>
        </div>
      </div>
    </footer>
  );
}
