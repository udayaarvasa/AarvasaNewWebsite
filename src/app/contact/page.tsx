import { Button } from "@/components/ui/button";
import { Ledger, Note, SectionHead, Wrap } from "@/components/av/primitives";

export const metadata = {
  title: "Contact | Aarvasa",
  description:
    "Talk to the Aarvasa desk. A property enquiry reaches the developer directly; anything else reaches us.",
};

/**
 * Contact details are reproduced exactly as filed.
 *
 * The page previously asked for a "preferred risk profile" and "what kind of
 * returns" to build an "investment shortlist". Aarvasa does not offer an
 * investment service, so the form asks what it can actually act on.
 *
 * Note: as before this redesign, the form is presentational — it has no
 * submit handler. Wiring it to the existing Inquiry model is backend work and
 * is deliberately out of scope for a visual redesign.
 */
export default function ContactPage() {
  return (
    <div className="pb-[var(--s-24)]">
      <Wrap className="pt-[var(--s-10)]">
        <span className="av-label text-gold-ink">Contact</span>
        <h1 className="av-display mt-2 text-[clamp(32px,4.4vw,52px)] leading-[1.04]">
          Talk to the desk
        </h1>
        <p className="mt-[var(--s-4)] max-w-[52ch] text-[17px] leading-relaxed text-ink-muted">
          A property enquiry reaches the developer or their appointed channel partner directly.
          Anything else reaches us.
        </p>
      </Wrap>

      <Wrap className="pt-[var(--band-tight)]">
        <div className="grid items-start gap-[var(--s-10)] lg:grid-cols-[1.25fr_0.75fr]">
          <div className="rounded-sm border border-rule bg-paper-raised p-[var(--s-5)] sm:p-[var(--s-8)]">
            <h2 className="text-[17px] font-semibold">Send a message</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
              Tell us the city, the configuration and the budget you have in mind, and name any
              project you have already seen.
            </p>

            <form className="mt-[var(--s-6)] grid gap-[var(--s-4)]">
              <div className="grid gap-[var(--s-4)] sm:grid-cols-2">
                <div>
                  <label htmlFor="c-name" className="av-label mb-1 block text-ink-muted">
                    Name
                  </label>
                  <input
                    id="c-name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    className="w-full rounded-xs border border-rule-firm bg-paper px-3 py-[10px] text-[14px] outline-none focus:border-burgundy"
                  />
                </div>
                <div>
                  <label htmlFor="c-email" className="av-label mb-1 block text-ink-muted">
                    Email
                  </label>
                  <input
                    id="c-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    className="w-full rounded-xs border border-rule-firm bg-paper px-3 py-[10px] text-[14px] outline-none focus:border-burgundy"
                  />
                </div>
              </div>

              <div className="grid gap-[var(--s-4)] sm:grid-cols-2">
                <div>
                  <label htmlFor="c-phone" className="av-label mb-1 block text-ink-muted">
                    Phone
                  </label>
                  <input
                    id="c-phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    placeholder="+91"
                    className="w-full rounded-xs border border-rule-firm bg-paper px-3 py-[10px] text-[14px] outline-none placeholder:text-ink-muted focus:border-burgundy"
                  />
                </div>
                <div>
                  <label htmlFor="c-city" className="av-label mb-1 block text-ink-muted">
                    City of interest
                  </label>
                  <input
                    id="c-city"
                    name="city"
                    type="text"
                    className="w-full rounded-xs border border-rule-firm bg-paper px-3 py-[10px] text-[14px] outline-none focus:border-burgundy"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="c-message" className="av-label mb-1 block text-ink-muted">
                  What would you like to know?
                </label>
                <textarea
                  id="c-message"
                  name="message"
                  rows={5}
                  placeholder="Configuration, budget, and any project you have already looked at."
                  className="w-full rounded-xs border border-rule-firm bg-paper px-3 py-[10px] text-[14px] leading-relaxed outline-none placeholder:text-ink-muted focus:border-burgundy"
                />
              </div>

              <Button size="lg" className="w-full sm:w-auto sm:justify-self-start">
                Send message
              </Button>

              <p className="text-[12px] leading-relaxed text-ink-muted">
                By sending this you agree that we may share it with the developer of any property
                you name.
              </p>
            </form>
          </div>

          <aside className="grid gap-[var(--s-5)]">
            <div>
              <SectionHead label="Reach us" className="mb-[var(--s-4)]" />
              <Ledger
                rows={[
                  {
                    term: "Email",
                    value: (
                      <a href="mailto:contact@aarvasa.com" className="underline-offset-2 hover:underline">
                        contact@aarvasa.com
                      </a>
                    ),
                  },
                  {
                    term: "Phone",
                    value: (
                      <a href="tel:+916382083873" className="underline-offset-2 hover:underline">
                        +91 6382083873
                      </a>
                    ),
                  },
                ]}
              />
            </div>

            <div>
              <span className="av-label text-ink-muted">Registered office</span>
              <address className="mt-2 text-[13.5px] not-italic leading-relaxed text-ink-muted">
                3 Flr, off Windsar Sq Opp, Vishal Megamart Kolar Rd, Kolar Road, Huzur, Bhopal-
                462042, Madhya Pradesh.
              </address>
            </div>

            <Note>
              Aarvasa holds no inventory and charges buyers nothing. Enquiries about a specific
              property are routed to that developer or their appointed channel partner.
            </Note>
          </aside>
        </div>
      </Wrap>
    </div>
  );
}
