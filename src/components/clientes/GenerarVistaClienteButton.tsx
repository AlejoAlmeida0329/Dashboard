"use client";

/**
 * GenerarVistaClienteButton — CLI-08, the Phase 5 closing UX.
 *
 * Click → navigate to `/inicio?empresa=<id>&presenter=1` (preserving any
 * existing date filter via useSearchParams). The destination page (/inicio
 * Plan 04-07) honors the cliente-foco contract end-to-end:
 *   - Comisión + Take rate cards hidden (data-presenter-hide)
 *   - HechosCurados block hidden (data-presenter-empresa-hide)
 *   - EmpresasActivasChart Card hidden (page-level data-presenter-empresa-hide)
 *   - GMV chart + 3 visible KPIs + GMV editorial reading remain visible
 *
 * Why Client: needs useRouter().push for the navigation. Could be a plain
 * <Link>, but the explicit click handler lets us toast / scroll-to-top in
 * future iterations without refactoring.
 */

import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { buildUrl, parseFilters } from "@/lib/url-state";

type Props = {
  empresaId: string;
};

export function GenerarVistaClienteButton({ empresaId }: Props) {
  const router = useRouter();
  const rawSP = useSearchParams();

  const onClick = () => {
    const paramsObj: Record<string, string> = {};
    rawSP.forEach((v, k) => {
      if (!(k in paramsObj)) paramsObj[k] = v;
    });
    const current = parseFilters(paramsObj);
    const url = buildUrl("/inicio", {
      ...current,
      empresa: empresaId,
      presenter: "1",
    });
    router.push(url);
  };

  return (
    <Button onClick={onClick} type="button" className="w-full sm:w-auto">
      Generar vista para cliente
    </Button>
  );
}
