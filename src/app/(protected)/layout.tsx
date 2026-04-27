/**
 * Protected layout — wraps every authenticated route group entry
 * (`/inicio`, `/bonos`, `/payouts`, `/recargas`, `/clientes`).
 *
 * Responsibilities:
 *   1. Re-verify the session via `verifySession()` from the DAL. The
 *      proxy in `src/proxy.ts` already filters unauthenticated traffic,
 *      but the proxy is OPTIMISTIC; per Next.js docs the authoritative
 *      check happens inside the Server Component that owns the data.
 *      `verifySession()` redirects to `/login` if the cookie is missing
 *      or invalid.
 *   2. Render the chrome: PresenterFrame (Client wrapper that owns the
 *      `data-presenter` attribute), DashboardHeader, TabNav, and the
 *      page slot.
 *
 * Why no `searchParams` here: in the App Router, layouts don't
 * re-render on soft navigation and don't receive `searchParams`.
 * Components that depend on URL state read it themselves
 * (`useSearchParams`) inside Client Components — that's where it
 * lives reactively.
 */

import { DashboardHeader } from "@/components/layout/dashboard-header";
import { PresenterFrame } from "@/components/layout/presenter-frame";
import { TabNav } from "@/components/layout/tab-nav";
import { verifySession } from "@/lib/auth/dal";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await verifySession();

  return (
    <PresenterFrame>
      <DashboardHeader />
      <TabNav />
      <main className="flex-1 px-6 py-6">{children}</main>
    </PresenterFrame>
  );
}
