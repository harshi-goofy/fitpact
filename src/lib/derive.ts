/**
 * View-state derived from the board.
 *
 * These are presentation rules, not domain rules — "what sentence goes in the
 * Do this next card", "how do I write 49320000 milliseconds". They live apart
 * from stats.ts on purpose: stats.ts decides what *counts*, and its answers are
 * load-bearing for the database. Nothing in this file changes a number, so it
 * can be edited freely when the copy changes.
 *
 * Pure and clock-injectable, so the tests don't depend on when they run.
 */

import type { BoardStats, Entry, HabitKey } from "./types";
import { addDays, type DateKey } from "./timezone";

/* ------------------------------------------------------------------ *
 * Do this next
 * ------------------------------------------------------------------ */

export type NextStep = {
  action: string;
  note: string;
  /** Something is unclaimed and today is burning — the card takes a warm border. */
  urgent: boolean;
};

/**
 * The single most useful sentence for the state the day is in.
 *
 * Three states, in priority order: something still unlogged beats something
 * unconfirmed, because only one of the two is the user's own move to make.
 */
export function nextStep(entry: Entry, streakCount: number, isRestDay = false): NextStep {
  const unlogged: string[] = [];
  if (!entry.swimDone) unlogged.push("Swim");
  if (!entry.gymDone) unlogged.push("Gym");
  if (!entry.dietDone) unlogged.push("Diet");

  // A move is either swim or gym, so having one of them is enough. Only nag
  // about "all three" when literally nothing has been claimed.
  const hasMove = entry.swimDone || entry.gymDone;
  const claimedSomething = hasMove || entry.dietDone;
  const moveConfirmed = hasMove && entry.moveConfirmedAt !== null;
  const dietConfirmed = entry.dietDone && entry.dietConfirmedAt !== null;
  const awaiting =
    Number(hasMove && !moveConfirmed) + Number(entry.dietDone && !dietConfirmed);

  if (isRestDay && !claimedSomething) {
    return {
      action: "Rest day",
      note: "Sundays keep the streak whatever you do. Log anyway if you moved.",
      urgent: false,
    };
  }

  if (!hasMove || !entry.dietDone) {
    const missing = !hasMove && !entry.dietDone ? ["Move", "Diet"] : !hasMove ? ["Move"] : ["Diet"];
    const label = unlogged.length === 3 ? "all three" : missing.join(" and ");
    const n = missing.length;
    return {
      action: `Log ${label}`,
      note: `${n} ${n === 1 ? "box" : "boxes"} still empty. Claim before midnight or today breaks the streak.`,
      urgent: true,
    };
  }

  if (awaiting > 0) {
    return {
      action: "Chase Manoj",
      note: "Everything claimed. None of it counts until he taps confirm.",
      urgent: false,
    };
  }

  return {
    action: "Day closed",
    note: `All three confirmed. Day ${streakCount} is banked.`,
    urgent: false,
  };
}

/** How many boxes on *today* are claimed but not yet confirmed. */
export function awaitingToday(entry: Entry): number {
  const hasMove = entry.swimDone || entry.gymDone;
  return (
    Number(hasMove && entry.moveConfirmedAt === null) +
    Number(entry.dietDone && entry.dietConfirmedAt === null)
  );
}

/** Which habits are claimed but unconfirmed — names the countdown row. */
export function awaitingLabel(entry: Entry): string {
  const n = awaitingToday(entry);
  if (n !== 1) return `${n} claims expire in`;
  const which = entry.swimDone && entry.moveConfirmedAt === null
    ? "Swim"
    : entry.gymDone && entry.moveConfirmedAt === null
      ? "Gym"
      : "Diet";
  return `${which} claim expires in`;
}

/* ------------------------------------------------------------------ *
 * The countdown
 * ------------------------------------------------------------------ */

/**
 * When today's claims die: the end of the day *after* today, i.e. midnight at
 * the start of the day after that.
 *
 * Built from the server's DateKey rather than the browser's clock so the phone
 * being set to the wrong timezone can't move the deadline. The returned Date is
 * an instant, which is the only thing worth counting down to.
 */
