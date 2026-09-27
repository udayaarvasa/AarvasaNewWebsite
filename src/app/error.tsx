"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * Root error boundary.
 *
 * The app had none, so an unhandled render error fell through to the framework
 * default — a blank page in production with no way back. This keeps the user
 * oriented and offers a retry, and deliberately shows no stack trace or error
 * message: those can carry internal paths and query detail.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The digest correlates to the server-side log entry without exposing it.
    console.error("Unhandled application error", error.digest ?? error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-28 text-center">
      <div className="max-w-[46ch]">
        <p className="av-label text-gold-ink">Something went wrong</p>
        <h1 className="av-display mt-4 text-[clamp(28px,4vw,40px)] leading-tight">
          This page did not load.
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-ink-muted">
          The problem is at our end, not with anything you did. Try again — and if it
          keeps happening, the listings page is still there.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button onClick={reset}>Try again</Button>
          <Button asChild variant="outline">
            <Link href="/listings">Go to listings</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
