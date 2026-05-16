"use client";

import { motion, type Variants, useScroll, useTransform } from "framer-motion";
import Image from "next/image";
import { useRef } from "react";
import {
  ArrowRight,
  Award,
  BadgeCheck,
  BrainCircuit,
  ShieldCheck,
  BarChart4,
  Cpu,
  Building2,
  Gem,
  TrendingUp,
  Globe,
  Landmark,
  MapPin,
  Medal,
  Newspaper,
  Rocket,
  Lock,
  Search,
  CheckCircle2,
  Trophy,
} from "lucide-react";

// ─── Data Arrays ─────────────────────────────────────────────────────────────

const team = [
  {
    name: "Uday Prakash Sahu",
    role: "Founder & CEO",
    subtitle: "Expert in Networking & Sales | External Affairs Lead",
    bio: "Uday Sahu leads Aarvasa as CEO, driving growth, partnerships, and market expansion. With expertise in business networking and real estate sales, he strengthens stakeholder relations and positions Aarvasa as a key player in property investment.",
    image: "/images/team/uday.png",
  },
  {
    name: "Ansh Dubey",
    role: "Co-Founder & COO",
    subtitle: "Operations Strategist | Product & Process Leader",
    bio: "Ansh Dubey, COO of Aarvasa, oversees operations, workflow optimization, and product delivery. Focused on efficiency, he ensures smooth platform functionality, from listings to customer experience, translating ideas into scalable, real-world execution.",
    image: "/images/team/ansh.png",
  },
  {
    name: "Anirudh Saxena",
    role: "Co-Founder & CTO",
    subtitle: "Tech Architect | Innovation & Engineering Lead",
    bio: "Anirudh Saxena, CTO of Aarvasa, drives AI tools, smart contracts, and infrastructure development. He ensures a secure, scalable tech foundation, shaping the digital systems that power Aarvasa’s platform and future growth.",
    image: "/images/team/anirudh.png",
  },
  {
    name: "Sriaditya S",
    role: "VP of IT Operations",
    subtitle: "Technology Strategist | System Architect | Cybersecurity Advocate",
    bio: "Sriaditya S leads IT Operations at Aarvasa, managing the company’s digital infrastructure, cloud systems, and cybersecurity. He ensures platform stability, secure workflows, and drives Aarvasa’s tech innovations for scalable business growth.",
    image: "/images/team/sriaditya.png",
  },
];

const technologies = [
  { icon: BrainCircuit, title: "AI Investment Advisor", desc: "Dynamic recommendations blending proprietary data with market signals." },
  { icon: BarChart4, title: "Predictive Analytics", desc: "Forecasting yield and appreciation across micro-markets." },
  { icon: ShieldCheck, title: "Blockchain Verification", desc: "Immutable title checks and transparent transaction histories." },
  { icon: Lock, title: "Smart Escrow Systems", desc: "Automated, secure capital deployment via smart contracts." },
  { icon: TrendingUp, title: "ROI Intelligence Engine", desc: "Real-time risk-adjusted return calculations." },
  { icon: Search, title: "Market Sentiment Analysis", desc: "Aggregating infrastructure, news, and demand indicators." },
];

