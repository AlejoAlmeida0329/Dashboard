"use client";

/**
 * PresenterFrame — the outer wrapper that owns the `data-presenter`
 * attribute used by the global CSS to grow typography and hide chrome.
 *
 * Why a Client Component:
 *   In the Next.js App Router, layouts do NOT receive `searchParams`
 *   and do NOT re-render on soft navigation. Reading the presenter
 *   flag inside the Server-Component layout would freeze the value at
 *   the first render. We need this wrapper to react to URL changes
 *   live (e.g. user toggles presenter mode → URL changes → frame
 *   updates), so it's a Client Component using `useSearchParams`.
 *
 * It is intentionally a thin shell: no business logic, just the
 * attribute + a flex column layout. All dashboard children — header,
 * tab nav, main — are passed in as `children`.
 */

import { useSearchParams } from "next/navigation";

export function PresenterFrame({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const presenter = searchParams.get("presenter") === "1" ? "on" : "off";

  return (
    <div
      data-presenter={presenter}
      className="flex min-h-full flex-1 flex-col"
    >
      {children}
    </div>
  );
}
