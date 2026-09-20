/** @type {import('tailwindcss').Config} */

/*
 * Aarvasa design language.
 *
 * The palette, type roles, radii and ratios live in src/app/globals.css and
 * reach Tailwind through its `@theme inline` block. This file carries only
 * what the JS config still owns.
 *
 * "Paper reads. Dark shows." — see globals.css for the governing idea.
 */
const config = {
  theme: {
    extend: {
      boxShadow: {
        /* The design language has exactly two shadows. On stage there is none:
           separation there is a rule, not a shadow. */
        tray: "0 -2px 24px rgba(31, 27, 23, 0.08)",
        over: "0 24px 60px rgba(31, 27, 23, 0.14)",

        /* DEPRECATED — pre-redesign elevation names, still referenced by pages
           awaiting migration. Redefined to the restrained values so those pages
           stay valid while losing the glow. Removed in the cleanup commit. */
        glass: "0 24px 60px rgba(31, 27, 23, 0.14)",
        glow: "0 24px 60px rgba(31, 27, 23, 0.14)",
        "luxury-sm": "0 1px 2px rgba(31, 27, 23, 0.05)",
        luxury: "0 -2px 24px rgba(31, 27, 23, 0.08)",
        "luxury-lg": "0 24px 60px rgba(31, 27, 23, 0.14)",
        "luxury-xl": "0 24px 60px rgba(31, 27, 23, 0.14)",
        "gold-sm": "0 1px 2px rgba(31, 27, 23, 0.05)",
      },
      borderRadius: {
        /* Near-square: the page is drawn, not rounded. */
        none: "0",
        xs: "2px",
        sm: "4px",
        /* DEPRECATED — the old 1.25/1.5rem card radii, pulled in to 4px so
           un-migrated pages stop looking like a different product. */
        md: "4px",
        lg: "4px",
        xl: "4px",
        "2xl": "4px",
        "3xl": "4px",
      },
    },
  },
};

module.exports = config;
