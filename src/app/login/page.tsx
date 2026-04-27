import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { decrypt, SESSION_COOKIE_NAME } from "@/lib/auth/session";

import { LoginForm } from "./login-form";

export default async function LoginPage() {
  // If already authenticated, bounce to the dashboard root. We check here
  // (in addition to the proxy gate) so that a user who hits /login with a
  // valid session doesn't see the form unnecessarily.
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const payload = await decrypt(token);
  if (payload?.authed) {
    redirect("/");
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-muted/30 px-4 py-12">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Tikin Dashboard</CardTitle>
          <CardDescription>Acceso restringido</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </main>
  );
}
