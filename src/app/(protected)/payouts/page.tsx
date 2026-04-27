import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = {
  title: "Payouts · Tikin Dashboard",
};

export default function PayoutsPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Payouts</CardTitle>
        <CardDescription>
          Volumen, breakdown por destino y por empresa
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Vista de payouts próximamente (Phase 3 — Payouts).
        </p>
      </CardContent>
    </Card>
  );
}
