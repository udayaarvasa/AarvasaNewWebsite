import { Metadata } from "next";
import { PageHero } from "@/components/lux/page-hero";

export const metadata: Metadata = {
  title: "Privacy Policy | Aarvasa",
  description: "Privacy Policy for Aarvasa Innovations Pvt. Ltd.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="pb-24">
      <PageHero eyebrow="Effective Date: 01/07/2025" title="Privacy Policy" size="compact" />
      <div className="mx-auto mt-4 max-w-4xl rounded-[28px] border border-rule bg-paper-raised/60 px-6 py-12 sm:px-12">

        <div className="prose prose-lg max-w-none text-ink-muted">
          <section className="mb-10">
            <h2 className="heading-serif text-2xl text-ink mb-4 border-b border-rule pb-2">
              1. Introduction
            </h2>
            <div className="space-y-4 text-sm sm:text-base leading-relaxed">
              <p>
                Aarvasa Innovations Private Limited ("Aarvasa", "we", "us", or "our") is committed to protecting your privacy when using our website, apps, APIs, or services ("Services"). By using our Services, you consent to this Privacy Policy. If you disagree, do not use our Services. This policy works alongside our Terms of Service.
              </p>
            </div>
          </section>

          <section className="mb-10">
            <h2 className="heading-serif text-2xl text-ink mb-4 border-b border-rule pb-2">
              2. Data Collection: Categories and Methods
            </h2>
            <div className="space-y-4 text-sm sm:text-base leading-relaxed">
              <div>
                <strong className="text-ink">A. User-Provided Data:</strong>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li><strong>Account Info:</strong> Name, DOB, Aadhaar/PAN, address, phone, email, job info.</li>
                  <li><strong>Transactions:</strong> None through the website. Online payments are not currently available, so we do not collect UPI, card or bank details here.</li>
                  <li><strong>Support:</strong> Emails, chats, feedback, survey responses.</li>
                </ul>
              </div>
              <div>
                <strong className="text-ink">B. Automatically Collected Data:</strong> IP, browser, device, clickstream (via Google Analytics 4).
              </div>
              <div>
                <strong className="text-ink">C. Third-Party Sources:</strong> LinkedIn/X profiles via SSO, credit info (e.g., CIBIL) with consent.
              </div>
            </div>
          </section>

          <section className="mb-10">
            <h2 className="heading-serif text-2xl text-ink mb-4 border-b border-rule pb-2">
              3. Purpose of Data Processing
            </h2>
            <div className="space-y-4 text-sm sm:text-base leading-relaxed">
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>Contractual:</strong> Account, transactions, support.</li>
                <li><strong>Legal:</strong> Fraud, tax (Form 26AS), court orders.</li>
                <li><strong>Legitimate Interest:</strong> Optimization, marketing (opt-out available).</li>
                <li><strong>Consent:</strong> Newsletters, third-party sharing.</li>
              </ul>
            </div>
          </section>

          <section className="mb-10">
            <h2 className="heading-serif text-2xl text-ink mb-4 border-b border-rule pb-2">
              4. Disclosures and Data Sharing
            </h2>
            <div className="space-y-4 text-sm sm:text-base leading-relaxed">
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>Service Providers:</strong> AWS (Mumbai). No payment provider is used, as online payments are not currently available.</li>
                <li><strong>Regulators:</strong> SEBI, RBI, law enforcement.</li>
                <li><strong>Business Transfers:</strong> In mergers/acquisitions with notice.</li>
              </ul>
              <p className="font-semibold text-[#D4AF37]">We never sell your data for advertising purposes.</p>
            </div>
          </section>

          <section className="mb-10">
            <h2 className="heading-serif text-2xl text-ink mb-4 border-b border-rule pb-2">
              5. User Rights and Controls
            </h2>
            <div className="space-y-4 text-sm sm:text-base leading-relaxed">
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>Access:</strong> Export data from Dashboard in CSV/PDF.</li>
                <li><strong>Rectify/Delete:</strong> Fix errors unless retention is required.</li>
                <li><strong>Marketing:</strong> Unsubscribe from emails or use Google Ads Settings.</li>
              </ul>
            </div>
          </section>

          <section className="mb-10">
            <h2 className="heading-serif text-2xl text-ink mb-4 border-b border-rule pb-2">
              6. Security Measures
            </h2>
            <div className="space-y-4 text-sm sm:text-base leading-relaxed">
              <ul className="list-disc pl-5 space-y-2">
                <li>AES-256 for storage, TLS 1.3 in-transit encryption.</li>
                <li>Role-based access and employee biometrics.</li>
                <li>Blockchain logs for sensitive transactions.</li>
              </ul>
              <p className="mt-4 bg-white/5 p-4 rounded-xl border border-rule">
                <strong className="text-[#D4AF37]">User Tips:</strong> Enable 2FA. Never share passwords insecurely.
              </p>
            </div>
          </section>

          <section className="mb-10">
            <h2 className="heading-serif text-2xl text-ink mb-4 border-b border-rule pb-2">
              7. Data Retention Schedule
            </h2>
            <div className="space-y-4 text-sm sm:text-base leading-relaxed">
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>KYC:</strong> 10 years post-closure</li>
                <li><strong>Transaction History:</strong> 7 years (as per IT Act)</li>
                <li><strong>Marketing Preferences:</strong> Until user opts out</li>
              </ul>
            </div>
          </section>

          <section className="mb-10">
            <h2 className="heading-serif text-2xl text-ink mb-4 border-b border-rule pb-2">
              8. International Transfers
            </h2>
            <div className="space-y-4 text-sm sm:text-base leading-relaxed">
              <p>
                EU/UK data is processed in India with Standard Contractual Clauses (SCCs).
              </p>
            </div>
          </section>

          <section className="mb-10">
            <h2 className="heading-serif text-2xl text-ink mb-4 border-b border-rule pb-2">
              9. Policy Changes
            </h2>
            <div className="space-y-4 text-sm sm:text-base leading-relaxed">
              <p>
                We notify users of major changes 30 days in advance via email and app banners.
              </p>
            </div>
          </section>

          <section className="mb-10">
            <h2 className="heading-serif text-2xl text-ink mb-4 border-b border-rule pb-2">
              10. Grievance Redressal
            </h2>
            <div className="space-y-4 text-sm sm:text-base leading-relaxed">
              <p><strong>Data Protection Officer (DPO):</strong></p>
              <div className="bg-white/5 p-6 rounded-2xl border border-rule">
                <p>Mailing Address: Aarvasa Innovations Pvt. Ltd., 3 Flr, off Windsar Sq Opp,Vishal Megamart Kolar Rd, Kolar Road,Huzur, Bhopal- 462042, Madhya Pradesh.</p>
                <p>Noida, UP – 201301</p>
              </div>
            </div>
          </section>

          <section className="mb-10">
            <h2 className="heading-serif text-2xl text-ink mb-4 border-b border-rule pb-2">
              11. Jurisdiction-Specific Disclosures
            </h2>
            <div className="space-y-4 text-sm sm:text-base leading-relaxed">
              <div>
                <strong className="text-ink">California (CCPA):</strong>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Opt out of data "sales" (we don't sell).</li>
                  <li>Submit requests via privacy.aarvasa.com/ccpa</li>
                </ul>
              </div>
              <div className="mt-4">
                <strong className="text-ink">EU (GDPR):</strong> Refer to Section 3 for Legal Basis. Right to file complaints with authorities.
              </div>
            </div>
          </section>

          <div className="mt-16 p-8 bg-claret text-white rounded-3xl text-center shadow-luxury-xl">
            <p className="text-sm mb-4">
              This version replaces all previous editions.
            </p>
            <p className="text-ink-muted text-sm">
              © 2024 Aarvasa Technologies Pvt. Ltd. All rights reserved. "Aarvasa" and the lotus symbol are trademarks.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