const nodes = [
  { city: "Bengaluru AI Hub", purpose: "Technology & Core Data", growth: "Active HQ", image: "https://images.unsplash.com/photo-1596176530529-78163a4f7af2?auto=format&fit=crop&w=800&q=80" },
  { city: "Dubai Expansion", purpose: "Global Capital Inflow", growth: "Q3 2025", image: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=800&q=80" },
  { city: "London Node", purpose: "Institutional Partnerships", growth: "Q1 2026", image: "https://images.unsplash.com/photo-1529655683826-aba9b3e77383?auto=format&fit=crop&w=800&q=80" },
  { city: "New York Nexus", purpose: "PropTech Innovation", growth: "2026+", image: "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?auto=format&fit=crop&w=800&q=80" },
];

const milestones = [
  { year: "2024", items: ["Team Formation and Initial Planning", "MVP Development Kickoff", "Strategic Partnerships", "MVP Testing Phase", "Beta Launch with Core Features"] },
  { year: "2025", items: ["AI Investment Advisor Launch", "Fractional Investment Module", "Blockchain Escrow Integration", "Multi-City Expansion", "Investor Dashboard Rollout"] },
  { year: "2026+", items: ["International Expansion", "AI Market Prediction Engine", "Institutional Partnerships", "Smart Contract Automation"] },
];

const partners = ["TimeSlotter Pvt Ltd", "PS Associates", "Paramjyoti Pvt Ltd", "Ealth Technologies", "Softwave Solutions"];

const recognitionStats = [
  { value: "7+", label: "National Startup Recognitions", icon: Trophy },
  { value: "NVIDIA", label: "Inception Selection", icon: Cpu },
  { value: "Top 25", label: "Startup Recognition", icon: Medal },
  { value: "AI-Driven", label: "Innovation", icon: BrainCircuit },
];

const awards = [
  {
    title: "2nd Runner-Up - GSEA Indore",
    description:
      "Recognized at GSEA Indore for innovation, scalability, and impact in the PropTech and AI-driven real estate sector.",
    icon: Trophy,
    badge: "Entrepreneurship",
  },
  {
    title: "Top 25 Startups Across India - Build 3",
    description:
      "Selected among the Top 25 startups across India through a highly competitive national startup selection process.",
    icon: Medal,
    badge: "National Selection",
  },
  {
    title: "NVIDIA Inception Program",
    description:
      "Selected for the NVIDIA Inception Program, recognizing Aarvasa as a high-potential AI-driven startup building innovative technology solutions.",
    icon: Cpu,
    badge: "AI Ecosystem",
  },
  {
    title: "Startup India Recognition",
    description:
      "Officially recognized and registered under Startup India as an emerging innovation-driven startup.",
    icon: BadgeCheck,
    badge: "Government Recognition",
  },
  {
    title: "VIT-TBI Pre-Incubated Startup",
    description:
      "Recognized as a Pre-Incubated Startup at VIT Technology Business Incubator (VIT-TBI), supporting the growth of transformative technology ventures.",
    icon: Rocket,
    badge: "Incubation",
  },
  {
    title: "Media & Entrepreneurship Features",
    description:
      "Featured in startup and entrepreneurship platforms including KaroStartup and IndiaPreneur for innovation in AI-powered real estate and investment solutions.",
    icon: Newspaper,
    badge: "Media Features",
  },
  {
    title: "Technology-Driven Real Estate Innovation",
    description:
      "Recognized by startup and academic evaluation panels for building a technology-first platform focused on transparency, affordability, and intelligent investment insights in real estate.",
    icon: Gem,
    badge: "PropTech Innovation",
  },
];

const recognitionTimeline = [
  "Startup validation",
  "National shortlisting",
  "AI ecosystem selection",
  "Incubation support",
  "Media visibility",
];

const heroParticles = [
  { left: "8%", bottom: "-4%", delay: "0s", duration: "12s" },
  { left: "16%", bottom: "-12%", delay: "1.2s", duration: "18s" },
  { left: "24%", bottom: "-8%", delay: "3.4s", duration: "16s" },
  { left: "31%", bottom: "-15%", delay: "2.1s", duration: "22s" },
  { left: "39%", bottom: "-6%", delay: "5.6s", duration: "14s" },
  { left: "48%", bottom: "-18%", delay: "0.8s", duration: "20s" },
  { left: "55%", bottom: "-10%", delay: "4.4s", duration: "17s" },
  { left: "63%", bottom: "-5%", delay: "2.9s", duration: "24s" },
  { left: "70%", bottom: "-14%", delay: "6.2s", duration: "15s" },
  { left: "77%", bottom: "-7%", delay: "1.7s", duration: "19s" },
  { left: "84%", bottom: "-16%", delay: "3.8s", duration: "21s" },
  { left: "91%", bottom: "-9%", delay: "5.1s", duration: "13s" },
  { left: "6%", bottom: "-19%", delay: "7.3s", duration: "23s" },
  { left: "52%", bottom: "-3%", delay: "6.7s", duration: "18s" },
  { left: "96%", bottom: "-13%", delay: "2.5s", duration: "16s" },
];

// ─── Animation Variants ──────────────────────────────────────────────────────

const fadeIn: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] as any } }
};

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15 }
  }
};

