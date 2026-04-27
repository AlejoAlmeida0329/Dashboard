"use client";

/**
 * DateRangePicker — preset date range filter for the dashboard.
 *
 * UI: a row of preset buttons (7d, 30d, MTD, QTD, YTD) plus a
 * "Custom" toggle that reveals two `<input type="date">` fields.
 * The active preset is highlighted automatically by matching the
 * current ?from / ?to against `presetDateRange()` outputs.
 *
 * Writing strategy: every change calls
 *   router.push(buildUrl(pathname, {...filters, from, to}))
 * which preserves any other filters in place (empresa, presenter).
 * URL-as-state — no React state for the persistent filter value.
 *
 * Local React state holds only the open/closed state of the custom
 * popover, which is ephemeral UI chrome and intentionally NOT in URL.
 *
 * Date math is anchored to Bogotá in `presetDateRange` so the
 * answers are timezone-stable across Vercel and local dev.
 */

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  buildUrl,
  detectActivePreset,
  parseFilters,
  presetDateRange,
  type DateRangePreset,
} from "@/lib/url-state";
import { cn } from "@/lib/utils";

const PRESETS: { id: DateRangePreset; label: string }[] = [
  { id: "7d", label: "7d" },
  { id: "30d", label: "30d" },
  { id: "mtd", label: "MTD" },
  { id: "qtd", label: "QTD" },
  { id: "ytd", label: "YTD" },
];

export function DateRangePicker() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const paramsObj: Record<string, string> = {};
  searchParams.forEach((v, k) => {
    if (!(k in paramsObj)) paramsObj[k] = v;
  });
  const filters = parseFilters(paramsObj);
  const activePreset = detectActivePreset(filters);

  const [customOpen, setCustomOpen] = useState(false);
  // Custom inputs are seeded from current filter values so the user
  // sees their current range, not blank fields.
  const [customFrom, setCustomFrom] = useState(filters.from ?? "");
  const [customTo, setCustomTo] = useState(filters.to ?? "");

  const isCustomActive =
    activePreset === null && Boolean(filters.from || filters.to);

  const applyPreset = (preset: DateRangePreset) => {
    const range = presetDateRange(preset);
    const url = buildUrl(pathname, {
      ...filters,
      from: range.from,
      to: range.to,
    });
    router.push(url);
    setCustomOpen(false);
  };

  const applyCustom = () => {
    if (!customFrom || !customTo) return;
    const url = buildUrl(pathname, {
      ...filters,
      from: customFrom,
      to: customTo,
    });
    router.push(url);
    setCustomOpen(false);
  };

  return (
    <div className="relative inline-flex items-center gap-1">
      {PRESETS.map((p) => (
        <Button
          key={p.id}
          variant={activePreset === p.id ? "default" : "outline"}
          size="sm"
          onClick={() => applyPreset(p.id)}
          aria-pressed={activePreset === p.id}
        >
          {p.label}
        </Button>
      ))}
      <Button
        variant={isCustomActive ? "default" : "outline"}
        size="sm"
        onClick={() => setCustomOpen((v) => !v)}
        aria-expanded={customOpen}
        aria-pressed={isCustomActive}
      >
        Custom
      </Button>

      {customOpen && (
        <div
          className={cn(
            "absolute top-full right-0 z-50 mt-2 w-[300px] rounded-lg border bg-popover p-3 text-popover-foreground shadow-lg",
          )}
          role="dialog"
          aria-label="Rango personalizado"
        >
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="custom-from" className="text-xs">
                Desde
              </Label>
              <Input
                id="custom-from"
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="custom-to" className="text-xs">
                Hasta
              </Label>
              <Input
                id="custom-to"
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCustomOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={applyCustom}
              disabled={!customFrom || !customTo}
            >
              Aplicar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
