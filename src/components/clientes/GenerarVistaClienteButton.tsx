"use client";

/**
 * GenerarVistaClienteButton — CLI-V2-08, the cliente-foco share-URL flow.
 *
 * Click → navigate to `/clientes/{empresaId}?presenter=1` (preserving any
 * existing date filter via useSearchParams). Per Phase 9 CONTEXT.md:
 *   "El URL persiste la selección para que un share-link te lleve al
 *    cliente exacto en el modo correcto."
 *
 * The destination — the dossier itself in presenter mode — is the
 * cliente-foco target: TimelineActivity collapses (page-level
 * `data-presenter-hide`), RetirosBancoTable's failure-reason column
 * collapses (`data-presenter-metric-hide`), site chrome hides per the
 * Phase 6 paleta system, and the cabecera + bonos + p2p + compras remain
 * visible — the clean executive view designed for the cliente.
 *
 * v1 → v2 contract change: the v1 button targeted
 * `/inicio?empresa=<id>&presenter=1` (the user landed on Inicio with the
 * empresa scoped filter applied). v2 lands on the dossier itself, in the
 * dossier's presenter mode, so the share-link matches the section the
 * Tikin operator was looking at when they clicked "Generar vista".
 *
 * Why Client: needs useRouter().push for the navigation. Could be a plain
 * <Link>, but the explicit click handler lets us toast / scroll-to-top in
 * future iterations without refactoring.
 */

import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";

type Props = {
  empresaId: string;
};

export function GenerarVistaClienteButton({ empresaId }: Props) {
  const router = useRouter();
  const rawSP = useSearchParams();

  const onClick = () => {
    // Preserve every searchParam EXCEPT presenter (we force it to "1").
    const params = new URLSearchParams();
    rawSP.forEach((v, k) => {
      if (k === "presenter") return;
      if (!params.has(k)) params.set(k, v);
    });
    params.set("presenter", "1");
    const path = `/clientes/${encodeURIComponent(empresaId)}`;
    router.push(`${path}?${params.toString()}`);
  };

  return (
    <Button onClick={onClick} type="button" className="w-full sm:w-auto">
      Generar vista para cliente
    </Button>
  );
}
