/**
 * Loads everything the app needs in one place and shapes it for the client.
 * Shared by the page (server component) and GET /api/board, so the first paint
 * and every refetch go through identical code.
 */

import { currentUser } from "./auth";
import { prisma } from "./db";
import { computeStats, type EntryMap, type StatsSettings } from "./stats";
import { addDays, dateToKey, keyToDate, lastNDays, todayKey, type DateKey } from "./timezone";
import type { BoardPayload, CommentDTO, Entry } from "./types";

/** Used only when the Settings row is missing — i.e. the seed hasn't run. */
const FALLBACK = {
  timezone: process.env.APP_TIMEZONE ?? "Asia/Kolkata",
  monthlySwimTarget: 16,
  monthlyGymTarget: 20,
  monthlyDietTarget: 28,
  startWeightKg: 88,
  goalWeightKg: 78,
  whyNote: null as string | null,
};

export async function getTracker() {
  const tracker = await prisma.user.findFirst({ where: { role: "TRACKER" } });
  if (!tracker) {
    throw new Error("No TRACKER user found. Run `npm run db:seed` to create the accounts.");
  }
  return tracker;
}

export async function getPartner() {
  return prisma.user.findFirst({ where: { role: "PARTNER" } });
}

export async function loadBoard(days = 180): Promise<BoardPayload> {
  const row = await prisma.settings.findUnique({ where: { id: "singleton" } });
  const tz = row?.timezone ?? FALLBACK.timezone;
  const today = todayKey(tz);

  const [tracker, partner, me] = await Promise.all([getTracker(), getPartner(), currentUser()]);

  // Pull extra history so a streak that predates the visible window still
  // resolves, and so lifetime totals and best-ever are honest.
  const windowStart = addDays(today, -(days + 800));

  const [rows, commentRows, rewardRows] = await Promise.all([
    prisma.dayEntry.findMany({
      where: { userId: tracker.id, date: { gte: keyToDate(windowStart) } },
      select: {
        date: true,
        swimDone: true,
        gymDone: true,
        dietDone: true,
        moveConfirmedAt: true,
        dietConfirmedAt: true,
        note: true,
        weightKg: true,
        photoMime: true,
      },
      orderBy: { date: "asc" },
    }),
    prisma.comment.findMany({
      where: { date: { gte: keyToDate(addDays(today, -90)) } },
      include: { author: { select: { id: true, name: true, role: true } } },
      orderBy: { createdAt: "asc" },
      take: 300,
    }),
    prisma.reward.findMany({ orderBy: { kgLost: "asc" } }),
  ]);

  const entries: Record<DateKey, Entry> = {};
  for (const r of rows) {
    const key = dateToKey(r.date);
    entries[key] = {
      date: key,
      swimDone: r.swimDone,
      gymDone: r.gymDone,
      dietDone: r.dietDone,
      moveConfirmedAt: r.moveConfirmedAt?.toISOString() ?? null,
      dietConfirmedAt: r.dietConfirmedAt?.toISOString() ?? null,
      note: r.note,
      weightKg: r.weightKg,
      hasPhoto: r.photoMime !== null,
    };
  }

  const startDate = row ? dateToKey(row.startDate) : today;
  const goalDate = row ? dateToKey(row.goalDate) : `${Number(today.slice(0, 4)) + 1}-01-01`;

  const settings: StatsSettings = {
    monthlySwimTarget: row?.monthlySwimTarget ?? FALLBACK.monthlySwimTarget,
    monthlyGymTarget: row?.monthlyGymTarget ?? FALLBACK.monthlyGymTarget,
    monthlyDietTarget: row?.monthlyDietTarget ?? FALLBACK.monthlyDietTarget,
    startWeightKg: row?.startWeightKg ?? FALLBACK.startWeightKg,
    goalWeightKg: row?.goalWeightKg ?? FALLBACK.goalWeightKg,
    goalDate,
    startDate,
  };

  const comments: CommentDTO[] = commentRows.map((c) => ({
    id: c.id,
    date: dateToKey(c.date),
    authorId: c.authorId,
    authorName: c.author.name,
    authorRole: c.author.role,
    body: c.body,
    cheer: c.cheer,
    createdAt: c.createdAt.toISOString(),
    seen: c.seenAt !== null,
  }));

  return {
    today,
    days: lastNDays(days, today),
    entries,
    stats: computeStats(entries as EntryMap, today, settings, rewardRows),
    settings: {
      timezone: tz,
      monthlySwimTarget: settings.monthlySwimTarget,
      monthlyGymTarget: settings.monthlyGymTarget,
      monthlyDietTarget: settings.monthlyDietTarget,
      startWeightKg: settings.startWeightKg,
      goalWeightKg: settings.goalWeightKg,
      goalDate: settings.goalDate,
      whyNote: row?.whyNote ?? FALLBACK.whyNote,
    },
    tracker: { id: tracker.id, name: tracker.name },
    partner: partner ? { id: partner.id, name: partner.name } : null,
    comments,
    // Anything the partner said that the tracker hasn't acknowledged yet.
    unseen: comments.filter((c) => !c.seen && c.authorRole === "PARTNER").length,
    me: me ? { id: me.id, name: me.name, role: me.role } : null,
  };
}