// ─── Main Page Component ─────────────────────────────────────────────────────

export default function AboutPage() {
  const heroRef = useRef(null);
  const { scrollYProgress: heroScroll } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const yHero = useTransform(heroScroll, [0, 1], [0, 300]);
  const opacityHero = useTransform(heroScroll, [0, 1], [1, 0]);

  return (
    <div className="min-h-screen bg-[#F2F1ED] overflow-x-hidden">
      
      {/* 1. HERO SECTION */}
      <section ref={heroRef} className="relative h-[100vh] min-h-[700px] w-full overflow-hidden flex items-center justify-center pt-20">
        <motion.div style={{ y: yHero, opacity: opacityHero }} className="absolute inset-0 z-0">
          <Image
            src="https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=2000&q=85"
            alt="Luxury Architecture"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 about-hero-gradient backdrop-blur-[2px]" />
        </motion.div>

        {/* Animated Particles */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          {heroParticles.map((particle, i) => (
            <div
              key={i}
              className="absolute w-1.5 h-1.5 bg-[#D4AF37]/40 rounded-full animate-particle-drift"
              style={{
                left: particle.left,
                bottom: particle.bottom,
                animationDelay: particle.delay,
                animationDuration: particle.duration,
              }}
            />
          ))}
        </div>

        <div className="relative z-10 mx-auto max-w-6xl px-6 text-center flex flex-col items-center justify-center w-full">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, ease: "easeOut" as any }}
            className="inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/30 bg-[#0b0b0b]/60 px-5 py-2 text-xs font-bold uppercase tracking-[0.2em] text-[#D4AF37] backdrop-blur-md mb-8"
          >
            <BrainCircuit className="w-4 h-4" /> The Future of PropTech
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.2 }}
            className="heading-serif text-5xl sm:text-6xl md:text-7xl lg:text-8xl text-white tracking-tight mb-6"
          >
            The Architecture of <span className="gold-shimmer-text">Intelligence</span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.4 }}
            className="mx-auto max-w-3xl text-lg sm:text-xl text-[#DCCDCE] leading-relaxed mb-10 font-light"
          >
            Where AI, blockchain, and strategic real estate intelligence converge to redefine modern property investment.
          </motion.p>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.6 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-5 mb-16 lg:mb-24"
          >
            <button className="w-full sm:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#b9872f] text-[#50080E] font-bold tracking-wide transition-all hover:scale-105 hover:shadow-glow flex items-center justify-center gap-2">
              Explore Vision <ArrowRight className="w-4 h-4" />
            </button>
            <button className="w-full sm:w-auto px-8 py-4 rounded-xl border border-[#DCCDCE]/30 bg-white/5 text-white backdrop-blur-md font-semibold tracking-wide transition-all hover:bg-white/10 flex items-center justify-center gap-2">
              Meet The Team
            </button>
          </motion.div>

          {/* Floating Metrics */}
          <div className="hidden md:flex justify-center gap-6 px-6 w-full">
            {[
              { v: "₹70+ Crores", l: "Property Value" },
              { v: "AI-Driven", l: "Analytics" },
              { v: "Smart", l: "Advisory" },
              { v: "Verified", l: "Network" }
            ].map((metric, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.8 + (i * 0.1) }}
                className="glass-card !bg-black/40 !border-white/10 px-6 py-4 rounded-2xl flex flex-col items-center animate-float"
                style={{ animationDelay: `${i * 0.5}s` }}
              >
                <span className="text-xl font-bold text-[#D4AF37]">{metric.v}</span>
                <span className="text-xs uppercase tracking-widest text-[#DCCDCE]">{metric.l}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 2. VISION + MISSION SECTION */}
      <section className="relative z-20 py-32 bg-[#F2F1ED]">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div 
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={fadeIn}
              className="relative aspect-[4/5] rounded-3xl overflow-hidden shadow-luxury-xl group"
            >
              <Image
                src="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=85"
                alt="Corporate Vision"
                fill
                className="object-cover transition-transform duration-[1.5s] group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#50080E]/80 via-transparent to-transparent" />
              <div className="absolute bottom-10 left-10 right-10">
                <div className="w-16 h-1 bg-[#D4AF37] mb-6 rounded-full" />
                <h3 className="heading-serif text-3xl text-white leading-tight">Elevating<br/>The Asset Class</h3>
              </div>
            </motion.div>

            <motion.div 
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={staggerContainer}
              className="space-y-10"
            >
              <motion.div variants={fadeIn} className="glass-card p-10 rounded-3xl border-[#DCCDCE]/60 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#D4AF37]/10 rounded-full blur-3xl" />
                <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-[#D4AF37] mb-4">Our Vision</h2>
                <p className="text-2xl text-[#50080E] font-medium leading-relaxed heading-serif">
                  Aarvasa was built to transform how modern investors discover, analyze, and secure real estate opportunities using artificial intelligence, predictive analytics, and strategic market intelligence.
                </p>
              </motion.div>

              <motion.div variants={fadeIn} className="space-y-6">
                <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-[#72383D]">Our Mission</h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  {[
                    "AI-powered property discovery",
                    "Blockchain-backed transparency",
                    "Luxury real estate curation",
                    "Predictive ROI intelligence",
                    "Fractional investment innovation"
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-3 p-4 rounded-2xl bg-white border border-[#DCCDCE]/40 shadow-luxury-sm hover:shadow-luxury transition-all">
                      <div className="mt-0.5 rounded-full bg-[#50080E]/5 p-1">
                        <CheckCircle2 className="w-4 h-4 text-[#D4AF37]" />
                      </div>
                      <span className="text-sm font-medium text-[#72383D]">{item}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 3. STRATEGIC EXPANSION */}
      <section className="py-32 bg-white relative overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-[#D4AF37]/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="mx-auto max-w-7xl px-6">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeIn}
            className="text-center max-w-3xl mx-auto mb-20"
          >
            <h2 className="heading-serif text-4xl md:text-5xl text-[#50080E] mb-6">Strategic Expansion</h2>
            <p className="text-lg text-[#72383D]/80">The next generation of investment infrastructure across global growth corridors.</p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
            {nodes.map((node, i) => (
              <motion.div
                key={node.city}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.6, delay: i * 0.1 }}
                className="group relative rounded-3xl overflow-hidden aspect-[16/10] shadow-luxury"
              >
                <Image src={node.image} alt={node.city} fill className="object-cover transition-transform duration-1000 group-hover:scale-110" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b0b] via-[#0b0b0b]/40 to-transparent opacity-80 group-hover:opacity-90 transition-opacity" />
                
                <div className="absolute inset-0 p-8 flex flex-col justify-end">
                  <div className="flex justify-between items-end">
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <MapPin className="w-4 h-4 text-[#D4AF37]" />
                        <span className="text-xs font-bold tracking-widest text-[#D4AF37] uppercase">{node.growth}</span>
                      </div>
                      <h3 className="heading-serif text-3xl text-white mb-2">{node.city}</h3>
                      <p className="text-sm text-[#DCCDCE]">{node.purpose}</p>
                    </div>
                    <div className="w-12 h-12 rounded-full border border-white/20 flex items-center justify-center backdrop-blur-md transition-transform group-hover:bg-[#D4AF37] group-hover:border-transparent group-hover:scale-110">
                      <ArrowRight className="w-5 h-5 text-white" />
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. COMPANY PARTNERS */}
      <section className="py-24 bg-[#50080E] relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,rgba(212,175,55,0.4)_0%,transparent_70%)]" />
        
        <div className="mx-auto max-w-7xl px-6 relative z-10">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeIn}
            className="text-center max-w-3xl mx-auto mb-16"
          >
            <h2 className="heading-serif text-3xl md:text-4xl text-white mb-4">Strategic Industry Partnerships</h2>
            <p className="text-[#DCCDCE]/80">Collaborating with innovators shaping the future of technology, infrastructure, and intelligent investment ecosystems.</p>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
            {partners.map((partner, i) => (
              <motion.div
                key={partner}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="glass-card !bg-white/5 !border-white/10 rounded-2xl p-6 flex items-center justify-center text-center group hover:!bg-white/10 transition-colors"
              >
                <span className="font-bold text-[#DCCDCE] group-hover:text-white transition-colors">{partner}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. AWARDS & RECOGNITION */}
      <section className="relative overflow-hidden bg-[#F2F1ED] py-32">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute left-1/2 top-0 h-[42rem] w-[42rem] -translate-x-1/2 rounded-full bg-[#D4AF37]/10 blur-[120px]" />
          <div className="absolute -left-32 bottom-12 h-80 w-80 rounded-full bg-[#50080E]/10 blur-[90px]" />
          <div className="absolute right-0 top-24 h-96 w-96 rounded-full bg-[#72383D]/10 blur-[110px]" />
        </div>

        <div className="relative z-10 mx-auto max-w-7xl px-6">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeIn}
            className="mx-auto mb-16 max-w-4xl text-center"
          >
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/30 bg-white/60 px-5 py-2 text-xs font-bold uppercase tracking-[0.2em] text-[#D4AF37] shadow-luxury-sm backdrop-blur-xl">
              <Award className="h-4 w-4" />
              Startup Credibility
            </div>
            <h2 className="heading-serif text-4xl text-[#50080E] md:text-6xl">
              Awards & Recognition
            </h2>
            <p className="mx-auto mt-6 max-w-3xl text-base leading-relaxed text-[#72383D]/82 md:text-lg">
              Recognized for innovation, entrepreneurship, and redefining the future of intelligent real estate through AI-driven technology and modern investment solutions.
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={staggerContainer}
            className="mb-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            {recognitionStats.map((stat) => (
              <RecognitionStat key={stat.label} stat={stat} />
            ))}
          </motion.div>

          <div className="grid gap-8 lg:grid-cols-[1fr_0.72fr]">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              variants={staggerContainer}
              className="grid gap-5 md:grid-cols-2"
            >
              {awards.map((award, index) => (
                <AwardCard key={award.title} award={award} index={index} />
              ))}
            </motion.div>

            <motion.aside
              initial={{ opacity: 0, x: 36 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] as any }}
              className="relative rounded-[2rem] border border-[#D4AF37]/24 bg-gradient-to-br from-[#50080E] via-[#2a0815] to-[#0b0b0b] p-6 text-white shadow-luxury-xl lg:sticky lg:top-28 lg:self-start"
            >
              <div className="absolute inset-0 rounded-[2rem] bg-[radial-gradient(circle_at_top_right,rgba(212,175,55,0.25),transparent_46%)]" />
              <div className="relative">
                <div className="mb-8 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#D4AF37]">
                      Recognition Timeline
                    </p>
                    <h3 className="mt-3 heading-serif text-3xl leading-tight text-white">
                      Built with credibility from day one.
                    </h3>
                  </div>
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[#D4AF37]/35 bg-[#D4AF37]/12">
                    <Landmark className="h-6 w-6 text-[#D4AF37]" />
                  </div>
                </div>

                <div className="space-y-5">
                  {recognitionTimeline.map((item, index) => (
                    <div key={item} className="relative flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[#D4AF37]/45 bg-[#D4AF37]/15 text-xs font-black text-[#D4AF37]">
                          {index + 1}
                        </div>
                        {index < recognitionTimeline.length - 1 ? (
                          <div className="mt-2 h-10 w-px bg-gradient-to-b from-[#D4AF37]/50 to-transparent" />
                        ) : null}
                      </div>
                      <div className="pt-1">
                        <p className="text-sm font-semibold text-[#F2F1ED]">{item}</p>
                        <p className="mt-1 text-xs leading-relaxed text-[#DCCDCE]/70">
                          Ecosystem signal strengthening investor, builder, buyer, and partner trust.
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                  {[
                    { icon: Globe, label: "National reach" },
                    { icon: Building2, label: "PropTech focus" },
                    { icon: ShieldCheck, label: "Trust layer" },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.label} className="rounded-2xl border border-white/10 bg-white/7 p-4 backdrop-blur-md">
                        <Icon className="mb-3 h-5 w-5 text-[#D4AF37]" />
                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#DCCDCE]">{item.label}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.aside>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] as any }}
            className="mt-16 overflow-hidden rounded-[2rem] border border-[#D4AF37]/30 bg-[#50080E] p-8 shadow-glow md:p-12"
          >
            <div className="grid gap-8 lg:grid-cols-[1fr_0.62fr] lg:items-center">
              <div>
                <p className="mb-4 text-xs font-bold uppercase tracking-[0.22em] text-[#D4AF37]">
                  Backed by Innovation & Vision
                </p>
                <h3 className="heading-serif text-3xl leading-tight text-white md:text-5xl">
                  Building the Future of Intelligent Real Estate Through AI, Innovation & Transparency.
                </h3>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {["Investors", "Builders", "Property Buyers", "Ecosystem Partners"].map((audience) => (
                  <div key={audience} className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm font-bold text-[#F2F1ED] backdrop-blur-md">
                    {audience}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 6. TEAM SECTION */}
      <section id="team" className="py-32 bg-[#F2F1ED]">
        <div className="mx-auto max-w-7xl px-6">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeIn}
            className="text-center mb-20"
          >
            <h2 className="heading-serif text-4xl md:text-5xl text-[#50080E] mb-4">Meet The Leadership</h2>
            <div className="w-24 h-1 bg-gradient-to-r from-[#D4AF37] to-[#b9872f] mx-auto rounded-full" />
          </motion.div>

          {/* Premium Alternating Team Cards */}
          <div className="space-y-12 max-w-5xl mx-auto">
            {team.map((member, i) => (
              <TeamCard key={member.name} member={member} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* 7. MILESTONES & FUTURE ROADMAP */}
      <section className="py-32 bg-white">
        <div className="mx-auto max-w-5xl px-6">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeIn}
            className="text-center mb-24"
          >
            <h2 className="heading-serif text-4xl md:text-5xl text-[#50080E] mb-6">Milestones & Future Plans</h2>
          </motion.div>

          <div className="relative">
            <div className="absolute left-8 md:left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-[#D4AF37]/10 via-[#D4AF37] to-[#D4AF37]/10 md:-translate-x-1/2" />
            
            <div className="space-y-20">
              {milestones.map((milestone, i) => (
                <motion.div 
                  key={milestone.year}
                  initial={{ opacity: 0, y: 50 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.7 }}
                  className={`relative flex flex-col md:flex-row gap-8 md:gap-0 ${i % 2 === 0 ? 'md:flex-row-reverse' : ''}`}
                >
                  <div className="md:w-1/2" />
                  
                  {/* Glowing Node */}
                  <div className="absolute left-8 md:left-1/2 w-6 h-6 rounded-full bg-[#50080E] border-4 border-[#D4AF37] -translate-x-[11px] md:-translate-x-3 mt-1.5 shadow-[0_0_15px_rgba(212,175,55,0.5)] z-10" />
                  
                  <div className={`md:w-1/2 pl-16 md:pl-0 ${i % 2 === 0 ? 'md:pr-16 text-left md:text-right' : 'md:pl-16 text-left'}`}>
                    <h3 className="heading-serif text-3xl text-[#50080E] mb-6">{milestone.year}</h3>
                    <div className="space-y-4">
                      {milestone.items.map((item, j) => (
                        <div key={j} className={`glass-card p-5 rounded-2xl shadow-luxury-sm hover:shadow-luxury transition-shadow inline-block w-full ${i % 2 === 0 ? 'ml-auto' : ''}`}>
                          <p className="text-[#72383D] font-medium">{item}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 8. AI + TECHNOLOGY SECTION */}
      <section className="py-32 bg-[#0b0b0b] relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5" />
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[#50080E]/20 blur-[120px] rounded-full pointer-events-none" />
        
        <div className="mx-auto max-w-7xl px-6 relative z-10">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeIn}
            className="text-center mb-20"
          >
            <h2 className="heading-serif text-4xl md:text-5xl text-white mb-6">Powered by Intelligence</h2>
            <p className="text-[#DCCDCE] max-w-2xl mx-auto">Our proprietary technology stack is designed to de-risk investments and maximize returns through predictive modeling.</p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {technologies.map((tech, i) => {
              const Icon = tech.icon;
              return (
                <motion.div
                  key={tech.title}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="group p-8 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-sm hover:bg-white/10 transition-all hover:-translate-y-2 relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-[#D4AF37]/0 via-transparent to-[#D4AF37]/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <Icon className="w-10 h-10 text-[#D4AF37] mb-6 group-hover:scale-110 transition-transform" />
                  <h3 className="text-xl font-bold text-white mb-3">{tech.title}</h3>
                  <p className="text-sm text-[#DCCDCE]/80 leading-relaxed">{tech.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 9. INVESTOR TRUST SECTION */}
      <section className="py-24 bg-gradient-to-br from-[#50080E] to-[#2a0815] relative overflow-hidden">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top_right,rgba(212,175,55,0.8)_0%,transparent_60%)]" />
        
        <div className="mx-auto max-w-7xl px-6 relative z-10">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="rounded-[2.5rem] border border-[#D4AF37]/30 bg-black/40 backdrop-blur-xl p-12 md:p-20 text-center shadow-glow"
          >
            <h2 className="heading-serif text-4xl md:text-5xl text-white mb-16">The Institutional Standard</h2>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
              {[
                { value: "₹70+ Cr", label: "Listings Value" },
                { value: "AI-Powered", label: "Analytics" },
                { value: "100%", label: "Verified Data" },
                { value: "Tier 1", label: "Partnerships" }
              ].map((stat, i) => (
                <div key={i} className="space-y-3">
                  <div className="text-3xl md:text-5xl font-bold text-[#D4AF37]">{stat.value}</div>
                  <div className="text-xs font-bold uppercase tracking-widest text-[#DCCDCE]">{stat.label}</div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>


    </div>
  );
}

// ─── Subcomponents ───────────────────────────────────────────────────────────

function RecognitionStat({ stat }: { stat: (typeof recognitionStats)[number] }) {
  const Icon = stat.icon;

  return (
    <motion.div
      variants={fadeIn}
      className="group relative overflow-hidden rounded-3xl border border-[#DCCDCE]/55 bg-white/70 p-6 shadow-luxury-sm backdrop-blur-xl transition-all duration-500 hover:-translate-y-1 hover:border-[#D4AF37]/45 hover:shadow-glow"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-[#D4AF37]/10 via-transparent to-[#50080E]/5 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] as any }}
            className="text-3xl font-black tracking-tight text-[#50080E]"
          >
            {stat.value}
          </motion.div>
          <p className="mt-2 text-xs font-bold uppercase tracking-[0.15em] text-[#72383D]/75">
            {stat.label}
          </p>
        </div>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 text-[#D4AF37] transition-transform duration-500 group-hover:scale-110">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </motion.div>
  );
}

function AwardCard({
  award,
  index,
}: {
  award: (typeof awards)[number];
  index: number;
}) {
  const Icon = award.icon;
  const featured = index === 0;

  return (
    <motion.article
      variants={fadeIn}
      className={`group relative overflow-hidden rounded-[1.75rem] border p-6 shadow-luxury-sm backdrop-blur-2xl transition-all duration-500 hover:-translate-y-1 hover:shadow-luxury-xl ${
        featured
          ? "border-[#D4AF37]/45 bg-gradient-to-br from-[#50080E] to-[#2a0815] text-white md:col-span-2"
          : "border-[#DCCDCE]/55 bg-white/72 text-[#50080E]"
      }`}
    >
      <div className="absolute right-0 top-0 h-32 w-32 translate-x-8 -translate-y-8 rounded-full bg-[#D4AF37]/12 blur-3xl transition-opacity duration-500 group-hover:opacity-100" />
      <div className="relative">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] ${
              featured
                ? "border-[#D4AF37]/35 bg-[#D4AF37]/12 text-[#D4AF37]"
                : "border-[#D4AF37]/25 bg-[#D4AF37]/10 text-[#72383D]"
            }`}
          >
            <BadgeCheck className="h-3.5 w-3.5" />
            {award.badge}
          </div>
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border transition-all duration-500 group-hover:scale-110 ${
              featured
                ? "border-[#D4AF37]/35 bg-[#D4AF37]/15 text-[#D4AF37]"
                : "border-[#D4AF37]/25 bg-[#50080E]/5 text-[#D4AF37]"
            }`}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>

        <h3 className={`heading-serif text-2xl leading-tight ${featured ? "text-white" : "text-[#50080E]"}`}>
          {award.title}
        </h3>
        <p className={`mt-4 text-sm leading-relaxed ${featured ? "text-[#DCCDCE]" : "text-[#72383D]/82"}`}>
          {award.description}
        </p>
      </div>
    </motion.article>
  );
}

function TeamCard({ member, index }: { member: (typeof team)[number]; index: number }) {
  const isEven = index % 2 === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6, delay: index * 0.1 }}
      className={`group relative rounded-[2rem] overflow-hidden bg-gradient-to-br from-[#2a0815] to-[#50080E] shadow-luxury hover:shadow-glow transition-all duration-500 border border-[#D4AF37]/20 flex flex-col md:flex-row ${!isEven ? 'md:flex-row-reverse' : ''}`}
    >
      {/* Image Section */}
      <div className="relative w-full md:w-2/5 aspect-[4/5] md:aspect-auto min-h-[300px] md:min-h-[400px] bg-black/20 overflow-hidden">
        <Image
          src={member.image}
          alt={member.name}
          fill
          className="object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b0b]/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      </div>
      
      {/* Text Section */}
      <div className="flex-1 p-8 md:p-12 flex flex-col justify-center relative">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#D4AF37]/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="mb-6">
          <h3 className="heading-serif text-3xl md:text-4xl text-white mb-2 group-hover:text-[#D4AF37] transition-colors duration-300">{member.name}</h3>
          <p className="text-sm font-bold tracking-[0.2em] uppercase text-[#D4AF37] mb-2">{member.role}</p>
          <p className="text-xs text-[#DCCDCE] font-semibold tracking-wide uppercase">{member.subtitle}</p>
        </div>
        
        <p className="text-[#DCCDCE]/80 leading-relaxed font-light mb-8 text-sm md:text-base">
          {member.bio}
        </p>
        
        <div className="flex items-center gap-4 mt-auto">
          <a href="#" className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center text-[#DCCDCE] hover:text-[#D4AF37] hover:border-[#D4AF37] transition-all hover:bg-[#D4AF37]/10">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path><rect x="2" y="9" width="4" height="12"></rect><circle cx="4" cy="4" r="2"></circle></svg>
          </a>
          <a href="#" className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center text-[#DCCDCE] hover:text-[#D4AF37] hover:border-[#D4AF37] transition-all hover:bg-[#D4AF37]/10">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
          </a>
        </div>
      </div>
    </motion.div>
  );
}
