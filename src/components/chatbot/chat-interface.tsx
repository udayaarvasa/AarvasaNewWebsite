"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Bot,
  Building2,
  Loader2,
  Send,
  Sparkles,
  TrendingUp,
  Shield,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// ─── Types ───────────────────────────────────────────────────────────────────

type Message = {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  isError?: boolean;
  timestamp?: number;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const STARTERS = [
  "Best investment under 50L in Bangalore",
  "Which Goa villas have the best rental yield?",
  "Show low-risk properties with 12%+ ROI",
  "Compare apartments in Pune vs Gurugram",
  "High ROI commercial properties in Bengaluru",
];

const LOADING_MESSAGES = [
  "Querying Aarvasa verified database...",
  "Scanning external market feeds...",
  "Evaluating ROI signals...",
  "Cross-referencing infrastructure data...",
  "Scoring investment profiles...",
  "Aggregating multi-source intelligence...",
  "Analyzing rental yield patterns...",
  "Ranking by risk-adjusted returns...",
];

// ─── Markdown-lite Renderer ──────────────────────────────────────────────────

function renderMarkdown(text: string) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let key = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const k = key++;

    // H3 heading (### )
    if (line.startsWith("### ")) {
      elements.push(
        <h3
          key={k}
          className="mt-5 mb-2 flex items-center gap-2 text-base font-bold text-[#50080E]"
        >
          {line.slice(4)}
        </h3>,
      );
      continue;
    }

    // Bold line (**text**)
    if (line.startsWith("**") && line.endsWith("**")) {
      elements.push(
        <p key={k} className="mt-1 text-sm font-semibold text-[#50080E]">
          {line.replace(/\*\*/g, "")}
        </p>,
      );
      continue;
    }

    // Horizontal rule (---)
    if (line.trim() === "---") {
      elements.push(
        <hr key={k} className="my-4 border-[#DCCDCE]/40" />,
      );
      continue;
    }

    // Bullet list item (- )
    if (line.startsWith("- ")) {
      elements.push(
        <div key={k} className="flex items-start gap-2 py-0.5">
          <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#D4AF37]" />
          <span className="text-sm leading-relaxed text-[#72383D]">
            {renderInlineMarkdown(line.slice(2))}
          </span>
        </div>,
      );
      continue;
    }

    // Blockquote (> )
    if (line.startsWith("> ")) {
      elements.push(
        <blockquote
          key={k}
          className="my-3 border-l-2 border-[#D4AF37]/50 pl-3 text-xs italic text-[#72383D]/60"
        >
          {renderInlineMarkdown(line.slice(2).replace(/^\*/, "").replace(/\*$/, ""))}
        </blockquote>,
      );
      continue;
    }

    // Empty line
    if (line.trim() === "") {
      elements.push(<div key={k} className="h-1" />);
      continue;
    }

    // Regular paragraph with inline markdown
    elements.push(
      <p key={k} className="text-sm leading-relaxed text-[#72383D]">
        {renderInlineMarkdown(line)}
      </p>,
    );
  }

  return <div className="space-y-0.5">{elements}</div>;
}

