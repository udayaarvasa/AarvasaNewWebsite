import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Mail, MapPin, Phone } from "lucide-react";
import { FadeUp, Stagger, StaggerItem } from "@/components/lux/motion";
import { GoldButton } from "@/components/lux/primitives";

/**
 * Footer — the close of every page.
 *
 * A final invitation, the directory, and the company's filed details,
 * reproduced verbatim. It carries the roadmap disclosure so that statement
 * appears on every surface without being sold on any of them.
 */

const columns = [
  {
    heading: "Discover",
    links: [
      { href: "/listings", label: "All properties" },
      { href: "/reef", label: "REEF Collection" },
      { href: "/compare", label: "Compare" },
      { href: "/ai-chat", label: "Advisor" },
    ],
  },
  {
    heading: "Company",
    links: [
      { href: "/about", label: "About us" },
      { href: "/services", label: "Services" },
      { href: "/about#team", label: "Our team" },
      { href: "/blockchain", label: "Roadmap" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { href: "/terms", label: "Terms and Conditions" },
      { href: "/privacy", label: "Privacy Policy" },
      { href: "/refund", label: "Refund and Cancellation" },
      { href: "/security", label: "Security" },
    ],
  },
];

const socials = [
  {
    href: "https://www.linkedin.com/company/aarvasa",
    label: "LinkedIn",
    path: "M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9.75h4v11H3zM9.5 9.75h3.8v1.6h.06c.53-.95 1.83-1.95 3.77-1.95 4.03 0 4.77 2.55 4.77 5.87v5.48h-4v-4.86c0-1.16-.02-2.65-1.66-2.65-1.66 0-1.92 1.25-1.92 2.56v4.95h-4z",
  },
  {
    href: "https://x.com/aarvasa",
    label: "X",
    path: "M17.6 3h3.1l-6.8 7.8 8 10.2h-6.3l-4.9-6.4-5.6 6.4H2l7.3-8.3L1.6 3h6.4l4.4 5.9zm-1.1 16.2h1.7L7.1 4.7H5.3z",
  },
  {
    href: "https://www.instagram.com/theaarvasa/",
    label: "Instagram",
    path: "M12 2.2c3.2 0 3.58.01 4.85.07 3.25.15 4.77 1.69 4.92 4.92.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.15 3.23-1.66 4.77-4.92 4.92-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-3.26-.15-4.77-1.7-4.92-4.92C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85C2.38 3.92 3.9 2.38 7.15 2.23 8.42 2.17 8.8 2.16 12 2.16zm0 4.78a5.02 5.02 0 1 0 0 10.04 5.02 5.02 0 0 0 0-10.04zm0 8.28a3.26 3.26 0 1 1 0-6.52 3.26 3.26 0 0 1 0 6.52zm5.22-9.65a1.17 1.17 0 1 0 0 2.34 1.17 1.17 0 0 0 0-2.34z",
  },
  {
    href: "https://www.facebook.com/aarvasa",
    label: "Facebook",
    path: "M14 8.5V6.6c0-.85.2-1.3 1.53-1.3H17.5V2h-2.9C11.4 2 10.3 3.6 10.3 6.3v2.2H8v3.3h2.3V22H14V11.8h3.1l.4-3.3z",
  },
];

export function LuxuryFooter() {
  return (
    <footer data-surface="stage" className="relative isolate overflow-hidden bg-[#070505] text-stage-muted">
      {/* Warm light from below, and the wordmark set huge behind everything */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -bottom-1/3 left-1/2 h-[70%] w-[90%] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(122,22,34,0.45),transparent)] blur-2xl" />
      </div>
      <div className="lux-rule" />

      <div className="mx-auto max-w-[1320px] px-[var(--gutter)] pt-[clamp(64px,9vw,120px)]">
        {/* The invitation */}
        <div className="grid items-end gap-10 border-b border-white/10 pb-[clamp(48px,7vw,96px)] lg:grid-cols-[1.3fr_1fr]">
          <FadeUp>
            <span className="lux-eyebrow">Aarvasa</span>
            <p className="av-display mt-5 max-w-[16ch] text-[clamp(40px,5.6vw,84px)] font-light leading-[0.95] text-stage-ink">
              See the building <em className="lux-gold-text lux-shimmer italic">before</em> you visit it.
            </p>
          </FadeUp>
          <FadeUp delay={0.15} className="flex flex-col gap-6 lg:items-end">
            <p className="max-w-[40ch] text-[15px] leading-relaxed lg:text-right">
              Open a project, read what its developer filed, and send one enquiry when you are ready.
            </p>
            <GoldButton href="/listings">Explore properties</GoldButton>
          </FadeUp>
        </div>

        {/* Directory */}
        <Stagger className="grid gap-12 py-[clamp(48px,6vw,80px)] sm:grid-cols-2 lg:grid-cols-[1.5fr_repeat(3,1fr)_1.4fr]" gap={0.08}>
          <StaggerItem>
            <Link href="/" aria-label="Aarvasa home" className="inline-block">
              <Image src="/aarvasa-navbar-logo-light.png" alt="Aarvasa" width={652} height={143} sizes="170px" className="h-10 w-auto" />
            </Link>
            <p className="mt-6 max-w-[34ch] text-[13.5px] leading-relaxed">
              Premium property, examined properly. Find it, explore what has been captured, and compare it on the
              specification that decides it.
            </p>
            <ul className="mt-7 flex gap-3">
              {socials.map((s) => (
                <li key={s.label}>
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Aarvasa on ${s.label}`}
                    className="flex h-11 w-11 items-center justify-center rounded-full border border-white/12 text-stage-ink/80 transition-all duration-500 hover:-translate-y-1 hover:border-gold hover:bg-gold hover:text-[#1a0e0f] hover:shadow-[0_12px_30px_rgba(214,180,97,0.35)]"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" className="h-[17px] w-[17px]" aria-hidden="true">
                      <path d={s.path} />
                    </svg>
                  </a>
                </li>
              ))}
            </ul>
          </StaggerItem>

          {columns.map((col) => (
            <StaggerItem key={col.heading}>
              <h3 className="av-meta text-[11px] text-gold">{col.heading}</h3>
              <ul className="mt-5 space-y-3">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link href={l.href} className="group inline-flex items-center gap-1.5 text-[14px] transition-colors duration-300 hover:text-stage-ink">
                      <span className="h-px w-0 bg-gold transition-all duration-500 group-hover:w-3" />
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </StaggerItem>
          ))}

          <StaggerItem>
            <h3 className="av-meta text-[11px] text-gold">Contact</h3>
            <address className="mt-5 space-y-4 text-[13.5px] not-italic leading-relaxed">
              <p className="flex gap-3">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden="true" />
                <span>
                  3 Flr, off Windsar Sq Opp, Vishal Megamart Kolar Rd, Kolar Road, Huzur, Bhopal - 462042, Madhya Pradesh.
                </span>
              </p>
              <p className="flex items-center gap-3">
                <Mail className="h-4 w-4 shrink-0 text-gold" aria-hidden="true" />
                <a href="mailto:contact@aarvasa.com" className="transition-colors hover:text-gold">
                  contact@aarvasa.com
                </a>
              </p>
              <p className="flex items-center gap-3">
                <Phone className="h-4 w-4 shrink-0 text-gold" aria-hidden="true" />
                <a href="tel:+916382083873" className="transition-colors hover:text-gold">
                  +91 63820 83873
                </a>
              </p>
            </address>
          </StaggerItem>
        </Stagger>
      </div>

      {/* The wordmark, enormous and quiet */}
      <div aria-hidden="true" className="pointer-events-none select-none overflow-hidden">
        <p className="av-display -mb-[0.18em] text-center text-[clamp(90px,21vw,330px)] font-light leading-none tracking-[-0.03em] text-transparent [-webkit-text-stroke:1px_rgba(226,196,122,0.22)]">
          Aarvasa
        </p>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-[1320px] flex-col gap-3 px-[var(--gutter)] py-6 text-[12px] md:flex-row md:items-center md:justify-between">
          <p>
            © Aarvasa Innovations Pvt. Ltd. · All rights reserved · GSTIN 23ADPPD8193B1ZN · CIN U68200MP2025PTC076282
          </p>
          <p className="flex items-center gap-1.5 md:text-right">
            Investment and ownership services are in development and are not offered today.
            <Link href="/blockchain" aria-label="Read the roadmap" className="text-gold">
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
