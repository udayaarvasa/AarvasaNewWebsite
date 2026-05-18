import { Mail, MapPin, MessageSquare, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-[#F2F1ED]">
      <section className="mx-auto max-w-7xl px-4 pb-20 pt-32 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
          {/* Left content */}
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#DCCDCE]/60 bg-[#F5F4F1] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[#72383D]">
              <MessageSquare className="h-3.5 w-3.5 text-[#D4AF37]" />
              Contact
            </div>
            <h1 className="heading-serif text-4xl tracking-tight text-[#50080E] sm:text-5xl">
              Talk to Aarvasa About Your Next Investment
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-[#72383D]/70">
              Share your target city, budget, and preferred risk profile. The team can turn it into a clean investment shortlist.
            </p>
            <div className="mt-8 space-y-4">
              {[
                { icon: Mail, text: "contact@aarvasa.com" },
                { icon: Phone, text: "+91 6382083873" },
                { icon: MapPin, text: "3 Flr, off Windsar Sq Opp, Vishal Megamart Kolar Rd, Kolar Road, Huzur, Bhopal- 462042, Madhya Pradesh." },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.text} className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#50080E]/5">
                      <Icon className="h-4 w-4 text-[#50080E]" />
                    </div>
                    <span className="text-sm leading-relaxed text-[#72383D]/80 pt-2">{item.text}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Form card */}
          <div className="rounded-2xl border border-[#DCCDCE]/40 bg-white p-6 shadow-luxury-sm sm:p-8">
            <form className="grid gap-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-[#72383D]/70">Name</Label>
                  <Input placeholder="Ansh Dubey" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-[#72383D]/70">Email</Label>
                  <Input type="email" placeholder="you@company.com" />
                </div>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-[#72383D]/70">Budget</Label>
                  <Input placeholder="INR 50L" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-[#72383D]/70">Target City</Label>
                  <Input placeholder="Bangalore" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-[#72383D]/70">Investment Brief</Label>
                <textarea
                  className="min-h-32 w-full rounded-xl border border-[#DCCDCE]/50 bg-[#F5F4F1]/50 px-4 py-3 text-sm text-[#50080E] outline-none placeholder:text-[#72383D]/40 focus:ring-2 focus:ring-[#D4AF37]/40"
                  placeholder="Tell us what kind of returns, time horizon, and property type you prefer."
                />
              </div>
              <Button size="lg">Request Consultation</Button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}
