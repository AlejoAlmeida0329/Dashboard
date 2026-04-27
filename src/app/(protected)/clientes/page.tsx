import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = {
  title: "Clientes · Tikin Dashboard",
};

export default function ClientesPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Clientes</CardTitle>
        <CardDescription>Empresas y vista por dominio</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Vista de clientes y dominio próximamente (Phase 5 — Clientes +
          Domain).
        </p>
      </CardContent>
    </Card>
  );
}
