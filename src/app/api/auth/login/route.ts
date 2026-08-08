import { NextResponse } from "next/server";
import { setSession, userForPin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const pin = String(body.pin ?? "");
  const user = await userForPin(pin);

  // Deliberately vague: don't reveal whether a PIN exists but belongs to the
  // other account.
  if (!user) {
    return NextResponse.json({ error: "That PIN doesn't match either account." }, { status: 401 });
  }

  await setSession(user.id);
  return NextResponse.json({ user });
}
