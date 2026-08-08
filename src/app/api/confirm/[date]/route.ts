import { NextResponse } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { getTracker, loadBoard } from "@/lib/board";
import { prisma } from "@/lib/db";
import { isConfirmable, keyToDate, todayKey } from "@/lib/timezone";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The partner ticks a box.
 *
 * PARTNER role only, and only inside the 24h window. Both rules are enforced
 * here rather than by disabling a control, because the control is the
 * courtesy and this is the actual mechanic — if the tracker could POST here,
 * the whole pact is decorative.
 */
export async function POST(req: Request, ctx: { params: Promise<{ date: string }> }) {
  const { date } = await ctx.params;

  try {
    await requireRole("PARTNER");
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  if (!DATE_RE.test(date)) {
    return NextResponse.json({ error: "Bad date format, expected YYYY-MM-DD" }, { status: 400 });
  }

  const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });
  const tz = settings?.timezone ?? process.env.APP_TIMEZONE ?? "Asia/Kolkata";
  const today = todayKey(tz);

  if (!isConfirmable(date, today)) {
    return NextResponse.json(
      { error: "That day's window has closed. Only today and yesterday can be confirmed." },
      { status: 403 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const kind = body.kind;
  if (kind !== "move" && kind !== "diet") {
    return NextResponse.json({ error: "kind must be 'move' or 'diet'" }, { status: 400 });
  }
  const confirmed = body.confirmed;
  if (typeof confirmed !== "boolean") {
    return NextResponse.json({ error: "confirmed must be a boolean" }, { status: 400 });
  }

  const tracker = await getTracker();
  const entry = await prisma.dayEntry.findUnique({
    where: { userId_date: { userId: tracker.id, date: keyToDate(date) } },
  });

  // Nothing to confirm is a client bug, not a silent no-op — say so.
  if (!entry) {
    return NextResponse.json({ error: "Nothing logged for that day yet." }, { status: 400 });
  }
  const claimed = kind === "move" ? entry.swimDone || entry.gymDone : entry.dietDone;
  if (!claimed) {
    return NextResponse.json(
      { error: kind === "move" ? "No move logged for that day." : "No diet logged for that day." },
      { status: 400 },
    );
  }

  const field = kind === "move" ? "moveConfirmedAt" : "dietConfirmedAt";
  await prisma.dayEntry.update({
    where: { userId_date: { userId: tracker.id, date: keyToDate(date) } },
    data: { [field]: confirmed ? new Date() : null },
  });

  return NextResponse.json(await loadBoard());
}
