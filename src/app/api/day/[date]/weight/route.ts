import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTracker, loadBoard } from "@/lib/board";
import { keyToDate, monthRange, todayKey } from "@/lib/timezone";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Weight-only update for a calendar day.
 *
 * Unlike habit toggles (today/yesterday only), weight can be logged for any
 * day in the current month so weekly check-ins don't have to happen exactly
 * on the day the app is open.
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ date: string }> }) {
  const { date } = await ctx.params;

  if (!DATE_RE.test(date)) {
    return NextResponse.json({ error: "Bad date format, expected YYYY-MM-DD" }, { status: 400 });
  }

  const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });
  const tz = settings?.timezone ?? process.env.APP_TIMEZONE ?? "Asia/Kolkata";
  const today = todayKey(tz);

  if (date > today) {
    return NextResponse.json({ error: "Cannot log weight for future dates" }, { status: 400 });
  }

  const { start } = monthRange(today);
  if (date < start) {
    return NextResponse.json(
      { error: "Weight logging is only open for the current month" },
      { status: 400 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let weightKg: number | null = null;
  const w = body.weightKg;
  if (w !== null && w !== "" && w !== undefined) {
    const n = Number(w);
    if (!Number.isFinite(n) || n <= 0 || n > 500) {
      return NextResponse.json({ error: "weightKg must be between 0 and 500" }, { status: 400 });
    }
    weightKg = Math.round(n * 10) / 10;
  }

  const tracker = await getTracker();

  await prisma.dayEntry.upsert({
    where: { userId_date: { userId: tracker.id, date: keyToDate(date) } },
    update: { weightKg },
    create: { userId: tracker.id, date: keyToDate(date), weightKg },
  });

  return NextResponse.json(await loadBoard());
}
