import "server-only";

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Login rate limiter (5 attempts per 5 minutes per IP, sliding window).
 *
 * Uses Upstash Redis so the limit is enforced across all serverless
 * instances (in-memory state would be useless on Vercel — each Function
 * invocation can land on a fresh container).
 *
 * Fail-open behavior: if UPSTASH_REDIS_REST_URL or _TOKEN is missing
 * (typical for local dev), a no-op limiter is used and a warning is
 * emitted ONCE per process. In production (Plan 04) both env vars are
 * mandatory and configured in Vercel.
 *
 * Contract: callers MUST invoke `loginLimiter.limit(ip)` BEFORE any
 * bcrypt.compare in the login Server Action — otherwise an attacker can
 * brute-force passwords by burning through compare cycles.
 */

type LimitResult = {
  success: boolean;
  remaining: number;
  reset: number;
};

type LoginLimiter = {
  limit: (ip: string) => Promise<LimitResult>;
};

let warned = false;
function warnFailOpenOnce() {
  if (warned) return;
  warned = true;
  // eslint-disable-next-line no-console
  console.warn(
    "[rate-limit] Upstash env vars missing — fail-open. " +
      "Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in production.",
  );
}

function buildLimiter(): LoginLimiter {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    warnFailOpenOnce();
    return {
      async limit(): Promise<LimitResult> {
        return { success: true, remaining: Number.POSITIVE_INFINITY, reset: 0 };
      },
    };
  }

  const redis = new Redis({ url, token });
  const ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "5 m"),
    analytics: false,
    prefix: "tikin-login",
  });

  return {
    async limit(ip: string): Promise<LimitResult> {
      const res = await ratelimit.limit(ip);
      return {
        success: res.success,
        remaining: res.remaining,
        reset: res.reset,
      };
    },
  };
}

export const loginLimiter: LoginLimiter = buildLimiter();
