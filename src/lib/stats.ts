/**
 * Every rule in FitPact, as pure functions over an entry map.
 *
 * The API, the server-rendered first paint and the client's optimistic updates
 * all call this one module. Nothing here touches Prisma, the network or the
 * clock — `today` is always passed in — which is what makes it unit-testable
 * and what stops two slightly different versions of the streak rule existing.
 *
 * THE RULES
 *   A day counts toward the streak when:
 *       Sunday                      -> always (every Sunday is a rest day)
 *       otherwise                   -> dietDone AND (swimDone OR gymDone)
 *   Today never breaks the streak. An unsatisfied today is `pending`.
 *   Cheat meals are the 2nd and 4th Sunday of the month, afternoon only.
 */

import {
  addDays,
  cheatSundays,
  dayOfWeek,
  daysBetween,
  daysLeftInMonth,
  formatDayLabel,
  isSunday,
  monthRange,
  nextCheatSunday,
  weekStart,
  type DateKey,
} from "./timezone";
import type {
  Badge,
  BoardStats,
  CheatPlan,
  Entry,
  HabitKey,
  MonthTarget,
  Streak,
  WeightPlan,
} from "./types";

export type EntryMap = Record<DateKey, Entry>;

export type StatsSettings = {
  monthlySwimTarget: number;
  monthlyGymTarget: number;
  monthlyDietTarget: number;
  startWeightKg: number;
  goalWeightKg: number;
  goalDate: DateKey;
  startDate: DateKey;
};

/* ------------------------------------------------------------------ *
 * The streak
 * ------------------------------------------------------------------ */

/** Did this day satisfy the streak? Sundays always do. */
export function daySatisfied(entries: EntryMap, key: DateKey): boolean {
  if (isSunday(key)) return true;
  const e = entries[key];
  if (!e) return false;
  return e.dietDone && (e.swimDone || e.gymDone);
}

/** Was anything at all logged? Drives "did I open the app" rendering. */
export function dayLogged(entries: EntryMap, key: DateKey): boolean {
  const e = entries[key];
  if (!e) return false;
  return (
    e.swimDone ||
    e.gymDone ||
    e.dietDone ||
    e.note !== null ||
    e.weightKg !== null ||
    e.hasPhoto
  );
}

/**
 * Count back from `from` while days keep satisfying the rule.
 * Bounded by `limit` so a corrupt map can't spin forever.
 */
function runLengthEndingAt(entries: EntryMap, from: DateKey, limit = 2000): number {
  let n = 0;
  let cursor = from;
  while (n < limit && daySatisfied(entries, cursor)) {
    n++;
    cursor = addDays(cursor, -1);
  }
  return n;
}

/**
 * The current streak.
 *
 * Computed backwards from yesterday, then today is added only if it is already
 * satisfied. A streak shown at 3pm must not read 0 because the evening has not
 * happened yet — that is the difference between a tracker you keep and one you
 * delete in week two.
 */
export function currentStreak(entries: EntryMap, today: DateKey): { count: number; pending: boolean } {
  const throughYesterday = runLengthEndingAt(entries, addDays(today, -1));
  const todayDone = daySatisfied(entries, today);
  return {
    count: throughYesterday + (todayDone ? 1 : 0),
    pending: !todayDone,
  };
}

/** Longest run ever recorded, scanning from `startDate` to today. */
export function bestStreak(entries: EntryMap, today: DateKey, startDate: DateKey): number {
  let best = 0;
  let run = 0;
  const span = Math.max(0, daysBetween(startDate, today));
  for (let i = 0; i <= span; i++) {
    const key = addDays(startDate, i);
    // Today is still open, so it can neither extend nor break the record yet.
    if (key === today && !daySatisfied(entries, key)) break;
    if (daySatisfied(entries, key)) {
      run++;
      if (run > best) best = run;
    } else {
      run = 0;
    }
  }
  return best;
}

/** Mon–Sun bars for the hero card, for the week containing `today`. */
export function streakWeek(entries: EntryMap, today: DateKey): Streak["week"] {
  const monday = weekStart(today);
  const labels = ["M", "T", "W", "T", "F", "S", "S"];
  return labels.map((label, i) => {
    const date = addDays(monday, i);
    return {
      label,
      date,
      done: date <= today && daySatisfied(entries, date),
      future: date > today,
    };
  });
}

export function buildStreak(entries: EntryMap, today: DateKey, startDate: DateKey): Streak {
  const { count, pending } = currentStreak(entries, today);
  return {
    count,
    pending,
    best: Math.max(count, bestStreak(entries, today, startDate)),
    week: streakWeek(entries, today),
  };
}

/* ------------------------------------------------------------------ *
 * Monthly targets
 * ------------------------------------------------------------------ */

/** Entry keys inside the calendar month containing `key`, up to and including today. */
export function monthKeys(entries: EntryMap, key: DateKey, today: DateKey): DateKey[] {
  const { start, end } = monthRange(key);
  return Object.keys(entries).filter((k) => k >= start && k < end && k <= today);
}

