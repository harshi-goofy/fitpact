/**
 * All date logic in FitPact goes through this module.
 *
 * A "day" is a calendar date in one fixed timezone (APP_TIMEZONE), never the
 * browser's timezone and never the server's local time. Tapping Gym at 11:58pm
 * has to land on today and at 12:02am on the new day, regardless of where the
 * request came from.
 *
 * Days are passed around as DateKey strings ("2026-08-08"). They are compared
 * with `===` and sorted lexicographically, which removes an entire class of
 * off-by-one-timezone bugs. They are only converted to Date objects at the
 * database boundary, where Prisma's @db.Date expects UTC midnight.
 */

export type DateKey = string; // "YYYY-MM-DD"

export const APP_TIMEZONE = process.env.APP_TIMEZONE ?? "Asia/Kolkata";

/** The current calendar date in `tz`. */
export function todayKey(tz: string = APP_TIMEZONE, now: Date = new Date()): DateKey {
  // "en-CA" happens to format as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(now);
}

/** The current hour (0–23) in `tz`. Used for evening reminders and nudges. */
export function hourInTz(tz: string = APP_TIMEZONE, now: Date = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hour: "2-digit",
      hour12: false,
    }).format(now),
  );
}

/** DateKey -> UTC-midnight Date, the shape Prisma's @db.Date wants. */
export function keyToDate(key: DateKey): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

/** Prisma @db.Date value -> DateKey. */
export function dateToKey(d: Date): DateKey {
  return d.toISOString().slice(0, 10);
}

/** Shift a DateKey by n days. UTC arithmetic, so DST can't bite. */
export function addDays(key: DateKey, n: number): DateKey {
  const d = keyToDate(key);
  d.setUTCDate(d.getUTCDate() + n);
  return dateToKey(d);
}

/** Whole days from `a` to `b` (negative if b is earlier). */
export function daysBetween(a: DateKey, b: DateKey): number {
  return Math.round((keyToDate(b).getTime() - keyToDate(a).getTime()) / 86_400_000);
}

/** 0 = Monday … 6 = Sunday. Weeks run Mon–Sun. */
export function dayOfWeek(key: DateKey): number {
  return (keyToDate(key).getUTCDay() + 6) % 7;
}

/** The Monday of the week containing `key`. */
export function weekStart(key: DateKey): DateKey {
  return addDays(key, -dayOfWeek(key));
}

/** "YYYY-MM" — used to scope the monthly token budgets. */
export function monthOf(key: DateKey): string {
  return key.slice(0, 7);
}

/**
 * Half-open [start, end) range covering the calendar month containing `key`.
 * Token budgets reset on the 1st, so every token query is scoped by this.
 */
export function monthRange(key: DateKey): { start: DateKey; end: DateKey } {
  const year = Number(key.slice(0, 4));
  const month = Number(key.slice(5, 7)); // 1–12
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    start: `${year}-${pad(month)}-01`,
    end: `${nextYear}-${pad(nextMonth)}-01`,
  };
}

/** Number of days in the calendar month containing `key`. */
export function daysInMonth(key: DateKey): number {
  const { start, end } = monthRange(key);
  return daysBetween(start, end);
}

/** Days left in the month, counting today. */
export function daysLeftInMonth(key: DateKey): number {
  return daysInMonth(key) - Number(key.slice(8, 10)) + 1;
}

/* ------------------------------------------------------------------ *
 * Rest and cheat days are calendar facts, not stored flags.
 *
 * Every Sunday is a rest day: the streak survives it whatever you did.
 * The 2nd and 4th Sunday of each month are also cheat days — afternoon
 * meal only — which lands on exactly two per month, every month, with
 * no counter to spend and nothing that can drift.
 * ------------------------------------------------------------------ */

export function isSunday(key: DateKey): boolean {
  return dayOfWeek(key) === 6;
}

/** Every Sunday in the calendar month containing `key`, in order. */
export function sundaysInMonth(key: DateKey): DateKey[] {
  const { start, end } = monthRange(key);
  const out: DateKey[] = [];
  let d = start;
  // Jump to the first Sunday, then stride a week at a time.
  d = addDays(d, (6 - dayOfWeek(d) + 7) % 7);
  while (d < end) {
    out.push(d);
    d = addDays(d, 7);
  }
  return out;
}

/** The 2nd and 4th Sunday of the month containing `key`. */
export function cheatSundays(key: DateKey): DateKey[] {
  const all = sundaysInMonth(key);
  return [all[1], all[3]].filter(Boolean);
}

export function isCheatSunday(key: DateKey): boolean {
  return cheatSundays(key).includes(key);
}

/** The next cheat Sunday on or after `key`. Rolls into next month if needed. */
export function nextCheatSunday(key: DateKey): DateKey {
  const upcoming = cheatSundays(key).find((d) => d >= key);
  if (upcoming) return upcoming;
  const { end } = monthRange(key);
  return cheatSundays(end)[0];
}

/**
 * Today and yesterday are editable; anything older is read-only.
 * You can catch up after falling asleep, but you cannot rewrite last week to
 * protect a streak — that's the line between a tracker and an accountability tool.
 */
export function isEditable(key: DateKey, today: DateKey = todayKey()): boolean {
  return key === today || key === addDays(today, -1);
}

/**
 * The partner's confirmation window: the day itself and the day after.
 * Same shape as isEditable, named separately because they answer different
 * questions and could diverge.
 */
export function isConfirmable(key: DateKey, today: DateKey = todayKey()): boolean {
  return key === today || key === addDays(today, -1);
}

/** Inclusive list of DateKeys ending at `end`, `count` long. */
export function lastNDays(count: number, end: DateKey = todayKey()): DateKey[] {
  const out: DateKey[] = [];
  for (let i = count - 1; i >= 0; i--) out.push(addDays(end, -i));
  return out;
}

/**
 * "Sat 8 Aug" — for day headings.
 * Formatted in UTC on purpose: the key already *is* the local calendar date,
 * so re-interpreting it in APP_TIMEZONE would shift it by a day for any
 * timezone west of UTC.
 */
export function formatDayLabel(key: DateKey): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(keyToDate(key));
}
