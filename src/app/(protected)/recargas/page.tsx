import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = {
  title: "Recargas · Tikin Dashboard",
};

export default function RecargasPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recargas</CardTitle>
        <CardDescription>Volumen y patrones de recarga</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Vista de recargas próximamente (Phase 4 — Inicio + Recargas).
        </p>
      </CardContent>
    </Card>
  );
}
