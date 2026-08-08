import { NextResponse } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getTracker, loadBoard } from "@/lib/board";
import { isEditable, keyToDate, todayKey } from "@/lib/timezone";

export const dynamic = "force-dynamic";

const BOOLEAN_FIELDS = ["swimDone", "gymDone", "dietDone"] as const;
type BooleanField = (typeof BOOLEAN_FIELDS)[number];

type DayPatch = Partial<Record<BooleanField, boolean>> & {
  note?: string | null;
  weightKg?: number | null;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Partial update of one day.
 *
 * Everything the UI enforces is re-enforced here. Disabling a control is a
 * courtesy; this route is the actual rule. There are no token budgets to check
 * any more — rest and cheat days are calendar facts, so there is nothing a
 * client could overspend.
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ date: string }> }) {
  const { date } = await ctx.params;

  // Logging is the tracker's job; the partner's job is confirming it.
  try {
    await requireRole("TRACKER");
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

  // Today and yesterday only. Older days are history, not a draft.
  if (!isEditable(date, todayKey(tz))) {
    return NextResponse.json(
      { error: "That day is locked. Only today and yesterday can be edited." },
      { status: 403 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const data: DayPatch = {};

  for (const field of BOOLEAN_FIELDS) {
    if (field in body) {
      if (typeof body[field] !== "boolean") {
        return NextResponse.json({ error: `${field} must be a boolean` }, { status: 400 });
      }
      data[field] = body[field] as boolean;
    }
  }

  if ("note" in body) {
    const note = body.note;
    if (note !== null && typeof note !== "string") {
      return NextResponse.json({ error: "note must be a string or null" }, { status: 400 });
    }
    data.note = note === null || note === "" ? null : String(note).slice(0, 280);
  }

  if ("weightKg" in body) {
    const w = body.weightKg;
    if (w === null || w === "") {
      data.weightKg = null;
    } else {
      const n = Number(w);
      if (!Number.isFinite(n) || n <= 0 || n > 500) {
        return NextResponse.json({ error: "weightKg must be between 0 and 500" }, { status: 400 });
      }
      data.weightKg = Math.round(n * 10) / 10;
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const tracker = await getTracker();

  /**
   * Changing a claim invalidates its confirmation.
   *
   * Otherwise: log gym, get it confirmed, then tick swim as well and the swim
   * arrives pre-confirmed without the partner ever seeing it. Any edit to the
   * move fields clears the move confirmation, and likewise for diet.
   */
  const touchedMove = "swimDone" in data || "gymDone" in data;
  const touchedDiet = "dietDone" in data;
  const reset = {
    ...(touchedMove ? { moveConfirmedAt: null } : {}),
    ...(touchedDiet ? { dietConfirmedAt: null } : {}),
  };

  // Upsert on the unique (userId, date) pair, so a double-tap can never
  // produce two rows for the same day.
  await prisma.dayEntry.upsert({
    where: { userId_date: { userId: tracker.id, date: keyToDate(date) } },
    update: { ...data, ...reset },
    create: { userId: tracker.id, date: keyToDate(date), ...data },
  });

  // Return the whole board: the streak and month targets may have moved in
  // ways the client can't derive from one toggle.
  return NextResponse.json(await loadBoard());
}
