"use client";

/**
 * ClientesTable — Client Component table for /clientes (CLI-01/02/03).
 *
 * Why Client (and not Server):
 *   - The table supports click-to-sort (by Empresa, # tx, $ período, $
 *     histórico, Última actividad, Status). Sort is pure-UI state via
 *     `useState` — no Sheets refetch on column toggle.
 *   - The table supports a search input filtering rows by case-insensitive
 *     substring match on `empresa_nombre`. Search is also pure-UI state via
 *     `useState`; results update as the user types.
 *
 * Both interactions are entirely in-memory over the rows handed in once
 * by the page (Plan 05-04). The page passes `EmpresaListRow[]` already
 * sorted DESC by `montoHistorico` (the leaderboard-convention default),
 * and this component re-sorts client-side based on header clicks.
 *
 * Default sort: `montoHistorico` DESC. Mirrors the Bonos / Recargas
 * leaderboard convention — biggest empresas first.
 *
 * Row link: each row is wrapped in `<Link href={buildUrl(...)}>` to
 * `/clientes/[empresaId]`. Filters that flow into the link preserve
 * `from` / `to` / `presenter` (so the profile lands in the same date
 * window + presenter mode), but STRIP the existing `empresa` filter —
 * clicking a row navigates TO that empresa's profile, not preserving
 * the prior selection. `encodeURIComponent` is applied to `empresa_id`
 * because tikintags contain `$` (e.g. `$mario`) which must be
 * percent-encoded for URL path segments.
 *
 * Cliente-foco contract: NO `data-presenter-hide` here. The table is
 * fine in Modo Presentación for any single empresa view (the cliente
 * sees their own row in the search/filter result; if Plan 05-04 wires
 * a cliente-foco filter to /clientes, it just narrows visible rows —
 * not the table itself).
 *
 * Format gates: every numeric/date display flows through `@/lib/format`
 * (formatCOP, formatInteger, formatBogotaDate). The ONE exception is the
 * `Intl.Collator` used inside the sort comparator (useMemo) — this is a
 * non-display, locale-bound STRING-COMPARISON utility for natural-order
 * sort of empresa names. It does NOT format anything visible; the format
 * gate covers display, not comparison. This is the project's second such
 * exception (after recharts internals). Documented in 05-02-SUMMARY.md.
 */

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { EmpresaListRow } from "@/lib/domain/clientes";
import { formatBogotaDate, formatCOP, formatInteger } from "@/lib/format";
import { buildUrl, parseFilters } from "@/lib/url-state";

type SortKey =
  | "empresa_nombre"
  | "txPeriod"
  | "montoPeriod"
  | "montoHistorico"
  | "ultimaActividad"
  | "status";

type SortDir = "asc" | "desc";

type Props = {
  rows: EmpresaListRow[];
};

