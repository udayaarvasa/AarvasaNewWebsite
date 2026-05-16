"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronUp, BrainCircuit } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function FloatingActions() {
  const [showScroll, setShowScroll] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => {
      setShowScroll(window.scrollY > 300);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Hide on AI chat page itself to avoid redundancy
  if (pathname === "/ai-chat") return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3">
      {/* AI Token Button */}
      <Link
        href="/ai-chat"
        className="group relative flex h-[3.25rem] w-[3.25rem] items-center justify-center rounded-full bg-gradient-to-br from-[#D4AF37] to-[#b9872f] p-[2px] shadow-[0_8px_24px_rgba(212,175,55,0.25)] transition-all duration-300 hover:scale-105 hover:shadow-[0_12px_32px_rgba(212,175,55,0.4)]"
        aria-label="Ask AI Advisor"
      >
        <div className="absolute inset-0 rounded-full bg-[url('/noise.png')] opacity-10 mix-blend-overlay"></div>
        <div className="relative flex h-full w-full items-center justify-center rounded-full bg-[#1A0006] overflow-hidden">
           {/* Subtle animated background glow */}
           <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_rgba(212,175,55,0.35)_0%,_transparent_70%)] opacity-0 blur-md transition-all duration-500 group-hover:opacity-100 group-hover:scale-150"></div>
           
           <BrainCircuit className="relative z-10 h-6 w-6 text-[#D4AF37] transition-all duration-500 group-hover:scale-110 group-hover:text-white drop-shadow-[0_0_8px_rgba(212,175,55,0.5)]" />
        </div>
      </Link>

      {/* Scroll to Top */}
      <button
        onClick={scrollToTop}
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-full bg-[#902941] text-white shadow-lg transition-all duration-300 hover:bg-[#7a1f3d]",
          showScroll ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0 pointer-events-none"
        )}
        aria-label="Scroll to top"
      >
        <ChevronUp className="h-5 w-5" />
      </button>
    </div>
  );
}
