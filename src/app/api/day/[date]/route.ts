import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTracker, loadBoard } from "@/lib/board";
import { isEditable, keyToDate, monthRange, todayKey } from "@/lib/timezone";

export const dynamic = "force-dynamic";

const BOOLEAN_FIELDS = [
  "gymDone",
  "walkDone",
  "runDone",
  "swimDone",
  "dietDone",
  "isRestDay",
  "isCheatDay",
] as const;

type BooleanField = (typeof BOOLEAN_FIELDS)[number];

/** The only fields this route will ever write. */
type DayPatch = Partial<Record<BooleanField, boolean>> & {
  note?: string | null;
  weightKg?: number | null;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Partial update of one day.
 *
 * Everything the UI enforces is re-enforced here. Disabling a button is a
 * courtesy; this route is the actual rule.
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ date: string }> }) {
  const { date } = await ctx.params;

  if (!DATE_RE.test(date)) {
    return NextResponse.json({ error: "Bad date format, expected YYYY-MM-DD" }, { status: 400 });
  }

  const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });
  const tz = settings?.timezone ?? process.env.APP_TIMEZONE ?? "Asia/Kolkata";
  const today = todayKey(tz);

  // Today and yesterday only. Older days are history, not a draft.
  if (!isEditable(date, today)) {
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

  // Typed rather than Record<string, unknown>, so Prisma actually checks the
  // update and create payloads below instead of silently accepting anything.
  const data: DayPatch = {};

  for (const field of BOOLEAN_FIELDS) {
    if (field in body) {
      const value = body[field];
      if (typeof value !== "boolean") {
        return NextResponse.json({ error: `${field} must be a boolean` }, { status: 400 });
      }
      data[field] = value;
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
      data.weightKg = Math.round(n * 10) / 10; // one decimal place
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const tracker = await getTracker();
  const dateValue = keyToDate(date);

  const existing = await prisma.dayEntry.findUnique({
    where: { userId_date: { userId: tracker.id, date: dateValue } },
  });

  // Token budgets. Spending is only blocked when this edit is what would
  // overspend — un-marking always works, and re-saving an already-marked day
  // must not be treated as spending a second token.
  const budgetChecks = [
    { field: "isRestDay", total: settings?.monthlyRestTokens ?? 4, label: "rest days" },
    { field: "isCheatDay", total: settings?.monthlyCheatTokens ?? 4, label: "cheat days" },
  ] as const;

  const { start, end } = monthRange(date);

  for (const { field, total, label } of budgetChecks) {
    const turningOn = data[field] === true && !existing?.[field];
    if (!turningOn) continue;

    const used = await prisma.dayEntry.count({
      where: {
        userId: tracker.id,
        // Spelled out rather than computed, so Prisma's generated types can
        // still check the field name.
        ...(field === "isRestDay" ? { isRestDay: true } : { isCheatDay: true }),
        date: { gte: keyToDate(start), lt: keyToDate(end) },
      },
    });

    if (used >= total) {
      return NextResponse.json({ error: `No ${label} left this month.` }, { status: 409 });
    }
  }

  // Upsert on the unique (userId, date) pair, so a double-tap can never
  // produce two rows for the same day.
  await prisma.dayEntry.upsert({
    where: { userId_date: { userId: tracker.id, date: dateValue } },
    update: data,
    create: { userId: tracker.id, date: dateValue, ...data },
  });

  // Return the whole board: streaks and quotas may have changed in ways the
  // client can't derive from a single toggle, and one round trip beats two.
  return NextResponse.json(await loadBoard(90));
}
