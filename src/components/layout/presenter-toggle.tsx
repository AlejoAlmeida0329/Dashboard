"use client";

/**
 * PresenterToggle — Switch that flips `?presenter=1` in the URL.
 *
 * URL-as-state, NOT React-state, so the toggle is shareable (paste a
 * URL into Slack and the recipient lands directly in presenter mode)
 * and persists across tab navigation. Reads `?presenter` via
 * `useSearchParams` and writes via `router.push(buildUrl(...))`,
 * preserving any other filters in place.
 *
 * Visible in BOTH presenter modes — it's the operator's only way
 * back out once chrome is hidden.
 */

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { buildUrl, parseFilters } from "@/lib/url-state";

export function PresenterToggle() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const paramsObj: Record<string, string> = {};
  searchParams.forEach((v, k) => {
    if (!(k in paramsObj)) paramsObj[k] = v;
  });
  const filters = parseFilters(paramsObj);
  const checked = filters.presenter === "1";

  const onCheckedChange = (next: boolean) => {
    const url = buildUrl(pathname, {
      ...filters,
      presenter: next ? "1" : undefined,
    });
    router.push(url);
  };

  return (
    <div className="flex items-center gap-2">
      <Label
        htmlFor="presenter-toggle"
        className="cursor-pointer text-xs text-muted-foreground"
        title="Oculta widgets internos y agranda tipografía"
      >
        Presentación
      </Label>
      <Switch
        id="presenter-toggle"
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-label="Modo Presentación"
      />
    </div>
  );
}
