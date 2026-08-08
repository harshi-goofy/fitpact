/**
 * PIN-based identity for a two-person app.
 *
 * There is no login provider and there never needs to be one: FitPact has
 * exactly two accounts. What it *does* need is for the app to know which of
 * the two is holding the phone, because the whole accountability mechanic
 * collapses if the tracker can tick her own confirmation boxes.
 *
 * So: each user has a 4-digit PIN. Entering it sets a signed, httpOnly cookie
 * naming that user. The signature stops the cookie being hand-edited to
 * promote yourself to PARTNER; it is not trying to withstand a determined
 * attacker, only to make self-validation a deliberate act rather than a tap.
 */

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "./db";

export const SESSION_COOKIE = "fitpact_session";
const MAX_AGE = 60 * 60 * 24 * 365; // a year — this is a phone you own

/** Falls back to a constant so a missing env var can't break login outright. */
function secret(): string {
  return process.env.AUTH_SECRET ?? "fitpact-local-dev-secret";
}

export function hashPin(pin: string): string {
  return createHash("sha256").update(pin).digest("hex");
}

function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("hex");
}

/** "<userId>.<hmac>" — opaque to the client, verifiable by us. */
function serialize(userId: string): string {
  return `${userId}.${sign(userId)}`;
}

function verify(token: string): string | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const userId = token.slice(0, dot);
  const given = token.slice(dot + 1);
  const expected = sign(userId);
  // Constant-time compare; lengths must match first or timingSafeEqual throws.
  if (given.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(given), Buffer.from(expected))) return null;
  return userId;
}

export type SessionUser = {
  id: string;
  name: string;
  role: "TRACKER" | "PARTNER";
};

/** The signed-in user, or null. Safe to call from any server component or route. */
export async function currentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const userId = verify(token);
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, role: true },
  });
  return user ?? null;
}

/** Match a PIN against both accounts. Returns the user it belongs to, or null. */
export async function userForPin(pin: string): Promise<SessionUser | null> {
  if (!/^\d{4}$/.test(pin)) return null;
  const hash = hashPin(pin);
  const user = await prisma.user.findFirst({
    where: { pinHash: hash },
    select: { id: true, name: true, role: true },
  });
  return user ?? null;
}

export async function setSession(userId: string): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, serialize(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

/** Throwing guards, for routes that must not run for the wrong person. */
export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) throw new AuthError("Not signed in", 401);
  return user;
}

export async function requireRole(role: "TRACKER" | "PARTNER"): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== role) {
    throw new AuthError(
      role === "PARTNER"
        ? "Only your partner can confirm these."
        : "Only the tracker can log habits.",
      403,
    );
  }
  return user;
}
