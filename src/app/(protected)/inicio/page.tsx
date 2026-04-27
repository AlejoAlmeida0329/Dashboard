import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = {
  title: "Inicio · Tikin Dashboard",
};

export default function InicioPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Inicio</CardTitle>
        <CardDescription>Vista de overview ejecutivo</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          KPIs ejecutivos próximamente (Phase 4 — Inicio + Recargas).
        </p>
      </CardContent>
    </Card>
  );
}
