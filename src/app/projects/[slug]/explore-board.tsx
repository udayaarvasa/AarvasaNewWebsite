"use client";

import { motion } from "framer-motion";
import { Box, Globe2 } from "lucide-react";
import { useState, type ReactNode } from "react";

/**
 * One board for the building and where it stands.
 *
 * "In its surroundings" is the reconstruction standing in Google's
 * photorealistic scene at the project's coordinate; "Model only" is the same
 * model on its own, to orbit and zoom. The map stays mounted while hidden so
 * switching back does not reload it.
 */
export function ExploreBoard({
  projectName,
  surroundings,
  model,
}: {
  projectName: string;
  surroundings: ReactNode;
  model: ReactNode;
}) {
  const [view, setView] = useState<"surroundings" | "model">("surroundings");
  const tabs = [
    { key: "surroundings" as const, label: "In its surroundings", icon: Globe2 },
    { key: "model" as const, label: "Model only", icon: Box },
  ];

  return (
    <div className="lux-glass lux-gold-border rounded-[28px] p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 px-2 pb-3 pt-1">
        <div>
          <h3 className="av-display text-[26px] font-normal leading-none text-ink">{projectName} in 3D</h3>
          <p className="mt-1 text-[13px] text-ink-muted">
            {view === "surroundings"
              ? "The reconstruction standing on its site, among the real neighbourhood."
              : "Orbit and zoom the reconstruction on its own."}
          </p>
        </div>
        <div role="tablist" aria-label={`${projectName} 3D views`} className="relative flex rounded-full border border-rule bg-white/[0.04] p-1">
          {tabs.map(({ key, label, icon: Icon }) => {
            const active = view === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setView(key)}
                className={`relative isolate flex items-center gap-2 rounded-full px-4 py-2 text-[12.5px] font-semibold transition-colors ${
                  active ? "text-[var(--action-ink)]" : "text-ink-muted hover:text-ink"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="explore-board-tab"
                    className="absolute inset-0 -z-10 rounded-full [background:var(--action)]"
                    transition={{ type: "spring", stiffness: 320, damping: 30 }}
                  />
                )}
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div hidden={view !== "surroundings"}>{surroundings}</div>
      {view === "model" && <div className="-mx-[var(--gutter)]">{model}</div>}
    </div>
  );
}
