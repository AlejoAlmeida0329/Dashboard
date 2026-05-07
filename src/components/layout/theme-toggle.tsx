"use client";

/**
 * ThemeToggle — Sun/Moon button using next-themes useTheme.
 *
 * SSR safety: useTheme returns `theme=undefined` during SSR / before
 * hydration. We render a stable button (no theme-dependent content)
 * until mounted, then swap to the actual icon to avoid hydration
 * mismatch flashes.
 */

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const current = mounted ? (resolvedTheme ?? theme) : undefined;
  const isDark = current === "dark";

  return (
    <button
      type="button"
      aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-input bg-background text-foreground transition-colors",
        "hover:bg-accent hover:text-accent-foreground",
        "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
      )}
    >
      {/* Render both icons; CSS hides one based on .dark class — safer than mounted gate alone */}
      <Sun className="size-4 dark:hidden" />
      <Moon className="hidden size-4 dark:block" />
    </button>
  );
}
