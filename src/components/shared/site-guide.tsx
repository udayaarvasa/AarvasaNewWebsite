"use client";

import Link from "next/link";
import { CircleHelp, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { getGuideContext, GUIDE_CONTEXTS, GUIDE_HINTS, type GuideHint, type GuideHintId } from "@/lib/site-guide";

export function SiteGuide() {
  const pathname = usePathname();
  const context = getGuideContext(pathname);

  return context && <Guide key={pathname} context={context} />;
}

function Guide({ context }: { context: keyof typeof GUIDE_CONTEXTS }) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [selected, setSelected] = useState<GuideHintId | null>(null);
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState(false);
  const activeRequest = useRef<AbortController | null>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const available: GuideHintId[] = GUIDE_CONTEXTS[context];
  const hint: GuideHint | null = selected ? GUIDE_HINTS[selected] : null;

  useEffect(() => () => activeRequest.current?.abort(), []);

  function cancelQuestion() {
    activeRequest.current?.abort();
    activeRequest.current = null;
    setPending(false);
  }

  function closeGuide() {
    cancelQuestion();
    setOpen(false);
    setStatus("");
    toggle.current?.focus();
  }

  async function askGuide(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = question.trim();
    if (!query || activeRequest.current) return;

    const request = new AbortController();
    activeRequest.current = request;
    setPending(true);
    setSelected(null);
    setStatus("");

    try {
      const response = await fetch("/api/site-guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context, question: query }),
        signal: request.signal,
      });
      if (!response.ok) throw new Error("Guide request failed");
      const data = await response.json();
      if (request.signal.aborted) return;

      const match = available.find((id) => id === data.hint);
      if (match) setSelected(match);
      else setStatus("Choose a topic below for a hint.");
    } catch {
      if (!request.signal.aborted) setStatus("AI help is unavailable right now. You can still choose a topic below.");
    } finally {
      if (activeRequest.current === request) {
        activeRequest.current = null;
        setPending(false);
      }
    }
  }

  return (
    <div
      className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 z-[35] sm:bottom-6 sm:left-6"
      onKeyDown={(event) => {
        if (open && event.key === "Escape") {
          event.stopPropagation();
          closeGuide();
        }
      }}
    >
      <button
        ref={toggle}
        type="button"
        aria-expanded={open}
        aria-controls="site-guide"
        onClick={() => open ? closeGuide() : setOpen(true)}
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-rule-firm bg-paper-raised px-4 text-sm font-semibold text-ink shadow-tray hover:bg-paper-sunken"
      >
        {open ? <X className="size-4" aria-hidden="true" /> : <CircleHelp className="size-4" aria-hidden="true" />}
        Site guide
      </button>

      <section
        hidden={!open}
        id="site-guide"
        aria-labelledby="site-guide-title"
        className="absolute bottom-full left-0 mb-2 max-h-[min(64dvh,420px)] w-[min(calc(100vw-2rem),23rem)] overflow-y-auto rounded-xl border border-rule-firm bg-paper-raised p-4 text-ink shadow-tray"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 id="site-guide-title" className="font-semibold">How can we help?</h2>
          <button type="button" aria-label="Close site guide" onClick={closeGuide}
            className="grid size-10 place-items-center rounded-full hover:bg-paper-sunken">
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={askGuide} className="mt-1">
          <label htmlFor="site-guide-question" className="block text-xs text-ink-muted">
            Ask AI how to use Aarvasa. Keep personal details out of your question.
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="site-guide-question"
              value={question}
              maxLength={300}
              placeholder={context === "listingForm" ? "How many photos can I add?" : "How do I list a property?"}
              onChange={(event) => setQuestion(event.target.value)}
              className="min-w-0 flex-1 rounded-md border border-rule-firm bg-paper px-3 py-2 text-base"
            />
            <button type="submit" disabled={pending || !question.trim()}
              className="min-h-11 rounded-md bg-claret px-3 text-sm font-semibold text-white disabled:opacity-50">
              Ask
            </button>
          </div>
        </form>

        <div aria-live="polite" className="text-sm">
          {pending && <p className="mt-3 text-ink-muted">Finding a hint…</p>}
          {status && <p className="mt-3 text-ink-muted">{status}</p>}
          {hint && (
            <div className="mt-3 rounded-md border border-rule bg-paper-sunken p-3">
              <p className="leading-relaxed">{hint.text}</p>
              {hint.link && (
                <Link href={hint.link.href} onClick={closeGuide} className="mt-2 inline-block font-semibold underline underline-offset-2">
                  {hint.link.label}
                </Link>
              )}
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2" aria-label="Hint topics">
          {available.map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={selected === id}
              onClick={() => {
                cancelQuestion();
                setStatus("");
                setSelected(id);
              }}
              className="min-h-9 rounded-full border border-rule-firm px-3 py-1 text-xs hover:bg-paper-sunken aria-pressed:bg-paper-sunken aria-pressed:font-semibold"
            >
              {GUIDE_HINTS[id].label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
