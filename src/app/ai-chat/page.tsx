import { Suspense } from "react";
import { ChatInterface } from "@/components/chatbot/chat-interface";
import { Skeleton } from "@/components/ui/skeleton";
import { Note, Wrap } from "@/components/av/primitives";

export const metadata = {
  title: "Advisor | Aarvasa",
  alternates: { canonical: "/ai-chat" },
  description:
    "Describe what you are looking for. The advisor answers from the specification behind every listing, and shows its sources.",
};

/**
 * The advisor is a supporting layer, not the product.
 *
 * It reaches people through the navigation, this route and the rail on a
 * property page — never a floating badge on every screen. The previous
 * headline offered to "rank deals by city, budget, ROI, and risk"; this
 * system publishes no yield or risk rating, so it does not offer to rank by
 * one.
 */
export default async function AiChatPage({
  searchParams,
}: {
  searchParams: Promise<{ prompt?: string }>;
}) {
  const { prompt } = await searchParams;

  return (
    <div className="pb-[var(--s-24)]">
      <Wrap className="pt-[var(--s-10)]">
        <span className="av-label text-gold-ink">Evaluate</span>
        <h1 className="av-display mt-2 max-w-[19ch] text-[clamp(32px,4.4vw,52px)] leading-[1.04]">
          It reads the documents. You make the call.
        </h1>
        <p className="mt-[var(--s-4)] max-w-[58ch] text-[17px] leading-relaxed text-ink-muted">
          Describe what you want in a sentence. The advisor answers from the specification and
          locality data behind the listings on this platform, in plain language.
        </p>
      </Wrap>

      <Wrap className="pt-[var(--band-tight)]">
        <div className="grid grid-cols-1 items-start gap-[var(--s-10)] lg:grid-cols-[minmax(0,1fr)_300px]">
          <Suspense fallback={<Skeleton className="h-[640px] w-full rounded-sm" />}>
            <ChatInterface initialPrompt={prompt} />
          </Suspense>

          <aside className="grid gap-[var(--s-4)]">
            <div className="border-t border-rule-firm">
              {[
                ["Reads", "Listing specification, developer filings, locality data"],
                ["Answers", "In plain sentences, with its sources shown"],
                ["Will not", "Forecast a price, quote a yield, or give investment advice"],
              ].map(([term, value]) => (
                <div key={term} className="border-b border-rule py-[10px]">
                  <span className="av-meta block text-gold-ink">{term}</span>
                  <span className="text-[13px] leading-relaxed text-ink-muted">{value}</span>
                </div>
              ))}
            </div>
            <Note>
              Answers are generated and can be wrong. Confirm any figure that matters against the
              developer&apos;s own documents before you act on it.
            </Note>
          </aside>
        </div>
      </Wrap>
    </div>
  );
}
