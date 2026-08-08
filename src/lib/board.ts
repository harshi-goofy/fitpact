/**
 * Loads everything the board needs in one query and shapes it for the client.
 * Shared by the page (server component) and GET /api/board so the first paint
 * and every refetch go through identical code.
 */

import { prisma } from "./db";
import { computeStats, type EntryMap } from "./stats";
import { addDays, dateToKey, lastNDays, todayKey, type DateKey } from "./timezone";
import type { BoardPayload, Entry } from "./types";

const DEFAULT_SETTINGS = {
  timezone: process.env.APP_TIMEZONE ?? "Asia/Kolkata",
  weeklyGymTarget: 5,
  weeklySwimTarget: 7,
  monthlyRestTokens: 4,
  monthlyCheatTokens: 4,
  whyNote: null as string | null,
};

/** The single tracker. v1 shows one; the schema already supports more. */
export async function getTracker() {
  const tracker = await prisma.user.findFirst({ where: { role: "TRACKER" } });
  if (!tracker) {
    throw new Error(
      "No TRACKER user found. Run `npm run db:seed` to create the two accounts.",
    );
  }
  return tracker;
}

export async function loadBoard(days = 90): Promise<BoardPayload> {
  const settingsRow = await prisma.settings.findUnique({ where: { id: "singleton" } });
  const settings = settingsRow ?? DEFAULT_SETTINGS;
  const tz = settings.timezone;

  const today = todayKey(tz);
  const tracker = await getTracker();

  // Pull a little extra history so streaks that predate the visible window
  // still resolve correctly.
  const windowStart = addDays(today, -(days + 400));

  const rows = await prisma.dayEntry.findMany({
    where: {
      userId: tracker.id,
      date: { gte: new Date(`${windowStart}T00:00:00.000Z`) },
    },
    select: {
      date: true,
      gymDone: true,
      walkDone: true,
      runDone: true,
      swimDone: true,
      dietDone: true,
      isRestDay: true,
      isCheatDay: true,
      note: true,
      weightKg: true,
      photoMime: true,
    },
    orderBy: { date: "asc" },
  });

  const entries: Record<DateKey, Entry> = {};
  for (const r of rows) {
    const key = dateToKey(r.date);
    entries[key] = {
      date: key,
      gymDone: r.gymDone,
      walkDone: r.walkDone,
      runDone: r.runDone,
      swimDone: r.swimDone,
      dietDone: r.dietDone,
      isRestDay: r.isRestDay,
      isCheatDay: r.isCheatDay,
      note: r.note,
      weightKg: r.weightKg,
      hasPhoto: r.photoMime !== null,
    };
  }

  const stats = computeStats(entries as EntryMap, today, {
    weeklyGymTarget: settings.weeklyGymTarget,
    weeklySwimTarget: settings.weeklySwimTarget,
    monthlyRestTokens: settings.monthlyRestTokens,
    monthlyCheatTokens: settings.monthlyCheatTokens,
  });

  return {
    today,
    days: lastNDays(days, today),
    entries,
    stats,
    settings: {
      timezone: settings.timezone,
      weeklyGymTarget: settings.weeklyGymTarget,
      weeklySwimTarget: settings.weeklySwimTarget,
      monthlyRestTokens: settings.monthlyRestTokens,
      monthlyCheatTokens: settings.monthlyCheatTokens,
      whyNote: settings.whyNote,
    },
    tracker: { id: tracker.id, name: tracker.name },
  };
}
