import Image from "next/image";
import { Mail, MapPin, Phone, PenLine, Send, Building2 } from "lucide-react";
import { ContactForm } from "./contact-form";
import { FramedImage } from "@/components/av/framed-image";
import { Note, Wrap } from "@/components/av/primitives";
import { ContourField, CoordinateMarks, DraftingGrid, Grain } from "@/components/av/graphics";
import { Reveal, TextReveal } from "@/components/av/motion";

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
 * The form used to have no submit handler at all while still rendering a
 * "Send message" button inside a <form>. A button in a form submits it, so the
 * click performed a native GET: the page reloaded, the message was lost, and
 * the visitor's name, email and phone were written into the URL — and from
 * there into browser history and server access logs — while nothing was
 * actually sent to anyone.
 *
 * There is no anonymous inquiry endpoint (/api/inquiries requires a session),
 * and inventing one is out of scope, so the form now composes the enquiry into
 * the visitor's own mail client. That is a real send the visitor can see and
 * confirm, rather than a button that appears to submit and does not.
 */
export default function ContactPage() {
  return (
    <div className="pb-[var(--s-24)]">
      <section
        data-surface="stage"
        className="relative isolate overflow-hidden bg-stage pb-[var(--s-14)] pt-[var(--s-18)]"
      >
        <div className="absolute inset-0 -z-10">
          <Image
            src="/images/reef-996/gallery/showapt-terrace-16x9.jpg"
            alt=""
            fill
            priority
            sizes="100vw"
            className="av-kenburns object-cover opacity-60"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(12,11,10,0.92)_0%,rgba(12,11,10,0.7)_50%,rgba(74,15,18,0.35)_100%)]" />
        </div>
        <Grain opacity={0.06} />
        <CoordinateMarks tone="stage" className="z-[2] max-md:hidden" />
        <span className="av-meta absolute right-[var(--gutter)] top-[var(--s-5)] z-[3] hidden rounded-xs border border-stage-rule bg-[rgba(12,11,10,0.66)] px-2 py-1 text-stage-ink backdrop-blur-sm md:block">
          Show apartment terrace · REEF 996
        </span>
        <Wrap className="relative z-[3]">
          <span className="av-label text-gold">Contact</span>
          <TextReveal
            as="h1"
            text="Talk to the desk"
            className="av-display mt-2 text-[clamp(34px,5vw,64px)] leading-[1.02] text-stage-ink"
          />
          <p className="mt-[var(--s-4)] max-w-[52ch] text-[17px] leading-relaxed text-stage-muted">
            A property enquiry reaches the developer or their appointed channel partner directly.
            Anything else reaches us.
          </p>
          <div className="mt-[var(--s-8)] flex flex-wrap gap-[var(--s-3)]">
            <a href="mailto:contact@aarvasa.com" className="av-gold av-label inline-flex items-center gap-2 px-6 py-[13px]">
              <Mail className="h-4 w-4" aria-hidden="true" /> Email the desk
            </a>
            <a
              href="tel:+916382083873"
              className="av-label inline-flex items-center gap-2 rounded-sm border border-stage-ink/35 px-6 py-[13px] text-stage-ink transition-colors hover:border-stage-ink hover:bg-white/5"
            >
              <Phone className="h-4 w-4" aria-hidden="true" /> +91 63820 83873
            </a>
          </div>
        </Wrap>
      </section>

      <Wrap className="pt-[var(--band-tight)]">
        <div className="grid grid-cols-1 items-start gap-[var(--s-10)] lg:grid-cols-[1.25fr_0.75fr]">
          <Reveal className="relative isolate overflow-hidden rounded-sm border border-rule bg-paper-raised p-[var(--s-5)] sm:p-[var(--s-8)]">
            <DraftingGrid size={32} fade="radial" className="opacity-20" />
            <div className="relative z-[2]">
            <h2 className="text-[17px] font-semibold">Send a message</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
              Tell us the city, the configuration and the budget you have in mind, and name any
              project you have already seen.
            </p>

            <ContactForm>
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
                    className="w-full rounded-xs border border-rule-firm bg-paper px-3 py-[10px] text-[14px] outline-none transition-[border-color,box-shadow] duration-200 hover:border-ink-muted focus:border-burgundy focus:shadow-[0_0_0_3px_var(--burgundy-wash)]"
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
                    className="w-full rounded-xs border border-rule-firm bg-paper px-3 py-[10px] text-[14px] outline-none transition-[border-color,box-shadow] duration-200 hover:border-ink-muted focus:border-burgundy focus:shadow-[0_0_0_3px_var(--burgundy-wash)]"
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
                    className="w-full rounded-xs border border-rule-firm bg-paper px-3 py-[10px] text-[14px] outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-ink-muted hover:border-ink-muted focus:border-burgundy focus:shadow-[0_0_0_3px_var(--burgundy-wash)]"
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
                    className="w-full rounded-xs border border-rule-firm bg-paper px-3 py-[10px] text-[14px] outline-none transition-[border-color,box-shadow] duration-200 hover:border-ink-muted focus:border-burgundy focus:shadow-[0_0_0_3px_var(--burgundy-wash)]"
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
                  className="w-full rounded-xs border border-rule-firm bg-paper px-3 py-[10px] text-[14px] leading-relaxed outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-ink-muted hover:border-ink-muted focus:border-burgundy focus:shadow-[0_0_0_3px_var(--burgundy-wash)]"
                />
              </div>

            </ContactForm>
            </div>
          </Reveal>

          <aside className="grid gap-[var(--s-8)]">
            {/* The office card, in the brand's own colours */}
            <div
              data-surface="wine"
              className="relative isolate overflow-hidden rounded-sm px-[var(--s-6)] py-[var(--s-10)] text-center shadow-[0_30px_70px_rgba(74,15,18,0.22)]"
            >
              <ContourField tone="stage" seed={7} className="opacity-20" />
              <div className="relative z-[2]">
                <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-gold/50 text-gold">
                  <Building2 className="h-5 w-5" aria-hidden="true" />
                </span>
                <h2 className="mt-[var(--s-4)] text-[19px] font-semibold text-wine-ink">Aarvasa Innovations Pvt. Ltd.</h2>
                <address className="mx-auto mt-3 max-w-[34ch] text-[14px] not-italic leading-relaxed text-wine-muted">
                  3 Flr, off Windsar Sq Opp, Vishal Megamart Kolar Rd, Kolar Road, Huzur, Bhopal-
                  462042, Madhya Pradesh.
                </address>
                <a
                  href="mailto:contact@aarvasa.com"
                  className="av-gold mt-[var(--s-6)] inline-flex items-center gap-2 px-5 py-3 text-[14px] font-semibold"
                >
                  <Mail className="h-4 w-4" aria-hidden="true" /> contact@aarvasa.com
                </a>
                <p className="mt-3 text-[12.5px] text-wine-muted">for general enquiries</p>
                <div className="mx-auto mt-[var(--s-6)] flex max-w-[260px] items-center justify-center gap-2 border-t border-wine-rule pt-[var(--s-5)] text-[14px] text-wine-ink">
                  <Phone className="h-4 w-4 text-gold" aria-hidden="true" />
                  <a href="tel:+916382083873" className="underline-offset-2 hover:underline">
                    +91 6382083873
                  </a>
                </div>
                <div className="mt-2 flex items-center justify-center gap-2 text-[12.5px] text-wine-muted">
                  <MapPin className="h-3.5 w-3.5 text-gold" aria-hidden="true" /> Bhopal, Madhya Pradesh
                </div>
              </div>
            </div>

            <FramedImage
              src="/images/reef-996/gallery/showapt-living-dining-4x5.jpg"
              alt="Living and dining room of the REEF 996 show apartment"
              caption="Show apartment · REEF 996"
              sizes="(min-width: 1024px) 380px, 100vw"
              className="aspect-[4/5] w-full max-lg:hidden"
            />

            <Note>
              Aarvasa holds no inventory and charges buyers nothing. Enquiries about a specific
              property are routed to that developer or their appointed channel partner.
            </Note>
          </aside>
        </div>

        {/* What happens next */}
        <ol className="mt-[var(--band-tight)] grid gap-px overflow-hidden border border-rule bg-rule md:grid-cols-3">
          {[
            { icon: PenLine, title: "Write it once", body: "Name the city, the configuration, the budget and any project you have seen." },
            { icon: Send, title: "Send from your mail", body: "Your mail app opens with the enquiry composed. Nothing leaves until you send it." },
            { icon: Building2, title: "Reach the right desk", body: "A property question goes to its developer or appointed partner; anything else, to us." },
          ].map(({ icon: Icon, title, body }, i) => (
            <li key={title} className="group bg-paper-raised p-[var(--s-6)] transition-colors duration-300 hover:bg-paper">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-wine text-gold transition-transform duration-500 group-hover:scale-110">
                  <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                </span>
                <span className="av-meta text-gold-ink">Step 0{i + 1}</span>
              </div>
              <h3 className="mt-[var(--s-4)] text-[16px] font-semibold">{title}</h3>
              <p className="mt-1 text-[14px] leading-relaxed text-ink-muted">{body}</p>
            </li>
          ))}
        </ol>
      </Wrap>
    </div>
  );
}
