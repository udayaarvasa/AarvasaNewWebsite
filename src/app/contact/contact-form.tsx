"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

/**
 * Contact form submission.
 *
 * There is no anonymous inquiry endpoint — /api/inquiries requires a session —
 * and inventing one is out of scope here. So rather than a button that looks
 * like it submits and silently does nothing, this hands the composed enquiry to
 * the visitor's own mail client, where they can see it and press send
 * themselves. Nothing claims to have been delivered that has not been.
 *
 * The previous markup rendered a bare <Button> inside a <form> with no handler.
 * A button in a form submits it, so clicking it performed a native GET and put
 * the visitor's name, email and phone into the URL, browser history and access
 * logs — while sending nothing.
 */
const TO = "contact@aarvasa.com";

export function ContactForm({ children }: { children: ReactNode }) {
  const [handedOff, setHandedOff] = useState(false);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    // Always stop the native submit: a GET would leak the fields into the URL.
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const get = (k: string) => String(data.get(k) ?? "").trim();

    const lines = [
      ["Name", get("name")],
      ["Email", get("email")],
      ["Phone", get("phone")],
      ["City or project", get("city")],
    ]
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}: ${v}`);

    const message = get("message");
    if (message) lines.push("", message);

    const subject = get("city")
      ? `Aarvasa enquiry — ${get("city")}`
      : "Aarvasa enquiry";

    window.location.href =
      `mailto:${TO}?subject=${encodeURIComponent(subject)}` +
      `&body=${encodeURIComponent(lines.join("\n"))}`;
    setHandedOff(true);
  }

  return (
    <form onSubmit={onSubmit} className="mt-[var(--s-6)] grid gap-[var(--s-4)]">
      {children}

      <Button type="submit" size="lg" className="w-full sm:w-auto sm:justify-self-start">
        Compose this enquiry
      </Button>

      {handedOff && (
        /* Deliberately not "Message sent". Nothing has been sent until the
           visitor sends it from their own mail client. */
        <p role="status" className="text-[13px] leading-relaxed text-ink">
          Your mail app should have opened with this enquiry ready to send. If it did
          not, email us directly at{" "}
          <a href={`mailto:${TO}`} className="underline underline-offset-2">
            {TO}
          </a>
          .
        </p>
      )}

      <p className="text-[12px] leading-relaxed text-ink-muted">
        This opens your own email app — nothing is sent until you send it. If you name a
        property, we may pass your enquiry to that developer.
      </p>
    </form>
  );
}
