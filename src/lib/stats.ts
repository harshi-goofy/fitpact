/**
 * Streak, weekly-quota and token math. Pure functions over a map of entries,
 * so it is directly unit-testable and shared by the API, the UI and the cron
 * jobs. Nothing here reads the database or the clock — `today` is always passed
 * in, resolved through APP_TIMEZONE by the caller.
 *
 * Do not reimplement any of this in a component. If the board and the weekly
 * recap ever disagree about a streak, the whole app stops being trustworthy.
 */

import { addDays, dayOfWeek, monthOf, weekStart, type DateKey } from "./timezone";
import type { BoardStats, Entry, HabitKey, StreakState, Tokens, WeekQuota } from "./types";

export type EntryMap = Record<DateKey, Entry | undefined>;

// ---------------------------------------------------------------------------
// Per-day predicates — the three streak conditions, in one place.
// ---------------------------------------------------------------------------

/** Any one of gym / walk / run satisfies the day. A rest token also covers it. */
export function movementSatisfied(e?: Entry): boolean {
  if (!e) return false;
  return e.gymDone || e.walkDone || e.runDone || e.isRestDay;
}

/** Swim is its own commitment. Movement does not cover it. */
export function swimSatisfied(e?: Entry): boolean {
  if (!e) return false;
  return e.swimDone || e.isRestDay;
}

/** A cheat token covers diet. A rest day does not — you still eat on a rest day. */
export function dietSatisfied(e?: Entry): boolean {
  if (!e) return false;
  return e.dietDone || e.isCheatDay;
}

export const SATISFIED: Record<HabitKey, (e?: Entry) => boolean> = {
  movement: movementSatisfied,
  swim: swimSatisfied,
  diet: dietSatisfied,
};

/** Satisfied only because a token was spent — rendered in a muted tone, never as a miss. */
export function satisfiedByToken(habit: HabitKey, e?: Entry): boolean {
  if (!e || !SATISFIED[habit](e)) return false;
  if (habit === "diet") return e.isCheatDay && !e.dietDone;
  return e.isRestDay && !(habit === "swim" ? e.swimDone : e.gymDone || e.walkDone || e.runDone);
}

/** A day counts as logged if the tracker put anything at all in it. */
export function isLogged(e?: Entry): boolean {
  if (!e) return false;
  return (
    e.gymDone ||
    e.walkDone ||
    e.runDone ||
    e.swimDone ||
    e.dietDone ||
    e.isRestDay ||
    e.isCheatDay ||
    e.note !== null ||
    e.weightKg !== null ||
    e.hasPhoto
  );
}

/** Movement + swim + diet, all real, no tokens spent. The hardest thing the app asks for. */
export function isPerfectDay(e?: Entry): boolean {
  if (!e) return false;
  return (
    (e.gymDone || e.walkDone || e.runDone) &&
    e.swimDone &&
    e.dietDone &&
    !e.isRestDay &&
    !e.isCheatDay
  );
}

// ---------------------------------------------------------------------------
// Streaks
// ---------------------------------------------------------------------------

/**
 * Consecutive satisfied days, counted backwards from yesterday, with today
 * added only if it is already satisfied.
 *
 * Today never breaks a streak. An unchecked today is `pending`, not a zero —
 * a streak read at 3pm must not say 0 just because the evening hasn't happened.
 */
export function streak(habit: HabitKey, entries: EntryMap, today: DateKey): StreakState {
  const ok = SATISFIED[habit];
  let count = 0;

  let cursor = addDays(today, -1);
  // A guard rail, not a business rule: stop after ~5 years of history.
  for (let i = 0; i < 2000; i++) {
    if (!ok(entries[cursor])) break;
    count++;
    cursor = addDays(cursor, -1);
  }

  const todayOk = ok(entries[today]);
  if (todayOk) count++;

  return { count, pending: !todayOk };
}

