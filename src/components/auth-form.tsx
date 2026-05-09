"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());

    const response = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();

    if (!response.ok) {
      setError(data.error || "Authentication failed");
      setLoading(false);
      return;
    }

    localStorage.setItem("aarvasa_token", data.token);
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <Card className="w-full max-w-md p-6">
      <div className="mb-8 space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
          {mode === "login" ? "Welcome back" : "Investor access"}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          {mode === "login" ? "Log in to Aarvasa" : "Create your portfolio"}
        </h1>
        <p className="text-sm leading-6 text-muted-foreground">
          {mode === "login"
            ? "Use demo@aarvasa.ai and any password without MongoDB configured."
            : "Set your investment preferences and unlock AI-ranked properties."}
        </p>
      </div>

      <form className="space-y-4" onSubmit={onSubmit}>
        {mode === "signup" ? (
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" placeholder="Ansh Dubey" required />
          </div>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="demo@aarvasa.ai"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="Minimum 8 characters"
            required
          />
        </div>
        {mode === "signup" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="budget">Budget</Label>
              <Input id="budget" name="budget" defaultValue="50000000" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="risk">Risk</Label>
              <select
                id="risk"
                name="risk"
                className="h-11 w-full rounded-md border border-input bg-zinc-950 px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
              >
                <option>Balanced</option>
                <option>Low</option>
                <option>Moderate</option>
              </select>
            </div>
          </div>
        ) : null}

        {error ? (
          <p className="rounded-md border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-100">
            {error}
          </p>
        ) : null}

        <Button disabled={loading} className="w-full" size="lg">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {mode === "login" ? "Login" : "Create account"}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {mode === "login" ? "New to Aarvasa?" : "Already have access?"}{" "}
        <Link
          href={mode === "login" ? "/signup" : "/login"}
          className="font-semibold text-primary"
        >
          {mode === "login" ? "Create account" : "Login"}
        </Link>
      </p>
    </Card>
  );
}
