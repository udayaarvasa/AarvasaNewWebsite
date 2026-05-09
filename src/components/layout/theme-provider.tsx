"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "aarvasa-theme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const theme = saved === "dark" ? "dark" : "light";
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, []);

  return <>{children}</>;
}

export function setTheme(theme: "light" | "dark") {
  localStorage.setItem(STORAGE_KEY, theme);
  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.toggle("dark", theme === "dark");
  window.dispatchEvent(new CustomEvent("aarvasa-theme-change", { detail: theme }));
}

export function useTheme() {
  const [theme, setThemeState] = useState<"light" | "dark">("light");

  useEffect(() => {
    const sync = () => {
      setThemeState(
        document.documentElement.dataset.theme === "light" ? "light" : "dark",
      );
    };
    sync();
    window.addEventListener("aarvasa-theme-change", sync);
    return () => window.removeEventListener("aarvasa-theme-change", sync);
  }, []);

  return { theme, mounted: true };
}
