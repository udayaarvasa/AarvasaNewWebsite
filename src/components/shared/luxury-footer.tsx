import Link from "next/link";
import Image from "next/image";

const quickLinks = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About us" },
  { href: "/services", label: "Services" },
  { href: "/about#team", label: "Our team" },
];

const privacyTermsLinks = [
  { href: "#", label: "Terms and Conditions" },
  { href: "#", label: "Privacy Policy" },
  { href: "#", label: "Refund and Cancellation Policy" },
  { href: "#", label: "Security" },
];

export function LuxuryFooter() {
  return (
    <footer className="footer-dark mt-auto">
      <div className="mx-auto max-w-7xl px-6 py-16 sm:px-10">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand column */}
          <div className="lg:col-span-1">
            <Link href="/" className="flex items-center gap-3">
              <div className="relative h-12 w-12 flex-shrink-0">
                <img 
                  src="/logo-icon.png" 
                  alt="Aarvasa Icon" 
                  className="h-full w-full object-contain brightness-110"
                />
              </div>
              <div className="flex flex-col justify-center leading-[1.1]">
                <span className="font-serif text-xl font-black uppercase tracking-[0.05em] text-[#F2F1ED]">
                  Aarvasa
                </span>
                <span className="text-[7px] font-bold uppercase tracking-[0.12em] text-[#D4AF37]">
                  Building Dreams, Securing Futures
                </span>
              </div>
            </Link>
            <p className="mt-5 max-w-xs text-sm font-semibold leading-relaxed text-[#F2F1ED]">
              Empowering individuals to own, lease, and monetize real estate
              through innovation and transparency.
            </p>
            <div className="mt-6 flex items-center gap-3">
              <a href="#" className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1A1A1A] text-[#F2F1ED] transition-colors hover:bg-[#D4AF37]">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/></svg>
              </a>
              <a href="#" className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1A1A1A] text-[#F2F1ED] transition-colors hover:bg-[#D4AF37]">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"/></svg>
              </a>
              <a href="#" className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1A1A1A] text-[#F2F1ED] transition-colors hover:bg-[#D4AF37]">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
              </a>
              <a href="#" className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1A1A1A] text-[#F2F1ED] transition-colors hover:bg-[#D4AF37]">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
              </a>
            </div>
          </div>

          {/* Quick links */}
          <div>
            <h3 className="text-base font-bold text-[#F2F1ED]">
              Quick links
            </h3>
            <ul className="mt-6 space-y-4">
              {quickLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-[#F2F1ED] transition hover:text-[#D4AF37]"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Privacy & terms */}
          <div>
            <h3 className="text-base font-bold text-[#F2F1ED]">
              Privacy & terms
            </h3>
            <ul className="mt-6 space-y-4">
              {privacyTermsLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-[#F2F1ED] transition hover:text-[#D4AF37]"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact us */}
          <div>
            <h3 className="text-base font-bold text-[#F2F1ED]">
              Contact us
            </h3>
            <div className="mt-6 space-y-4 text-sm text-[#F2F1ED]">
              <p className="leading-relaxed">
                3 Flr, off Windsar Sq Opp,Vishal Megamart Kolar Rd, Kolar Road,Huzur,
                Bhopal- 462042, Madhya Pradesh.
              </p>
              <p>
                <a href="mailto:theaarvasa@gmail.com" className="transition hover:text-[#D4AF37]">theaarvasa@gmail.com</a>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-[#DCCDCE]/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-center gap-3 px-6 py-6 sm:px-10">
          <p className="text-center text-xs text-[#F2F1ED] sm:text-sm">
            © Aarvasa Innovations Pvt. Ltd. | All rights reserved &nbsp;&nbsp;&nbsp; GSTIN - 23AAKCT9224E1ZD &nbsp;&nbsp;&nbsp; CIN - U68200MP2025PTC076282
          </p>
        </div>
      </div>
    </footer>
  );
}