/** Handle **bold** and inline formatting */
function renderInlineMarkdown(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-[#50080E]">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

// ─── Chat Interface Component ────────────────────────────────────────────────

export function ChatInterface({ initialPrompt }: { initialPrompt?: string }) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Welcome to **Aarvasa AI** — India's multi-source real estate intelligence platform. I combine our **verified property database**, **real-time market signals**, and **AI-powered analysis** to surface investment-grade opportunities. Ask for a city, budget, risk profile, or target ROI to get started.",
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState(initialPrompt || "");
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState(LOADING_MESSAGES[0]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const didSubmitInitial = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const loadingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Cycle loading messages
  useEffect(() => {
    if (loading) {
      let idx = 0;
      loadingIntervalRef.current = setInterval(() => {
        idx = (idx + 1) % LOADING_MESSAGES.length;
        setLoadingMessage(LOADING_MESSAGES[idx]);
      }, 2200);
    } else {
      if (loadingIntervalRef.current) {
        clearInterval(loadingIntervalRef.current);
        loadingIntervalRef.current = null;
      }
    }
    return () => {
      if (loadingIntervalRef.current) {
        clearInterval(loadingIntervalRef.current);
      }
    };
  }, [loading]);

  const submit = useCallback(
    async (value = input) => {
      const trimmed = value.trim();
      if (!trimmed || loading) return;

      // Add user message
      const userMessage: Message = {
        role: "user",
        content: trimmed,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setLoading(true);

      // Abort any previous request
      if (abortRef.current) {
        abortRef.current.abort();
      }
      abortRef.current = new AbortController();

      try {
        // Build conversation history for the API (last 10 messages for context window)
        const conversationHistory = [...messages, userMessage]
          .filter((m) => !m.isError)
          .slice(-10)
          .map((m) => ({ role: m.role, content: m.content }));

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: conversationHistory }),
          signal: abortRef.current.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          throw new Error(
            errorData?.message || `Request failed with status ${response.status}`,
          );
        }

        // ── Stream the response ──
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("No response stream available");
        }

        const decoder = new TextDecoder();

        // Add an empty streaming message
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "", isStreaming: true, timestamp: Date.now() },
        ]);
        setLoading(false);

        let accumulated = "";

        while (true) {
          const { done, value: chunk } = await reader.read();
          if (done) break;

          accumulated += decoder.decode(chunk, { stream: true });

          // Update the streaming message
          setMessages((prev) => {
            const updated = [...prev];
            const lastIdx = updated.length - 1;
            if (updated[lastIdx]?.isStreaming) {
              updated[lastIdx] = {
                ...updated[lastIdx],
                content: accumulated,
              };
            }
            return updated;
          });
        }

        // Finalize: remove streaming flag
        setMessages((prev) => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (updated[lastIdx]?.isStreaming) {
            updated[lastIdx] = {
              ...updated[lastIdx],
              content: accumulated,
              isStreaming: false,
            };
          }
          return updated;
        });
      } catch (error) {
        if ((error as Error).name === "AbortError") return;

        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              "I apologize — I'm experiencing a temporary connectivity issue. Please try your query again in a moment, or rephrase your investment criteria.",
            isError: true,
            timestamp: Date.now(),
          },
        ]);
        setLoading(false);
      }
    },
    [input, loading, messages],
  );

  // Auto-submit initial prompt
  useEffect(() => {
    if (initialPrompt && !didSubmitInitial.current) {
      didSubmitInitial.current = true;
      void submit(initialPrompt);
    }
  }, [initialPrompt, submit]);

  return (
    <div className="grid min-h-[calc(100vh-7rem)] gap-5 lg:grid-cols-[320px_1fr]">
      {/* ── Sidebar ── */}
      <Card className="hidden p-5 lg:block">
        <div className="mb-6 flex items-center gap-3">
          <div className="maroon-gradient flex h-10 w-10 items-center justify-center rounded-xl border border-accent/40 text-primary-foreground">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold text-foreground">AI Advisor</p>
            <p className="text-xs text-muted-foreground">Investment intelligence</p>
          </div>
        </div>

        {/* Quick-start queries */}
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#72383D]/50">
          Quick Queries
        </p>
        <div className="space-y-2.5">
          {STARTERS.map((starter) => (
            <button
              key={starter}
              type="button"
              onClick={() => void submit(starter)}
              disabled={loading}
              className="w-full rounded-xl border border-border bg-background/30 p-3.5 text-left text-[13px] leading-snug text-muted-foreground transition hover:border-primary/40 hover:text-foreground disabled:opacity-50"
            >
              {starter}
            </button>
          ))}
        </div>

        {/* Capabilities */}
        <div className="mt-6 space-y-2.5 border-t border-border pt-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[#72383D]/50">
            Capabilities
          </p>
          {[
            { icon: TrendingUp, label: "ROI & Yield Analysis" },
            { icon: Shield, label: "Risk Profiling" },
            { icon: MapPin, label: "Micro-market Signals" },
            { icon: Building2, label: "Multi-source Matching" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2.5 text-xs text-[#72383D]/60">
              <Icon className="h-3.5 w-3.5 text-[#D4AF37]" />
              {label}
            </div>
          ))}
          <div className="mt-3 rounded-lg border border-[#DCCDCE]/30 bg-[#F5F4F1]/60 p-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#72383D]/40 mb-1">Data Sources</p>
            <p className="text-[10px] leading-relaxed text-[#72383D]/50">Aarvasa DB • Market APIs • Infrastructure • RERA • Rental Intelligence</p>
          </div>
        </div>
      </Card>

      {/* ── Chat Panel ── */}
      <Card className="flex min-h-[720px] flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-border p-5">
          <div className="flex items-center gap-3">
            <div className="maroon-gradient flex h-11 w-11 items-center justify-center rounded-xl border border-accent/40 text-primary-foreground">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">
                Aarvasa AI Advisor
              </h1>
              <p className="text-sm text-muted-foreground">
                Multi-source intelligence • ROI reasoning • Market signals
              </p>
            </div>
            <div className="ml-auto hidden items-center gap-1.5 sm:flex">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-emerald-600">Live</span>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}-${message.timestamp}`}
              className={
                message.role === "user" ? "flex justify-end" : "flex justify-start"
              }
            >
              {message.role === "assistant" && (
                <div className="mr-3 mt-1 flex-shrink-0">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                      message.isError
                        ? "bg-red-100 text-red-600"
                        : "maroon-gradient text-primary-foreground"
                    }`}
                  >
                    {message.isError ? (
                      <AlertCircle className="h-4 w-4" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                  </div>
                </div>
              )}
              <div
                className={
                  message.role === "user"
                    ? "max-w-[78%] rounded-2xl bg-primary px-5 py-4 text-sm leading-6 text-primary-foreground shadow-glow"
                    : `max-w-[85%] rounded-2xl border px-5 py-4 text-sm leading-6 ${
                        message.isError
                          ? "border-red-200 bg-red-50/60 text-red-800"
                          : "border-border bg-background/40 text-foreground"
                      }`
                }
              >
                {message.role === "assistant" ? (
                  <div className="ai-response">
                    {renderMarkdown(message.content)}
                    {message.isStreaming && (
                      <span className="inline-block ml-0.5 w-2 h-4 bg-[#D4AF37] animate-pulse rounded-sm" />
                    )}
                  </div>
                ) : (
                  message.content
                )}
              </div>
            </div>
          ))}

          {/* Loading indicator */}
          {loading && (
            <div className="flex justify-start">
              <div className="mr-3 mt-1 flex-shrink-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg maroon-gradient text-primary-foreground">
                  <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-border bg-background/40 px-5 py-4">
                <Loader2 className="h-4 w-4 animate-spin text-[#D4AF37]" />
                <div>
                  <p className="text-sm font-medium text-[#50080E]">
                    {loadingMessage}
                  </p>
                  <div className="mt-1.5 flex gap-1">
                    <span className="h-1 w-1 rounded-full bg-[#D4AF37] animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="h-1 w-1 rounded-full bg-[#D4AF37] animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="h-1 w-1 rounded-full bg-[#D4AF37] animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
          className="border-t border-border p-4"
        >
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-background/35 p-2 backdrop-blur-xl transition-colors focus-within:border-[#D4AF37]/50">
            <Building2 className="ms-3 h-5 w-5 text-primary" />
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask: Best investment under 50L in Bangalore"
              className="min-h-12 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              disabled={loading}
            />
            <Button
              type="submit"
              size="icon"
              disabled={loading || !input.trim()}
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-2 text-center text-[10px] text-[#72383D]/40">
            AI-generated insights are projections, not guarantees. Always conduct independent due diligence.
          </p>
        </form>
      </Card>
    </div>
  );
}
