"use server";

import { compare } from "bcryptjs";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  encrypt,
  getSessionCookieOptions,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/session";
import { loginLimiter } from "@/lib/auth/rate-limit";

export type LoginState = {
  error?: string;
};

const loginSchema = z.object({
  password: z.string().min(1, "Password requerido"),
});

// Dummy bcrypt hash used for timing-safe behavior when DASHBOARD_PASSWORD_HASH
// is missing — we still run a full bcrypt.compare so attackers cannot
// distinguish "env var unset" from "wrong password" by timing.
const DUMMY_HASH =
  "$2a$10$invalidhashinvalidhashinvalidhashinvalidhashinvalidha";

function getClientIp(forwardedFor: string | null): string {
  if (!forwardedFor) return "unknown";
  const first = forwardedFor.split(",")[0]?.trim();
  return first || "unknown";
}

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  // Step 1: derive client IP for rate limiting.
  const headerStore = await headers();
  const ip = getClientIp(headerStore.get("x-forwarded-for"));

  // Step 2: rate limit BEFORE bcrypt — burning compare cycles is an
  // amplification vector if we let attackers through to the bcrypt step.
  const limit = await loginLimiter.limit(ip);
  if (!limit.success) {
    return {
      error: "Demasiados intentos. Intenta de nuevo en unos minutos.",
    };
  }

  // Step 3: validate the form payload.
  const parsed = loginSchema.safeParse({
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "Password requerido." };
  }

  // Step 4: timing-safe compare. ALWAYS run bcrypt — even if the env var
  // is missing, against a dummy hash, so response time is constant.
  const storedHash = process.env.DASHBOARD_PASSWORD_HASH ?? DUMMY_HASH;
  const ok = await compare(parsed.data.password, storedHash);

  if (!ok || !process.env.DASHBOARD_PASSWORD_HASH) {
    return { error: "Password incorrecto." };
  }

  // Step 5: success — sign JWT and set HttpOnly cookie.
  const token = await encrypt({ authed: true });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, getSessionCookieOptions());

  // redirect() throws a special exception consumed by Next — must NOT be
  // caught. Place it last and outside any try/catch.
  redirect("/");
}
