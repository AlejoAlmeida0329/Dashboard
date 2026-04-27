import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = {
  title: "Bonos · Tikin Dashboard",
};

export default function BonosPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bonos</CardTitle>
        <CardDescription>Saldos y movimientos de bonos</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Vista de bonos próximamente (Phase 2 — Bonos).
        </p>
      </CardContent>
    </Card>
  );
}
