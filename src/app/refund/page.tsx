import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Refund and Cancellation Policy | Aarvasa",
  description: "Refund and Cancellation Policy for Aarvasa Innovations Pvt. Ltd.",
};

export default function RefundPolicyPage() {
  return (
    <div className="min-h-screen bg-[#F2F1ED] pt-32 pb-24">
      <div className="mx-auto max-w-4xl px-6 sm:px-10">
        <div className="mb-12 text-center">
          <h1 className="heading-serif text-4xl sm:text-5xl text-[#50080E] mb-4">
            Refund and Cancellation Policy
          </h1>
        </div>

        <div className="prose prose-lg max-w-none text-[#50080E]/80">
          <section className="mb-10">
            <h2 className="heading-serif text-2xl text-[#50080E] mb-4 border-b border-[#DCCDCE] pb-2">
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
            <h2 className="heading-serif text-2xl text-[#50080E] mb-4 border-b border-[#DCCDCE] pb-2">
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
            <h2 className="heading-serif text-2xl text-[#50080E] mb-4 border-b border-[#DCCDCE] pb-2">
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
              <div className="mt-6 bg-[#50080E]/10 p-6 rounded-2xl border border-[#DCCDCE]/50 text-center">
                <p className="font-bold text-[#50080E] uppercase tracking-wide">
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
