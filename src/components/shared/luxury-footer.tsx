import Image from "next/image";
import Link from "next/link";

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
    <footer data-surface="stage" className="bg-stage text-stage-muted">
      <div className="mx-auto max-w-[var(--container)] px-[var(--gutter)] pt-[var(--s-14)] pb-[var(--s-8)]">
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
              Premium property, examined properly. Find it, explore it in three dimensions, and
              compare what you found on the specification that decides it.
            </p>
            <p className="av-meta mt-5 text-gold">Discover · Explore · Evaluate</p>

            <ul className="mt-6 flex flex-wrap gap-4">
              {socials.map((social) => (
                <li key={social.label}>
                  <a
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[13px] text-stage-muted transition-colors duration-200 hover:text-gold"
                  >
                    {social.label}
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
              <p>
                3 Flr, off Windsar Sq Opp, Vishal Megamart Kolar Rd, Kolar Road, Huzur, Bhopal -
                462042, Madhya Pradesh.
              </p>
              <p>
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
