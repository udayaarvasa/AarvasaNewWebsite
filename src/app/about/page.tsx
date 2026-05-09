import Image from "next/image";
import { Award, Star, Users } from "lucide-react";

const milestones = [
  { month: "May", text: "Team Formation and Initial Planning" },
  { month: "June", text: "MVP Development Kickoff" },
  { month: "July", text: "Strategic Partnerships" },
  { month: "August", text: "MVP Testing Phase" },
  { month: "September", text: "Beta Launch with Core Features" },
];

const team = [
  {
    name: "Aarav Mehta",
    role: "Founder and Product Strategy",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=700&q=85",
  },
  {
    name: "Rohan Kapoor",
    role: "Real Estate Partnerships",
    image: "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=700&q=85",
  },
  {
    name: "Vikram Shah",
    role: "Investment Operations",
    image: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=700&q=85",
  },
  {
    name: "Karan Iyer",
    role: "AI and Data Systems",
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=700&q=85",
  },
  {
    name: "Dev Patel",
    role: "Blockchain Engineering",
    image: "https://images.unsplash.com/photo-1531891437562-4301cf35b7e4?auto=format&fit=crop&w=700&q=85",
  },
];

const stats = [
  { value: "12,000+", label: "Active Investors", icon: Users },
  { value: "₹12B+", label: "Portfolio Value", icon: Award },
  { value: "50+", label: "Cities Covered", icon: Star },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#F2F1ED]">
      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 pb-10 pt-32 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#DCCDCE]/60 bg-[#F5F4F1] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[#72383D]">
            About Aarvasa
          </div>
          <h1 className="heading-serif text-4xl tracking-tight text-[#50080E] sm:text-5xl">
            Building the Future of Property Investment
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-[#72383D]/70">
            Aarvasa is building a premium AI-powered real estate platform where property discovery, investment insights, agent support, and secure transaction workflows come together in one elegant experience.
          </p>
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-y border-[#DCCDCE]/40 bg-white">
        <div className="mx-auto grid max-w-7xl grid-cols-3 divide-x divide-[#DCCDCE]/30 px-4 sm:px-6 lg:px-8">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="flex items-center justify-center gap-3 py-8">
                <Icon className="h-5 w-5 text-[#D4AF37]" />
                <div>
                  <p className="text-2xl font-bold text-[#50080E]">{stat.value}</p>
                  <p className="text-xs text-[#72383D]/60">{stat.label}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Milestones */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="heading-serif text-3xl text-[#50080E]">
          Milestones &amp; Future Plans
        </h2>
        <p className="mt-2 text-sm text-[#72383D]/60">2024 — Our founding year</p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {milestones.map((item, i) => (
            <div
              key={item.month}
              className="rounded-2xl border border-[#DCCDCE]/40 bg-white p-5 shadow-luxury-sm transition hover:shadow-luxury"
            >
              <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#D4AF37] to-[#b9872f] text-sm font-bold text-white">
                {i + 1}
              </div>
              <h3 className="text-lg font-bold text-[#50080E]">{item.month}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#72383D]/70">
                {item.text}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Team */}
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
        <h2 className="heading-serif text-3xl text-[#50080E]">Meet Our Team</h2>
        <p className="mt-2 text-sm text-[#72383D]/60">
          The minds behind Aarvasa&apos;s intelligent platform.
        </p>

        <div className="mx-auto mt-10 grid max-w-5xl gap-6 md:grid-cols-2 xl:grid-cols-3">
          {team.slice(0, 3).map((member) => (
            <TeamCard key={member.name} member={member} />
          ))}
        </div>
        <div className="mx-auto mt-6 grid max-w-3xl gap-6 md:grid-cols-2">
          {team.slice(3).map((member) => (
            <TeamCard key={member.name} member={member} />
          ))}
        </div>
      </section>
    </div>
  );
}

function TeamCard({
  member,
}: {
  member: { name: string; role: string; image: string };
}) {
  return (
    <article className="group overflow-hidden rounded-2xl border border-[#DCCDCE]/40 bg-white shadow-luxury-sm transition hover:-translate-y-1 hover:shadow-luxury">
      <div className="relative aspect-square overflow-hidden">
        <Image
          src={member.image}
          alt={member.name}
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          className="object-cover transition duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#50080E]/30 to-transparent opacity-0 transition group-hover:opacity-100" />
      </div>
      <div className="border-t border-[#DCCDCE]/30 p-5">
        <h3 className="text-xl font-bold text-[#50080E]">{member.name}</h3>
        <p className="mt-1 text-sm font-medium text-[#72383D]/70">{member.role}</p>
      </div>
    </article>
  );
}