export function ClientesTable({ rows }: Props) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("montoHistorico");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Read current filters so row hrefs preserve date + presenter (NOT empresa).
  const rawSP = useSearchParams();
  const paramsObj: Record<string, string> = {};
  rawSP.forEach((v, k) => {
    if (!(k in paramsObj)) paramsObj[k] = v;
  });
  const filters = parseFilters(paramsObj);

  // Strip empresa from the filters that flow into row hrefs — clicking a
  // row should land on THAT empresa's profile, not preserve the prior one.
  const linkFilters = { ...filters, empresa: undefined };

  const filteredSorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? rows.filter((r) => r.empresa_nombre.toLowerCase().includes(q))
      : rows;

    const collator = new Intl.Collator("es", {
      sensitivity: "base",
      numeric: true,
    });
    const sign = sortDir === "asc" ? 1 : -1;

    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case "empresa_nombre":
          return sign * collator.compare(a.empresa_nombre, b.empresa_nombre);
        case "txPeriod":
          return sign * (a.txPeriod - b.txPeriod);
        case "montoPeriod":
          return sign * (a.montoPeriod - b.montoPeriod);
        case "montoHistorico":
          return sign * (a.montoHistorico - b.montoHistorico);
        case "ultimaActividad":
          return (
            sign *
            (a.ultimaActividad.getTime() - b.ultimaActividad.getTime())
          );
        case "status":
          // 'activa' < 'inactiva' alphabetically; with desc, activas first.
          return sign * a.status.localeCompare(b.status);
      }
    });
  }, [rows, search, sortKey, sortDir]);

  const onHeaderClick = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      // Sensible default direction per column (numeric desc, text asc).
      setSortDir(key === "empresa_nombre" || key === "status" ? "asc" : "desc");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Empresas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          type="search"
          placeholder="Buscar empresa…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
          aria-label="Buscar empresa por nombre"
        />

        {filteredSorted.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {rows.length === 0
              ? "Sin empresas para mostrar"
              : "Ninguna empresa coincide con la búsqueda"}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <SortHeader
                    k="empresa_nombre"
                    current={sortKey}
                    dir={sortDir}
                    onClick={onHeaderClick}
                  >
                    Empresa
                  </SortHeader>
                  <SortHeader
                    k="txPeriod"
                    current={sortKey}
                    dir={sortDir}
                    onClick={onHeaderClick}
                    align="right"
                  >
                    # tx período
                  </SortHeader>
                  <SortHeader
                    k="montoPeriod"
                    current={sortKey}
                    dir={sortDir}
                    onClick={onHeaderClick}
                    align="right"
                  >
                    $ período
                  </SortHeader>
                  <SortHeader
                    k="montoHistorico"
                    current={sortKey}
                    dir={sortDir}
                    onClick={onHeaderClick}
                    align="right"
                  >
                    $ histórico
                  </SortHeader>
                  <SortHeader
                    k="ultimaActividad"
                    current={sortKey}
                    dir={sortDir}
                    onClick={onHeaderClick}
                    align="right"
                  >
                    Última actividad
                  </SortHeader>
                  <SortHeader
                    k="status"
                    current={sortKey}
                    dir={sortDir}
                    onClick={onHeaderClick}
                    align="right"
                  >
                    Status
                  </SortHeader>
                </tr>
              </thead>
              <tbody>
                {filteredSorted.map((r) => (
                  <tr
                    key={r.empresa_id}
                    className="border-b last:border-b-0 hover:bg-muted/40"
                  >
                    <td
                      className="max-w-[280px] truncate py-2"
                      title={r.empresa_nombre}
                    >
                      <Link
                        href={buildUrl(
                          `/clientes/${encodeURIComponent(r.empresa_id)}`,
                          linkFilters,
                        )}
                        className="text-foreground hover:underline"
                      >
                        {r.empresa_nombre}
                      </Link>
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {formatInteger(r.txPeriod)}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {formatCOP(r.montoPeriod)}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {formatCOP(r.montoHistorico)}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {formatBogotaDate(r.ultimaActividad)}
                    </td>
                    <td
                      className={`py-2 text-right ${
                        r.status === "activa"
                          ? "text-foreground"
                          : "text-muted-foreground"
                      }`}
                    >
                      {r.status === "activa" ? "Activa" : "Inactiva"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SortHeader({
  k,
  current,
  dir,
  onClick,
  align = "left",
  children,
}: {
  k: SortKey;
  current: SortKey;
  dir: SortDir;
  onClick: (k: SortKey) => void;
  align?: "left" | "right";
  children: React.ReactNode;
}) {
  const isActive = k === current;
  const arrow = isActive ? (dir === "asc" ? " ↑" : " ↓") : "";
  return (
    <th
      className={`pb-2 font-medium ${
        align === "right" ? "text-right tabular-nums" : ""
      }`}
    >
      <button
        type="button"
        onClick={() => onClick(k)}
        className={`hover:text-foreground ${isActive ? "text-foreground" : ""}`}
        aria-sort={
          isActive ? (dir === "asc" ? "ascending" : "descending") : "none"
        }
      >
        {children}
        {arrow}
      </button>
    </th>
  );
}
