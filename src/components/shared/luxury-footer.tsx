import Link from "next/link";
import Image from "next/image";

const quickLinks = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About us" },
  { href: "/services", label: "Services" },
  { href: "/about#team", label: "Our team" },
];

const privacyTermsLinks = [
  { href: "/terms", label: "Terms and Conditions" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/refund", label: "Refund and Cancellation Policy" },
  { href: "/security", label: "Security" },
];

export function LuxuryFooter() {
  return (
    <footer className="footer-dark mt-auto">
      <div className="mx-auto max-w-7xl px-6 py-16 sm:px-10">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-12 lg:gap-8 xl:gap-12">
          {/* Brand column */}
          <div className="lg:col-span-3">
            <Link href="/" className="inline-block group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]/70 rounded-xl">
              <Image
                src="/aarvasa-navbar-logo.png"
                alt="Aarvasa Logo"
                width={653}
                height={169}
                className="h-12 w-auto max-w-[200px] transition-transform duration-300 group-hover:scale-[1.03]"
              />
            </Link>
            <p className="mt-5 max-w-xs text-sm font-semibold leading-relaxed text-[#F2F1ED]">
              Empowering individuals to own, lease, and monetize real estate
              through innovation and transparency.
            </p>
            <div className="mt-6 flex items-center gap-3">
              <a href="https://www.linkedin.com/company/aarvasa" target="_blank" rel="noopener noreferrer" className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1A1A1A] text-[#F2F1ED] transition-colors hover:bg-[#D4AF37]">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" /><rect width="4" height="12" x="2" y="9" /><circle cx="4" cy="4" r="2" /></svg>
              </a>
              <a href="https://x.com/aarvasa" target="_blank" rel="noopener noreferrer" className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1A1A1A] text-[#F2F1ED] transition-colors hover:bg-[#D4AF37]">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" /></svg>
              </a>
              <a href="https://www.instagram.com/theaarvasa/" target="_blank" rel="noopener noreferrer" className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1A1A1A] text-[#F2F1ED] transition-colors hover:bg-[#D4AF37]">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" x2="17.51" y1="6.5" y2="6.5" /></svg>
              </a>
              <a href="https://www.facebook.com/aarvasa" target="_blank" rel="noopener noreferrer" className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1A1A1A] text-[#F2F1ED] transition-colors hover:bg-[#D4AF37]">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></svg>
              </a>
            </div>
          </div>

          {/* Quick links */}
          <div className="lg:col-span-2">
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
          <div className="lg:col-span-3">
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
          <div className="lg:col-span-2">
            <h3 className="text-base font-bold text-[#F2F1ED]">
              Contact us
            </h3>
            <div className="mt-6 space-y-4 text-sm text-[#F2F1ED]">
              <p className="leading-relaxed">
                3 Flr, off Windsar Sq Opp, Vishal Megamart Kolar Rd, Kolar Road, Huzur,
                Bhopal - 462042, Madhya Pradesh.
              </p>
              <p>
                <a href="mailto:contact@aarvasa.com" className="transition hover:text-[#D4AF37]">contact@aarvasa.com</a>
              </p>
            </div>
          </div>

          {/* Download App */}
          <div className="lg:col-span-2">
            <h3 className="text-base font-bold text-[#F2F1ED]">
              Download our app
            </h3>
            <div className="mt-6 flex flex-col gap-3">
              <a 
                href="#" 
                className="flex items-center gap-3 rounded-lg border border-[#DCCDCE]/20 bg-[#1A1A1A] px-4 py-2.5 text-[#F2F1ED] transition-all hover:border-[#D4AF37]/50 hover:bg-[#D4AF37]/10 w-fit sm:w-full max-w-[200px]"
              >
                <svg viewBox="0 0 384 512" fill="currentColor" className="h-6 w-6" xmlns="http://www.w3.org/2000/svg">
                  <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"></path>
                </svg>
                <div className="flex flex-col text-left">
                  <span className="text-[10px] uppercase leading-none text-gray-400">Download on the</span>
                  <span className="text-sm font-semibold leading-none mt-1">App Store</span>
                </div>
              </a>
              <a 
                href="#" 
                className="flex items-center gap-3 rounded-lg border border-[#DCCDCE]/20 bg-[#1A1A1A] px-4 py-2.5 text-[#F2F1ED] transition-all hover:border-[#D4AF37]/50 hover:bg-[#D4AF37]/10 w-fit sm:w-full max-w-[200px]"
              >
                <svg viewBox="0 0 512 512" fill="currentColor" className="h-6 w-6" xmlns="http://www.w3.org/2000/svg">
                  <path d="M325.3 234.3L104.6 13l280.8 161.2-60.1 60.1zM47 0C34 6.8 25.3 19.2 25.3 35.3v441.3c0 16.1 8.7 28.5 21.7 35.3l256.6-256L47 0zm425.2 225.6l-58.9-34.1-65.7 64.5 65.7 64.5 60.1-34.1c18-14.3 18-46.5-1.2-60.8zM104.6 499l280.8-161.2-60.1-60.1L104.6 499z"></path>
                </svg>
                <div className="flex flex-col text-left">
                  <span className="text-[10px] uppercase leading-none text-gray-400">GET IT ON</span>
                  <span className="text-sm font-semibold leading-none mt-1">Google Play</span>
                </div>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-[#DCCDCE]/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-center gap-3 px-6 py-6 sm:px-10">
          <p className="text-center text-xs text-[#F2F1ED] sm:text-sm">
            © Aarvasa Innovations Pvt. Ltd. | All rights reserved &nbsp;&nbsp;&nbsp; GSTIN - 23ADPPD8193B1ZN &nbsp;&nbsp;&nbsp; CIN - U68200MP2025PTC076282
          </p>
        </div>
      </div>
    </footer>
  );
}
