import Image from "next/image";
import { BadgeCheck, Calendar, MapPin, Phone, Star } from "lucide-react";
import { Button } from "@/components/ui/button";

const agents = [
  {
    name: "Riya Sharma",
    city: "Mumbai",
    speciality: "Luxury Apartments",
    deals: "48 deals closed",
    rating: 4.9,
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=700&q=85",
  },
  {
    name: "Arjun Menon",
    city: "Bengaluru",
    speciality: "Commercial Properties",
    deals: "62 deals closed",
    rating: 4.8,
    image: "https://images.unsplash.com/photo-1568602471122-7832951cc4c5?auto=format&fit=crop&w=700&q=85",
  },
  {
    name: "Kabir Sethi",
    city: "Goa",
    speciality: "Luxury Villas",
    deals: "35 deals closed",
    rating: 4.9,
    image: "https://images.unsplash.com/photo-1564564321837-a57b7070ac4f?auto=format&fit=crop&w=700&q=85",
  },
];

export default function AgentsPage() {
  return (
    <div className="min-h-screen bg-[#F2F1ED]">
      <section className="mx-auto max-w-7xl px-4 pb-20 pt-32 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-12 max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#DCCDCE]/60 bg-[#F5F4F1] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[#72383D]">
            <BadgeCheck className="h-3.5 w-3.5 text-[#D4AF37]" />
            Verified Agents
          </div>
          <h1 className="heading-serif text-4xl tracking-tight text-[#50080E] sm:text-5xl">
            Your Personal Property Experts
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-[#72383D]/70">
            Work with verified local experts who understand micro-markets, price movements, site visits, and transaction readiness.
          </p>
        </div>

        {/* Agent grid */}
        <div className="grid gap-7 md:grid-cols-3">
          {agents.map((agent) => (
            <article
              key={agent.name}
              className="group overflow-hidden rounded-2xl border border-[#DCCDCE]/40 bg-white shadow-luxury-sm transition hover:-translate-y-1 hover:shadow-luxury"
            >
              <div className="relative aspect-[4/3] overflow-hidden">
                <Image
                  src={agent.image}
                  alt={agent.name}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover transition duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#50080E]/40 to-transparent opacity-0 transition group-hover:opacity-100" />
                <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 backdrop-blur-xl">
                  <BadgeCheck className="h-3.5 w-3.5 text-[#D4AF37]" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#50080E]">Verified</span>
                </div>
              </div>
              <div className="p-6">
                <h2 className="text-xl font-bold text-[#50080E]">{agent.name}</h2>
                <div className="mt-2 space-y-1.5">
                  <p className="flex items-center gap-2 text-sm text-[#72383D]/70">
                    <MapPin className="h-3.5 w-3.5 text-[#D4AF37]" />
                    {agent.city}
                  </p>
                  <p className="flex items-center gap-2 text-sm text-[#72383D]/70">
                    <Star className="h-3.5 w-3.5 fill-[#D4AF37] text-[#D4AF37]" />
                    {agent.rating} · {agent.deals}
                  </p>
                  <p className="text-xs text-[#72383D]/50">
                    Speciality: {agent.speciality}
                  </p>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" className="rounded-lg border-[#DCCDCE]/50 text-xs">
                    <Phone className="h-3 w-3" />
                    Call
                  </Button>
                  <Button variant="gold" size="sm" className="rounded-lg text-xs">
                    <Calendar className="h-3 w-3" />
                    Book Visit
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
