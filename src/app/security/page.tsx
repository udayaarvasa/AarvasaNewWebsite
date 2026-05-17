import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Security Policy | Aarvasa",
  description: "Security Policy and Data Protection measures for Aarvasa Innovations Pvt. Ltd.",
};

export default function SecurityPolicyPage() {
  return (
    <div className="min-h-screen bg-[#F2F1ED] pt-32 pb-24">
      <div className="mx-auto max-w-4xl px-6 sm:px-10">
        <div className="mb-12 text-center">
          <h1 className="heading-serif text-4xl sm:text-5xl text-[#50080E] mb-4">
            Security Policy
          </h1>
          <p className="text-sm font-bold uppercase tracking-[0.15em] text-[#D4AF37]">
            How we protect your data and transactions
          </p>
        </div>

        <div className="prose prose-lg max-w-none text-[#50080E]/80">
          <section className="mb-10">
            <h2 className="heading-serif text-2xl text-[#50080E] mb-4 border-b border-[#DCCDCE] pb-2">
              1. Cloud Infrastructure & Hosting
            </h2>
            <div className="space-y-4 text-sm sm:text-base leading-relaxed">
              <ul className="list-disc pl-5 space-y-2">
                <li>Our systems are hosted on secure and compliant cloud platforms (AWS, Azure, or Google Cloud) for scalability, monitoring, and resilience.</li>
                <li>DDoS protection is enabled through AWS Shield, Azure DDoS Protection, or Google Cloud Armor.</li>
                <li>We use Infrastructure-as-Code (IaC) tools like Terraform and CloudFormation for reliable, version-controlled deployments.</li>
              </ul>
            </div>
          </section>

          <section className="mb-10">
            <h2 className="heading-serif text-2xl text-[#50080E] mb-4 border-b border-[#DCCDCE] pb-2">
              2. Network & Application Security
            </h2>
            <div className="space-y-4 text-sm sm:text-base leading-relaxed">
              <ul className="list-disc pl-5 space-y-2">
                <li>Networks are segmented for development, staging, and production to reduce blast radius in case of a breach.</li>
                <li>WAFs filter edge traffic to block SQL injections, XSS, and other attacks.</li>
                <li>Firewalls and antivirus tools are continuously running to detect and block malicious activity.</li>
              </ul>
            </div>
          </section>

          <section className="mb-10">
            <h2 className="heading-serif text-2xl text-[#50080E] mb-4 border-b border-[#DCCDCE] pb-2">
              3. Access Control
            </h2>
            <div className="space-y-4 text-sm sm:text-base leading-relaxed">
              <ul className="list-disc pl-5 space-y-2">
                <li>Access is granted strictly on a role-based basis (RBAC), with permissions limited to what is necessary.</li>
                <li>Multi-Factor Authentication (MFA) is enforced for cloud and admin tool access.</li>
                <li>Strict access controls ensure only authorized personnel access user data.</li>
              </ul>
            </div>
          </section>

          <section className="mb-10">
            <h2 className="heading-serif text-2xl text-[#50080E] mb-4 border-b border-[#DCCDCE] pb-2">
              4. Data Protection & Encryption
            </h2>
            <div className="space-y-4 text-sm sm:text-base leading-relaxed">
              <ul className="list-disc pl-5 space-y-2">
                <li>All data is encrypted using TLS in transit and AES-256 at rest.</li>
                <li>Backups are encrypted and securely stored for recovery purposes.</li>
                <li>Only necessary data is collected, and we never share or sell it without consent or legal requirement.</li>
                <li>Users have the right to request access, correction, or deletion of their personal data at any time.</li>
              </ul>
            </div>
          </section>

          <section className="mb-10">
            <h2 className="heading-serif text-2xl text-[#50080E] mb-4 border-b border-[#DCCDCE] pb-2">
              5. Payment & Transaction Security
            </h2>
            <div className="space-y-4 text-sm sm:text-base leading-relaxed">
              <ul className="list-disc pl-5 space-y-2">
                <li>Payments are handled by secure gateways like Razorpay, Stripe, and Paytm using SSL/TLS encryption.</li>
                <li>No card details are stored on our servers to avoid potential breaches.</li>
                <li>Two-factor authentication may be required for added transaction security.</li>
                <li>Customers receive instant confirmation via email, SMS, or push notification.</li>
                <li>Refunds follow the same secure channels with tracking and verification.</li>
                <li>High-risk transactions are flagged for manual verification to prevent fraud.</li>
              </ul>
            </div>
          </section>

          <section className="mb-10">
            <h2 className="heading-serif text-2xl text-[#50080E] mb-4 border-b border-[#DCCDCE] pb-2">
              6. Monitoring, Logging & Alerts
            </h2>
            <div className="space-y-4 text-sm sm:text-base leading-relaxed">
              <ul className="list-disc pl-5 space-y-2">
                <li>System activity is continuously monitored via tools like AWS CloudTrail, Azure Monitor, and SIEMs.</li>
                <li>Intrusion Detection Systems (IDS) and log collection help identify threats and breaches.</li>
                <li>Our security dashboards provide real-time visibility into system health and incidents.</li>
                <li>Automatic alerts notify teams of suspicious activity such as hacking attempts or service crashes.</li>
              </ul>
            </div>
          </section>

          <section className="mb-10">
            <h2 className="heading-serif text-2xl text-[#50080E] mb-4 border-b border-[#DCCDCE] pb-2">
              7. Threat Detection & Updates
            </h2>
            <div className="space-y-4 text-sm sm:text-base leading-relaxed">
              <ul className="list-disc pl-5 space-y-2">
                <li>Regular patching, vulnerability scans, and malware checks keep systems secure.</li>
                <li>Threat intelligence updates allow us to stay ahead of evolving cyber threats.</li>
                <li>Security audits are conducted routinely to validate and strengthen defenses.</li>
              </ul>
            </div>
          </section>

          <section className="mb-10">
            <h2 className="heading-serif text-2xl text-[#50080E] mb-4 border-b border-[#DCCDCE] pb-2">
              8. Incident Response & Recovery
            </h2>
            <div className="space-y-4 text-sm sm:text-base leading-relaxed">
              <ul className="list-disc pl-5 space-y-2">
                <li>A detailed incident response plan is in place to respond, contain, and report security issues swiftly.</li>
                <li>Audit logs and alert reviews are used to continuously improve threat detection and response strategies.</li>
              </ul>
            </div>
          </section>

          <section className="mb-10">
            <h2 className="heading-serif text-2xl text-[#50080E] mb-4 border-b border-[#DCCDCE] pb-2">
              9. Legal Compliance
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
