"use client";

/**
 * LastRefresh — surfaces the moment of "lectura" as a Bogotá-formatted
 * timestamp in the header.
 *
 * Why a Client Component (despite the plan calling for a Server one):
 *   In the Next.js App Router, layouts do NOT re-render on soft
 *   navigation. The intent of LastRefresh is "navigation = fresh
 *   timestamp", which requires re-evaluation on each route or query
 *   change. We achieve that by keying a `useMemo` on `pathname +
 *   search`, so the timestamp is stable across re-renders of the same
 *   URL but updates whenever the URL changes (tab switch, filter
 *   change, presenter toggle).
 *
 * Bogotá TZ is enforced by `formatBogotaDateTime` regardless of where
 * the dashboard runs (Vercel functions live in UTC).
 */

import { usePathname, useSearchParams } from "next/navigation";
import { useMemo } from "react";

import { formatBogotaDateTime } from "@/lib/format";

export function LastRefresh() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlKey = `${pathname}?${searchParams.toString()}`;

  // Fresh Date captured per unique URL view. Memo prevents the
  // timestamp from twitching on unrelated re-renders within the
  // same view.
  const stamp = useMemo(
    () => formatBogotaDateTime(new Date()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [urlKey],
  );

  return (
    <span
      className="text-xs text-muted-foreground"
      title="Cada navegación produce una nueva lectura"
    >
      Última lectura: {stamp}
    </span>
  );
}
