"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { IndianRupee, MapPin, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function HeroSearch() {
  const router = useRouter();
  const [location, setLocation] = useState("Bangalore");
  const [budget, setBudget] = useState("5000000");

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push(`/ai-chat?prompt=${encodeURIComponent(`Best investment under ${budget} in ${location}`)}`);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="glass-card mt-10 grid max-w-4xl gap-3 rounded-2xl p-3 sm:grid-cols-[1fr_1fr_auto]"
    >
      <label className="flex min-h-14 items-center gap-3 rounded-xl bg-background/25 px-4">
        <MapPin className="h-5 w-5 text-primary" />
        <input
          value={location}
          onChange={(event) => setLocation(event.target.value)}
          className="w-full bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground"
          placeholder="Location"
        />
      </label>
      <label className="flex min-h-14 items-center gap-3 rounded-xl bg-background/25 px-4">
        <IndianRupee className="h-5 w-5 text-primary" />
        <input
          value={budget}
          onChange={(event) => setBudget(event.target.value)}
          className="w-full bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground"
          placeholder="Budget"
          inputMode="numeric"
        />
      </label>
      <Button className="h-14 px-6">
        <Search className="h-4 w-4" />
        Analyze
        <Sparkles className="h-4 w-4" />
      </Button>
    </form>
  );
}
