import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

async function clearSessionAndRedirect(): Promise<never> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  redirect("/login");
}

// Accept GET so a plain <a href="/logout"> works, plus POST for forms.
export async function GET() {
  await clearSessionAndRedirect();
}

export async function POST() {
  await clearSessionAndRedirect();
}
