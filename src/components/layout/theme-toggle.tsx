"use client";

import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setTheme, useTheme } from "@/components/layout/theme-provider";

export function ThemeToggle() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <Button
      type="button"
      variant="glass"
      size="icon"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label="Toggle color theme"
      className="h-11 w-11 rounded-full border-0 bg-black text-white shadow-none hover:bg-black/90"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
