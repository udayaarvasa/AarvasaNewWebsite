"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, Building2, Loader2, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const starters = [
  "Best investment under 50L in Bangalore",
  "Which Goa villas have the best rental yield?",
  "Show low-risk properties with 12%+ ROI",
];

export function ChatInterface({ initialPrompt }: { initialPrompt?: string }) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Welcome to Aarvasa AI. Ask for a city, budget, risk profile, or target ROI and I will shortlist investment-grade opportunities.",
    },
  ]);
  const [input, setInput] = useState(initialPrompt || "");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const didSubmitInitial = useRef(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const submit = useCallback(async (value = input) => {
    const trimmed = value.trim();
    if (!trimmed || loading) return;

    const nextMessages: Message[] = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });
      const data = await response.json();
      setMessages((current) => [
        ...current,
        { role: "assistant", content: data.message || "I found a few promising properties, but could not rank them right now." },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content:
            "I could not reach the AI route, but the safest shortlist is Bangalore growth homes, Gurugram skyline residences, and Goa villas for yield.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages]);

  useEffect(() => {
    if (initialPrompt && !didSubmitInitial.current) {
      didSubmitInitial.current = true;
      void submit(initialPrompt);
    }
  }, [initialPrompt, submit]);

  return (
    <div className="grid min-h-[calc(100vh-7rem)] gap-5 lg:grid-cols-[320px_1fr]">
      <Card className="hidden p-5 lg:block">
        <div className="mb-6 flex items-center gap-3">
          <div className="maroon-gradient flex h-10 w-10 items-center justify-center rounded-xl border border-accent/40 text-primary-foreground">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Chat History</p>
            <p className="text-xs text-muted-foreground">AI investment sessions</p>
          </div>
        </div>
        <div className="space-y-3">
          {starters.map((starter) => (
            <button
              key={starter}
              type="button"
              onClick={() => void submit(starter)}
              className="w-full rounded-xl border border-border bg-background/30 p-4 text-left text-sm text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
            >
              {starter}
            </button>
          ))}
        </div>
      </Card>

      <Card className="flex min-h-[720px] flex-col overflow-hidden">
        <div className="border-b border-border p-5">
          <div className="flex items-center gap-3">
            <div className="maroon-gradient flex h-11 w-11 items-center justify-center rounded-xl border border-accent/40 text-primary-foreground">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">Aarvasa AI Advisor</h1>
              <p className="text-sm text-muted-foreground">Property suggestions, ROI reasoning, and market signals</p>
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={message.role === "user" ? "flex justify-end" : "flex justify-start"}
            >
              <div
                className={
                  message.role === "user"
                    ? "max-w-[82%] rounded-2xl bg-primary px-5 py-4 text-sm leading-6 text-primary-foreground shadow-glow"
                    : "max-w-[82%] rounded-2xl border border-border bg-background/40 px-5 py-4 text-sm leading-6 text-foreground"
                }
              >
                {message.content}
              </div>
            </div>
          ))}
          {loading ? (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl border border-border bg-background/40 px-5 py-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                Aarvasa AI is underwriting...
              </div>
            </div>
          ) : null}
          <div ref={bottomRef} />
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
          className="border-t border-border p-4"
        >
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-background/35 p-2 backdrop-blur-xl">
            <Building2 className="ms-3 h-5 w-5 text-primary" />
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask: Best investment under 50L in Bangalore"
              className="min-h-12 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
            <Button type="submit" size="icon" disabled={loading} aria-label="Send message">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