export function claimDeadline(today: DateKey): Date {
  return new Date(`${addDays(today, 2)}T00:00:00.000Z`);
}

/**
 * "1d 13h 42m" · "5h 3m" · "12m 40s"
 *
 * Precision rises as the deadline nears — seconds only matter in the last hour,
 * and showing them a day out is just a flickering distraction.
 */
export function formatCountdown(ms: number): string {
  const clamped = Math.max(0, ms);
  const totalH = Math.floor(clamped / 3_600_000);
  const m = Math.floor(clamped / 60_000) % 60;
  const s = Math.floor(clamped / 1000) % 60;
  if (totalH >= 24) return `${Math.floor(totalH / 24)}d ${totalH % 24}h ${m}m`;
  if (totalH >= 1) return `${totalH}h ${m}m`;
  return `${m}m ${s}s`;
}

/* ------------------------------------------------------------------ *
 * Cheat meals
 * ------------------------------------------------------------------ */

/** "1 of 3 used" — counts the cheat Sundays already behind us this month. */
export function cheatUsage(cheat: BoardStats["cheat"]): { used: number; total: number; label: string } {
  const total = cheat.slots.length;
  const used = cheat.slots.filter((s) => s.past).length;
  return { used, total, label: `${used} of ${total} used` };
}

/* ------------------------------------------------------------------ *
 * Calendar summary
 * ------------------------------------------------------------------ */

/**
 * The three numbers under the calendar grid.
 *
 * Denominator is days elapsed this month, not days in the month — on the 3rd,
 * "20% swim days" should mean 20% of the days that have actually happened.
 * Confirmed only, like everything else.
 */
export function calendarStats(
  entries: Record<DateKey, Entry>,
  today: DateKey,
): { value: string; label: string; color: string }[] {
  const month = today.slice(0, 7);
  const elapsed = Number(today.slice(8, 10));

  let swim = 0;
  let gym = 0;
  let diet = 0;
  for (const [k, e] of Object.entries(entries)) {
    if (!k.startsWith(month) || k > today) continue;
    if (e.swimDone && e.moveConfirmedAt) swim++;
    if (e.gymDone && e.moveConfirmedAt) gym++;
    if (e.dietDone && e.dietConfirmedAt) diet++;
  }

  const pct = (n: number) => (elapsed ? `${Math.round((n / elapsed) * 100)}%` : "0%");

  return [
    { value: pct(swim), label: "Swim days", color: "#5ecfe8" },
    { value: String(gym), label: gym === 1 ? "Gym session" : "Gym sessions", color: "#cbf03f" },
    { value: pct(diet), label: "Diet on target", color: "#ffb45c" },
  ];
}

/** How many days this month have any confirmed activity — the header count. */
export function activeDaysInMonth(entries: Record<DateKey, Entry>, today: DateKey): number {
  const month = today.slice(0, 7);
  let n = 0;
  for (const [k, e] of Object.entries(entries)) {
    if (!k.startsWith(month) || k > today) continue;
    const move = (e.swimDone || e.gymDone) && e.moveConfirmedAt !== null;
    const diet = e.dietDone && e.dietConfirmedAt !== null;
    if (move || diet) n++;
  }
  return n;
}

/* ------------------------------------------------------------------ *
 * Badge progress
 * ------------------------------------------------------------------ */

/**
 * "3/7" for a locked badge.
 *
 * Parsed from the badge id rather than stored, so adding a badge to BADGE_SPEC
 * doesn't require a second edit here. Anything unrecognised gets no progress
 * label, which is the correct behaviour for a badge that isn't a countable run.
 */
export function badgeProgress(
  id: string,
  stats: Pick<BoardStats, "streak" | "totals">,
): string | null {
  const m = /^(streak|swim|gym|diet)_(\d+)$/.exec(id);
  if (!m) return null;
  const [, kind, targetStr] = m;
  const target = Number(targetStr);
  const have =
    kind === "streak"
      ? Math.max(stats.streak.count, stats.streak.best)
      : stats.totals[kind as HabitKey];
  return `${Math.min(have, target)}/${target}`;
}
