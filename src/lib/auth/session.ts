import "server-only";

import { SignJWT, jwtVerify, type JWTPayload } from "jose";

/**
 * Session encryption / decryption helpers.
 *
 * Session is a stateless JWT (HS256) carried in an HttpOnly cookie. It
 * intentionally contains NO password and no user identity beyond an
 * `authed: true` flag — the dashboard only authenticates a single shared
 * password (AUTH-01) so there is nothing else to encode.
 *
 * The proxy.ts gate calls `decrypt` on every protected request; the
 * login Server Action calls `encrypt` after a successful bcrypt compare.
 */

export const SESSION_COOKIE_NAME = "session";
export const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30; // 30 days

export type SessionPayload = JWTPayload & {
  authed: true;
};

function getSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET is missing or too short (>=32 chars required). " +
        "Generate with: openssl rand -base64 32",
    );
  }
  return new TextEncoder().encode(secret);
}

export async function encrypt(payload: { authed: true }): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSecretKey());
}

export async function decrypt(
  token: string | undefined,
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify<SessionPayload>(token, getSecretKey(), {
      algorithms: ["HS256"],
    });
    if (payload.authed !== true) return null;
    return payload;
  } catch {
    // Invalid / expired / tampered token — fail closed.
    return null;
  }
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  };
}