/** Consecutive perfect days, same pending semantics as a habit streak. */
export function perfectDayStreak(entries: EntryMap, today: DateKey): StreakState {
  let count = 0;
  let cursor = addDays(today, -1);
  for (let i = 0; i < 2000; i++) {
    if (!isPerfectDay(entries[cursor])) break;
    count++;
    cursor = addDays(cursor, -1);
  }
  const todayOk = isPerfectDay(entries[today]);
  if (todayOk) count++;
  return { count, pending: !todayOk };
}

// ---------------------------------------------------------------------------
// Weekly quotas
// ---------------------------------------------------------------------------

function countInWeek(entries: EntryMap, monday: DateKey, pred: (e?: Entry) => boolean): number {
  let n = 0;
  for (let i = 0; i < 7; i++) if (pred(entries[addDays(monday, i)])) n++;
  return n;
}

/**
 * Gym days this week against the target.
 *
 * Walking and running satisfy the daily streak but deliberately do not count
 * here — they are what the remaining days are allowed to look like. Neither
 * does a rest day.
 */
export function gymQuota(entries: EntryMap, today: DateKey, target: number): WeekQuota {
  const monday = weekStart(today);
  const done = countInWeek(entries, monday, (e) => !!e?.gymDone);
  const daysRemaining = 7 - dayOfWeek(today); // including today
  const needed = Math.max(0, target - done);
  return {
    done,
    target,
    daysRemaining,
    met: done >= target,
    // The nudge that actually changes behaviour, and it has to appear
    // while the week is still winnable.
    noSlack: needed > 0 && needed >= daysRemaining,
  };
}

export function swimQuota(entries: EntryMap, today: DateKey, target: number): WeekQuota {
  const monday = weekStart(today);
  const done = countInWeek(entries, monday, (e) => !!e?.swimDone);
  const daysRemaining = 7 - dayOfWeek(today);
  const needed = Math.max(0, target - done);
  return {
    done,
    target,
    daysRemaining,
    met: done >= target,
    noSlack: needed > 0 && needed >= daysRemaining,
  };
}

/** Consecutive fully-completed past weeks that met the gym target. */
export function metWeekStreak(entries: EntryMap, today: DateKey, target: number): number {
  let count = 0;
  let monday = addDays(weekStart(today), -7); // start from last completed week
  for (let i = 0; i < 260; i++) {
    if (countInWeek(entries, monday, (e) => !!e?.gymDone) < target) break;
    count++;
    monday = addDays(monday, -7);
  }
  return count;
}

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

/**
 * Remaining tokens are always derived, never stored. A counter can drift out of
 * sync with the entries; a count cannot.
 */
export function tokens(
  entries: EntryMap,
  today: DateKey,
  total: number,
  field: "isRestDay" | "isCheatDay",
): Tokens {
  const month = monthOf(today);
  let used = 0;
  for (const key of Object.keys(entries)) {
    if (monthOf(key) === month && entries[key]?.[field]) used++;
  }
  return { used, total, left: Math.max(0, total - used) };
}

// ---------------------------------------------------------------------------
// Everything the board header needs, in one pass.
// ---------------------------------------------------------------------------

export function computeStats(
  entries: EntryMap,
  today: DateKey,
  settings: {
    weeklyGymTarget: number;
    weeklySwimTarget: number;
    monthlyRestTokens: number;
    monthlyCheatTokens: number;
  },
): BoardStats {
  return {
    today,
    streaks: {
      movement: streak("movement", entries, today),
      swim: streak("swim", entries, today),
      diet: streak("diet", entries, today),
    },
    gymWeek: gymQuota(entries, today, settings.weeklyGymTarget),
    swimWeek: swimQuota(entries, today, settings.weeklySwimTarget),
    metWeekStreak: metWeekStreak(entries, today, settings.weeklyGymTarget),
    rest: tokens(entries, today, settings.monthlyRestTokens, "isRestDay"),
    cheat: tokens(entries, today, settings.monthlyCheatTokens, "isCheatDay"),
  };
}
