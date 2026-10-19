import { Metadata } from "next";
import { PageHero } from "@/components/lux/page-hero";

export const metadata: Metadata = {
  title: "Refund and Cancellation Policy | Aarvasa",
  description: "Refund and Cancellation Policy for Aarvasa Innovations Pvt. Ltd.",
};

export default function RefundPolicyPage() {
  return (
    <div className="pb-24">
      <PageHero eyebrow="Aarvasa Innovations Pvt. Ltd." title="Refund and Cancellation Policy" size="compact" />
      <div className="mx-auto mt-4 max-w-4xl rounded-[28px] border border-rule bg-paper-raised/60 px-6 py-12 sm:px-12">

        <div className="prose prose-lg max-w-none text-ink-muted">
          <p className="mb-10 rounded-2xl border border-rule bg-paper-raised p-6 text-sm text-ink sm:text-base">
            Online payments and paid packages are not currently available through the Aarvasa website. The policy below
            describes paid packages; it does not mean that any package can currently be purchased here.
          </p>
          <section className="mb-10">
            <h2 className="heading-serif text-2xl text-ink mb-4 border-b border-rule pb-2">
              Moneyback Packages
            </h2>
            <div className="space-y-4 text-sm sm:text-base leading-relaxed">
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>For Resale:</strong> A non-refundable service and processing fee, equivalent to 25% of the total package price, will be deducted.</li>
                <li><strong>For Rental:</strong> A non-refundable service and processing fee, equivalent to 25% of the total package price, will be deducted.</li>
                <li>GST on service charges is non-refundable.</li>
                <li>The property must remain unsold or unleased for a refund to be eligible.</li>
                <li>Refund request must be submitted within 7 days of package expiry.</li>
                <li>No refund if 30+ buyer/tenant contacts have been reached.</li>
                <li>The company may request documents to verify refund claims.</li>
                <li>Refund approval is at the sole discretion of the company and is final.</li>
                <li>Contact our support team for assistance (see "Contact Us" section).</li>
                <li>All disputes are subject to exclusive court jurisdiction.</li>
              </ul>
            </div>
          </section>

          <section className="mb-10">
            <h2 className="heading-serif text-2xl text-ink mb-4 border-b border-rule pb-2">
              Payment Policy
            </h2>
            <div className="space-y-4 text-sm sm:text-base leading-relaxed">
              <ul className="list-disc pl-5 space-y-2">
                <li>Access is granted upon payment for listing leads and services as agreed.</li>
                <li>Listings are shown based on user-selected filters; visibility is not guaranteed.</li>
                <li>The company may collect and host details like carpet area, pricing, address, etc.</li>
                <li>No assurance is given for lead quantity or order of listing visibility.</li>
                <li>Platform visibility data maintained by our internal system is final and binding.</li>
                <li>You confirm rights to publish your listings and agree to follow applicable laws.</li>
                <li>Violations may result in indemnification of the company by the user.</li>
                <li>All platform-related IP remains the sole property of the company.</li>
                <li>The company reserves the right to remove content at its discretion.</li>
              </ul>
            </div>
          </section>

          <section className="mb-10">
            <h2 className="heading-serif text-2xl text-ink mb-4 border-b border-rule pb-2">
              Refund and Cancellation
            </h2>
            <div className="space-y-4 text-sm sm:text-base leading-relaxed">
              <ul className="list-disc pl-5 space-y-2">
                <li>Subscription can be canceled anytime with a refund within 7 days if unused.</li>
                <li>Once a package starts, cancellation or termination is not allowed.</li>
                <li>If package activation is delayed by the user beyond 2 days post-payment, it's considered consumed — no refund.</li>
                <li>No cancellation/refund is allowed once a package goes live on the platform.</li>
                <li>Refunds, if any, are solely at the company's discretion and are final.</li>
              </ul>
              <div className="mt-6 bg-claret/10 p-6 rounded-2xl border border-rule text-center">
                <p className="font-bold text-ink uppercase tracking-wide">
                  ONCE THE REFUND IS APPROVED, AMOUNT WILL BE CREDITED BACK TO THE ORIGINAL PAYMENT METHOD WITHIN 3-5 WORKING DAYS.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
