/** @type {import('tailwindcss').Config} */
const config = {
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        aarvasa: {
          /* New brand palette from design references */
          white: "#F2F1ED",
          cream: "#F5F4F1",
          rose: "#DCCDCE",
          burgundy: "#50080E",
          burgundyWarm: "#72383D",
          /* Preserved luxury tokens */
          maroon: "#7A1F3D",
          maroonDark: "#481123",
          gold: "#D4AF37",
          goldLight: "#F5D27A",
          ink: "#0B0B0B",
        },
      },
      boxShadow: {
        glass: "0 24px 80px rgba(72, 17, 35, 0.18)",
        glow: "0 28px 90px rgba(212, 175, 55, 0.22)",
        "luxury-sm": "0 2px 12px rgba(80, 8, 14, 0.06)",
        luxury: "0 8px 32px rgba(80, 8, 14, 0.08)",
        "luxury-lg": "0 20px 60px rgba(80, 8, 14, 0.12)",
        "luxury-xl": "0 32px 80px rgba(80, 8, 14, 0.16)",
        "gold-sm": "0 4px 16px rgba(212, 175, 55, 0.18)",
      },
      borderRadius: {
        "2xl": "1.25rem",
        "3xl": "1.5rem",
      },
      fontFamily: {
        serif: ["'Playfair Display'", "Georgia", "serif"],
      },
    },
  },
};

module.exports = config;