export function countInMonth(entries: EntryMap, today: DateKey, habit: HabitKey): number {
  const field = `${habit}Done` as const;
  return monthKeys(entries, today, today).filter((k) => entries[k][field]).length;
}

export function buildMonthTargets(
  entries: EntryMap,
  today: DateKey,
  s: StatsSettings,
): MonthTarget[] {
  const left = daysLeftInMonth(today);
  const weeksLeft = Math.max(left / 7, 0.01);

  const spec: { key: HabitKey; label: string; target: number }[] = [
    { key: "swim", label: "Swim sessions", target: s.monthlySwimTarget },
    { key: "gym", label: "Gym sessions", target: s.monthlyGymTarget },
    { key: "diet", label: "Diet days on target", target: s.monthlyDietTarget },
  ];

  return spec.map(({ key, label, target }) => {
    const done = countInMonth(entries, today, key);
    const remaining = Math.max(target - done, 0);
    const perWeek = remaining / weeksLeft;

    let note: string;
    if (remaining === 0) {
      note = "Target met for the month";
    } else if (remaining > left) {
      note = `${remaining} to go · only ${left} day${left === 1 ? "" : "s"} left, out of reach`;
    } else {
      note = `${remaining} to go · ${perWeek.toFixed(1)} per week keeps you on track`;
    }

    return { key, label, done, target, pct: target === 0 ? 0 : Math.min(done / target, 1), note };
  });
}

/* ------------------------------------------------------------------ *
 * The weight plan
 * ------------------------------------------------------------------ */

/** Most recent logged weight, or the plan's starting weight if none yet. */
export function currentWeight(entries: EntryMap, today: DateKey, fallback: number): number {
  const keys = Object.keys(entries)
    .filter((k) => k <= today && entries[k].weightKg !== null)
    .sort();
  const last = keys[keys.length - 1];
  return last ? (entries[last].weightKg as number) : fallback;
}

/**
 * Back-calculate the plan.
 *
 * The straight line runs from (startDate, startKg) to (goalDate, goalKg), and
 * each month's checkpoint is that line evaluated on the last day of the month.
 * `perWeekNeeded` is recomputed from where you actually are today, so it rises
 * if you fall behind rather than silently keeping the original promise.
 */
export function buildWeightPlan(
  entries: EntryMap,
  today: DateKey,
  s: StatsSettings,
): WeightPlan {
  const currentKg = currentWeight(entries, today, s.startWeightKg);
  const totalDays = Math.max(daysBetween(s.startDate, s.goalDate), 1);
  const perDayPlanned = (s.startWeightKg - s.goalWeightKg) / totalDays;

  const checkpoints: WeightPlan["checkpoints"] = [];
  let cursor = monthRange(today).start;
  // Walk month by month to the goal, recording the last day of each.
  for (let guard = 0; guard < 60; guard++) {
    const { end } = monthRange(cursor);
    const lastDay = addDays(end, -1);
    const date = lastDay > s.goalDate ? s.goalDate : lastDay;
    const elapsed = Math.min(Math.max(daysBetween(s.startDate, date), 0), totalDays);
    checkpoints.push({
      month: new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "short" }).format(
        new Date(`${date}T00:00:00.000Z`),
      ),
      date,
      targetKg: Math.round((s.startWeightKg - perDayPlanned * elapsed) * 10) / 10,
    });
    if (date >= s.goalDate) break;
    cursor = end;
  }

  const daysToGoal = Math.max(daysBetween(today, s.goalDate), 0);
  const weeksToGoal = Math.max(daysToGoal / 7, 0.01);
  const toGoKg = Math.max(currentKg - s.goalWeightKg, 0);
  const span = s.startWeightKg - s.goalWeightKg;

  return {
    startKg: s.startWeightKg,
    goalKg: s.goalWeightKg,
    currentKg: Math.round(currentKg * 10) / 10,
    goalDate: s.goalDate,
    lostKg: Math.round((s.startWeightKg - currentKg) * 10) / 10,
    toGoKg: Math.round(toGoKg * 10) / 10,
    pct: span <= 0 ? 1 : Math.min(Math.max((s.startWeightKg - currentKg) / span, 0), 1),
    perWeekNeeded: Math.round((toGoKg / weeksToGoal) * 100) / 100,
    daysToGoal,
    checkpoints,
    nextCheckpoint: checkpoints[0] ?? null,
  };
}

/* ------------------------------------------------------------------ *
 * Cheat meals
 * ------------------------------------------------------------------ */

function relativeDayLabel(from: DateKey, to: DateKey): string {
  const n = daysBetween(from, to);
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  if (n < 0) return `${Math.abs(n)} days ago`;
  return `in ${n} days`;
}

export function buildCheatPlan(today: DateKey): CheatPlan {
  // "2nd of 2 this month" is the one that should make you think twice, so the
  // ordinal is part of the label rather than something you have to count.
  const all = cheatSundays(today);
  const slots = all.map((date, i) => ({
    date,
    label: formatDayLabel(date),
    state:
      date < today
        ? "Used"
        : `${i + 1}${i === 0 ? "st" : "nd"} of ${all.length} this month`,
    past: date < today,
  }));

  const next = nextCheatSunday(today);
  return {
    slots,
    next,
    nextLabel: formatDayLabel(next),
    whenLabel: relativeDayLabel(today, next),
  };
}

