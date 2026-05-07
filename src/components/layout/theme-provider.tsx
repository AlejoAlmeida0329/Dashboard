"use client";

/**
 * ThemeProvider — wraps next-themes' provider as a Client Component
 * so the Server Component RootLayout can render it.
 *
 * Configuration choices (CROSS-V2-06):
 *   - attribute="class" → next-themes toggles `.dark` on <html>; matches
 *     the existing `@custom-variant dark (&:is(.dark *))` in globals.css.
 *   - defaultTheme="system" → first visit respects OS preference per
 *     CONTEXT.md ("Default: respeta preferencia del OS en primera visita").
 *   - enableSystem → "system" stays available alongside light/dark.
 *   - disableTransitionOnChange → avoids flash on toggle.
 */

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

export function ThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
