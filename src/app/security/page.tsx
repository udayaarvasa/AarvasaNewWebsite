import { Metadata } from "next";
import { PageHero } from "@/components/lux/page-hero";

export const metadata: Metadata = {
  title: "Security Policy | Aarvasa",
  alternates: { canonical: "/security" },
  description: "Security Policy and Data Protection measures for Aarvasa Innovations Pvt. Ltd.",
};

/*
 * Every statement on this page was checked against the running infrastructure
 * on 20 Oct 2026 (Amplify WAF association, CloudFront, RDS encryption and
 * rds.force_ssl, the restricted aarvasa_app role, root-account MFA). The
 * previous text described a generic multi-cloud estate — Azure, Google Cloud,
 * Terraform, network segmentation, antivirus, IDS, SIEM dashboards, threat
 * intelligence, routine audits — none of which Aarvasa runs. What is not yet in
 * place is said so in section 6 rather than implied.
 */
export default function SecurityPolicyPage() {
  return (
    <div className="pb-24">
      <PageHero eyebrow="Aarvasa Innovations Pvt. Ltd." title="Security Policy" size="compact" />
      <div className="mx-auto mt-4 max-w-4xl rounded-[28px] border border-rule bg-paper-raised/60 px-6 py-12 sm:px-12">

        <div className="prose prose-lg max-w-none text-ink-muted">
          <section className="mb-10">
            <h2 className="heading-serif text-2xl text-ink mb-4 border-b border-rule pb-2">
              1. Hosting
            </h2>
            <div className="space-y-4 text-sm sm:text-base leading-relaxed">
              <ul className="list-disc pl-5 space-y-2">
                <li>The website runs on Amazon Web Services: AWS Amplify Hosting behind the Amazon CloudFront network, with the database on Amazon RDS for PostgreSQL.</li>
                <li>Traffic to the website passes through an AWS WAF web application firewall, and CloudFront carries AWS Shield Standard protection against common network-level denial-of-service attacks.</li>
              </ul>
            </div>
          </section>

          <section className="mb-10">
            <h2 className="heading-serif text-2xl text-ink mb-4 border-b border-rule pb-2">
              2. Encryption
            </h2>
            <div className="space-y-4 text-sm sm:text-base leading-relaxed">
              <ul className="list-disc pl-5 space-y-2">
                <li>Connections to the website use HTTPS, with TLS 1.3 supported.</li>
                <li>The application connects to its database over TLS, and the database refuses unencrypted connections.</li>
                <li>The database and its automated backups are encrypted at rest with AWS-managed keys (AES-256).</li>
              </ul>
            </div>
          </section>

          <section className="mb-10">
            <h2 className="heading-serif text-2xl text-ink mb-4 border-b border-rule pb-2">
              3. Access control
            </h2>
            <div className="space-y-4 text-sm sm:text-base leading-relaxed">
              <ul className="list-disc pl-5 space-y-2">
                <li>The website reaches its database through a restricted account that can only read and write the application’s own data; it cannot change the database structure or manage other accounts.</li>
                <li>Administrative pages and actions are limited to accounts with the administrator role, checked on the server for every request.</li>
                <li>Multi-factor authentication is enabled on the cloud provider’s root account.</li>
              </ul>
            </div>
          </section>

          <section className="mb-10">
            <h2 className="heading-serif text-2xl text-ink mb-4 border-b border-rule pb-2">
              4. Your data
            </h2>
            <div className="space-y-4 text-sm sm:text-base leading-relaxed">
              <ul className="list-disc pl-5 space-y-2">
                <li>Only necessary data is collected, and we never share or sell it without consent or legal requirement.</li>
                <li>Users have the right to request access, correction, or deletion of their personal data at any time.</li>
              </ul>
            </div>
          </section>

          <section className="mb-10">
            <h2 className="heading-serif text-2xl text-ink mb-4 border-b border-rule pb-2">
              5. Payments
            </h2>
            <div className="space-y-4 text-sm sm:text-base leading-relaxed">
              <ul className="list-disc pl-5 space-y-2">
                <li>Online payments and paid packages are not currently available through the Aarvasa website, and no payment gateway is connected to it.</li>
                <li>The website does not collect or store card, UPI or bank account details.</li>
              </ul>
            </div>
          </section>

          <section className="mb-10">
            <h2 className="heading-serif text-2xl text-ink mb-4 border-b border-rule pb-2">
              6. What is still in progress
            </h2>
            <div className="space-y-4 text-sm sm:text-base leading-relaxed">
              <ul className="list-disc pl-5 space-y-2">
                <li>The database is still reachable from the internet (protected by its restricted account, enforced TLS and strong credentials); moving it onto a private network is scheduled.</li>
                <li>Centralised audit logging and automated threat detection are not yet enabled; they are planned.</li>
                <li>To report a security issue, please use the <a href="/contact" className="underline">contact page</a>.</li>
              </ul>
            </div>
          </section>

          <section className="mb-10">
            <h2 className="heading-serif text-2xl text-ink mb-4 border-b border-rule pb-2">
              7. Legal Compliance
            </h2>
            <div className="space-y-4 text-sm sm:text-base leading-relaxed">
              <p>
                We adhere to all applicable data protection laws including the Indian IT Act and GDPR for global users.
              </p>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