/* ------------------------------------------------------------------ *
 * Badges
 * ------------------------------------------------------------------ */

const BADGE_SPEC: Omit<Badge, "earned">[] = [
  { id: "swim_1", name: "First Splash", description: "Log your first swim", habit: "swim", letter: "S" },
  { id: "gym_1", name: "First Rep", description: "Log your first gym session", habit: "gym", letter: "G" },
  { id: "diet_1", name: "Clean Plate", description: "First diet day on target", habit: "diet", letter: "D" },
  { id: "streak_7", name: "Week One", description: "7-day streak", habit: "streak", letter: "7" },
  { id: "streak_14", name: "Fortnight", description: "14-day streak", habit: "streak", letter: "14" },
  { id: "streak_30", name: "Month Strong", description: "30-day streak", habit: "streak", letter: "30" },
  { id: "streak_100", name: "Century", description: "100-day streak", habit: "streak", letter: "100" },
  { id: "swim_25", name: "Open Water", description: "25 swim sessions", habit: "swim", letter: "25" },
  { id: "gym_50", name: "Iron Habit", description: "50 gym sessions", habit: "gym", letter: "50" },
  { id: "perfect_7", name: "Perfect Week", description: "7 days with all three logged", habit: "streak", letter: "P" },
  { id: "weight_2", name: "First Two", description: "2 kg down from the start", habit: "weight", letter: "2" },
  { id: "weight_half", name: "Halfway", description: "Halfway to your goal weight", habit: "weight", letter: "½" },
];

/** Longest run of days where all three were logged. */
export function longestPerfectRun(entries: EntryMap, today: DateKey, startDate: DateKey): number {
  let best = 0;
  let run = 0;
  const span = Math.max(0, daysBetween(startDate, today));
  for (let i = 0; i <= span; i++) {
    const e = entries[addDays(startDate, i)];
    if (e && e.swimDone && e.gymDone && e.dietDone) {
      run++;
      if (run > best) best = run;
    } else {
      run = 0;
    }
  }
  return best;
}

export function buildBadges(
  entries: EntryMap,
  today: DateKey,
  s: StatsSettings,
  totals: { swim: number; gym: number; diet: number },
  streak: Streak,
  weight: WeightPlan,
): Badge[] {
  const perfect = longestPerfectRun(entries, today, s.startDate);
  const span = s.startWeightKg - s.goalWeightKg;

  const earned: Record<string, boolean> = {
    swim_1: totals.swim >= 1,
    gym_1: totals.gym >= 1,
    diet_1: totals.diet >= 1,
    streak_7: streak.best >= 7,
    streak_14: streak.best >= 14,
    streak_30: streak.best >= 30,
    streak_100: streak.best >= 100,
    swim_25: totals.swim >= 25,
    gym_50: totals.gym >= 50,
    perfect_7: perfect >= 7,
    weight_2: weight.lostKg >= 2,
    weight_half: span > 0 && weight.lostKg >= span / 2,
  };

  return BADGE_SPEC.map((b) => ({ ...b, earned: earned[b.id] ?? false }));
}

/* ------------------------------------------------------------------ *
 * Calendar heat
 * ------------------------------------------------------------------ */

/** 0–3: how many of swim / gym / diet were logged that day. */
export function heatLevel(entries: EntryMap, key: DateKey): 0 | 1 | 2 | 3 {
  const e = entries[key];
  if (!e) return 0;
  return (Number(e.swimDone) + Number(e.gymDone) + Number(e.dietDone)) as 0 | 1 | 2 | 3;
}

/* ------------------------------------------------------------------ *
 * Everything at once
 * ------------------------------------------------------------------ */

export function computeStats(entries: EntryMap, today: DateKey, s: StatsSettings): BoardStats {
  const all = Object.keys(entries).filter((k) => k <= today);
  const totals = {
    swim: all.filter((k) => entries[k].swimDone).length,
    gym: all.filter((k) => entries[k].gymDone).length,
    diet: all.filter((k) => entries[k].dietDone).length,
    sessions: 0,
  };
  totals.sessions = totals.swim + totals.gym;

  const streak = buildStreak(entries, today, s.startDate);
  const weight = buildWeightPlan(entries, today, s);
  const badges = buildBadges(entries, today, s, totals, streak, weight);

  return {
    today,
    streak,
    monthTargets: buildMonthTargets(entries, today, s),
    daysLeftInMonth: daysLeftInMonth(today),
    monthLabel: new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "long" }).format(
      new Date(`${today}T00:00:00.000Z`),
    ),
    weight,
    cheat: buildCheatPlan(today),
    isRestToday: isSunday(today),
    totals,
    badges,
    badgesEarned: badges.filter((b) => b.earned).length,
  };
}

// Re-exported so components don't reach into timezone.ts for one helper.
export { dayOfWeek };
