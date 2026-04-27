"use client";

/**
 * Error boundary for any route inside the protected group.
 *
 * Pitfall 5: never expose a raw stack trace to the user during a
 * client demo. In production we show a friendly message and a
 * Reintentar button (which calls the `reset` callback Next provides
 * to retry the failed render). In development we ALSO surface
 * `error.message` to help debugging.
 *
 * Error boundaries in Next.js MUST be Client Components — the
 * `'use client'` directive is mandatory. They receive `error` and
 * `reset` props from the framework.
 */

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the full error to the server logs / browser console for
    // post-mortem; users only see the friendly message above.
    console.error("[protected/error]", error);
  }, [error]);

  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center">
      <h2 className="text-lg font-semibold">No pudimos cargar los datos</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Esto suele resolverse reintentando. Si persiste, verifica tu
        conexión o contacta al equipo técnico.
      </p>

      {process.env.NODE_ENV === "development" && (
        <pre className="mt-4 max-w-full overflow-auto rounded bg-muted p-3 text-left text-xs text-muted-foreground">
          {error.message}
          {error.digest ? `\n[digest: ${error.digest}]` : ""}
        </pre>
      )}

      <div className="mt-4 flex justify-center">
        <Button onClick={() => reset()}>Reintentar</Button>
      </div>
    </div>
  );
}
