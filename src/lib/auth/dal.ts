import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { decrypt, SESSION_COOKIE_NAME } from "./session";

/**
 * Data Access Layer auth check.
 *
 * Per Next.js docs, Server Components MUST NOT trust the proxy alone — the
 * proxy is best treated as an optimistic gate. Re-verify the session inside
 * any Server Component or Server Action that reads sensitive data by
 * calling `verifySession()`. Wrapped in React.cache so that within a single
 * render pass the JWT is verified at most once.
 */
export const verifySession = cache(async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const payload = await decrypt(token);
  if (!payload?.authed) {
    redirect("/login");
  }
  return { authed: true as const };
});
