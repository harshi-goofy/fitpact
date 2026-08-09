/**
 * Unit tests for the rules. Run: npx tsx src/lib/stats.test.ts
 *
 * No test framework on purpose — these are pure functions over plain objects,
 * and one dependency-free file that either prints "all passed" or throws is
 * worth more here than a runner nobody will configure.
 */

import {
  buildCheatPlan,
  buildConfirmRows,
  buildMonthTargets,
  buildRewards,
  buildWeightPlan,
  bestStreak,
  currentStreak,
  dayExpired,
  daySatisfied,
  heatLevel,
  longestPerfectRun,
  streakWeek,
  type EntryMap,
  type StatsSettings,
} from "./stats";
import {
  addDays,
  cheatSundays,
  daysBetween,
  isCheatSunday,
  isSunday,
  nextCheatSunday,
  sundaysInMonth,
} from "./timezone";
import type { Entry } from "./types";

/* ---- tiny harness ------------------------------------------------- */

let passed = 0;
const failures: string[] = [];

function check(name: string, fn: () => void) {
  try {
    fn();
    passed++;
  } catch (e) {
    failures.push(`${name}\n    ${e instanceof Error ? e.message : String(e)}`);
  }
}

function eq<T>(actual: T, expected: T, msg = "") {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${msg} expected ${b}, got ${a}`);
}

/* ---- fixtures ------------------------------------------------------ */

/**
 * "sgd" -> swim+gym+diet, "d" -> diet only, "" -> logged but nothing done.
 *
 * Confirmed by default, because most tests are about the streak rule rather
 * than the confirmation mechanic. Append "!" to leave the day unconfirmed —
 * i.e. claimed by the tracker but never ticked by the partner.
 */
function entry(date: string, flags: string): Entry {
  const unconfirmed = flags.includes("!");
  const stamp = unconfirmed ? null : "2026-01-01T00:00:00.000Z";
  return {
    date,
    swimDone: flags.includes("s"),
    gymDone: flags.includes("g"),
    dietDone: flags.includes("d"),
    moveConfirmedAt: stamp,
    dietConfirmedAt: stamp,
    note: null,
    weightKg: null,
    hasPhoto: false,
  };
}

function map(spec: Record<string, string>): EntryMap {
  const out: EntryMap = {};
  for (const [date, flags] of Object.entries(spec)) out[date] = entry(date, flags);
  return out;
}

// These fields hold WEEKLY targets; buildMonthTargets multiplies by the
// number of weeks in the month. Aug 2026 has 31 days -> 4 weeks.
const SETTINGS: StatsSettings = {
  monthlySwimTarget: 4,
  monthlyGymTarget: 5,
  monthlyDietTarget: 7,
  startWeightKg: 88,
  goalWeightKg: 78,
  goalDate: "2027-01-01",
  startDate: "2026-08-08",
};

/* ---- calendar facts ------------------------------------------------ */
// Aug 2026 Sundays: 2, 9, 16, 23, 30. Aug 8 2026 is a Saturday.

check("Sunday detection", () => {
  eq(isSunday("2026-08-09"), true, "9 Aug is a Sunday.");
  eq(isSunday("2026-08-08"), false, "8 Aug is a Saturday.");
});

check("all Sundays in the month", () => {
  eq(sundaysInMonth("2026-08-08"), [
    "2026-08-02",
    "2026-08-09",
    "2026-08-16",
    "2026-08-23",
    "2026-08-30",
  ]);
});

check("cheat days are every other Sunday, on a rolling 14-day cadence", () => {
  // Aug 2026 Sundays: 2, 9, 16, 23, 30. Anchor is the 16th.
  eq(isCheatSunday("2026-08-16"), true, "the anchor itself.");
  eq(isCheatSunday("2026-08-09"), false, "the Sunday between two cheats.");
  eq(isCheatSunday("2026-08-02"), true, "14 days before the anchor.");
  eq(isCheatSunday("2026-08-30"), true, "14 days after.");
  eq(isCheatSunday("2026-08-23"), false);
  eq(isCheatSunday("2026-08-15"), false, "a Saturday is never a cheat day.");
});

check("the cadence keeps rolling across month and year boundaries", () => {
  // Straight fortnightly steps from the anchor, ignoring the calendar.
  eq(isCheatSunday("2026-09-13"), true);
  eq(isCheatSunday("2026-09-27"), true);
  eq(isCheatSunday("2026-09-20"), false, "the odd Sunday in between.");
  eq(isCheatSunday("2027-01-03"), true, "20 weeks past the anchor, into next year.");
  eq(isCheatSunday("2026-07-19"), true, "and backwards, before the anchor.");
});

check("a month holds two or three cheat Sundays — never a fixed count", () => {
  // This is the accepted trade-off of a rolling cadence: it doesn't reset
  // on the 1st, so August 2026 gets three.
  eq(cheatSundays("2026-08-08"), ["2026-08-02", "2026-08-16", "2026-08-30"]);
  eq(cheatSundays("2026-09-01"), ["2026-09-13", "2026-09-27"]);
});

check("consecutive cheat Sundays are always exactly 14 days apart", () => {
  let cursor = "2026-08-02";
  for (let i = 0; i < 12; i++) {
    const next = nextCheatSunday(addDays(cursor, 1));
    eq(daysBetween(cursor, next), 14, `step ${i}: ${cursor} -> ${next}`);
    cursor = next;
  }
});

check("next cheat Sunday skips the rest-only Sunday in between", () => {
  eq(nextCheatSunday("2026-08-08"), "2026-08-16", "tomorrow is rest-only, so skip to the 16th.");
  eq(nextCheatSunday("2026-08-16"), "2026-08-16", "on the day itself.");
  eq(nextCheatSunday("2026-08-17"), "2026-08-30");
  eq(nextCheatSunday("2026-08-31"), "2026-09-13", "rolls into next month.");
});

check("cheat plan labels the next one relatively", () => {
  eq(buildCheatPlan("2026-08-15").whenLabel, "Tomorrow");
  eq(buildCheatPlan("2026-08-16").whenLabel, "Today");
  eq(buildCheatPlan("2026-08-08").whenLabel, "in 8 days");
  eq(buildCheatPlan("2026-08-08").slots.length, 3, "August 2026 has three.");
  eq(buildCheatPlan("2026-08-08").slots[2].state, "3rd of 3 this month", "ordinal survives 3.");
});

check("9 Aug 2026 is a rest Sunday but not a cheat Sunday", () => {
  eq(isSunday("2026-08-09"), true, "still a rest day — the streak holds.");
  eq(isCheatSunday("2026-08-09"), false, "but no cheat meal.");
});

/* ---- the streak rule ----------------------------------------------- */

check("a day needs diet AND (swim OR gym)", () => {
  const e = map({
    "2026-08-03": "sgd", // all three
    "2026-08-04": "sd", // swim + diet
    "2026-08-05": "gd", // gym + diet
    "2026-08-06": "d", // diet only — not enough
    "2026-08-07": "sg", // no diet — not enough
  });
  eq(daySatisfied(e, "2026-08-03"), true, "all three.");
  eq(daySatisfied(e, "2026-08-04"), true, "swim+diet.");
  eq(daySatisfied(e, "2026-08-05"), true, "gym+diet.");
  eq(daySatisfied(e, "2026-08-06"), false, "diet alone.");
  eq(daySatisfied(e, "2026-08-07"), false, "activity without diet.");
});

check("every Sunday is a rest day and satisfies itself", () => {
  const e = map({}); // nothing logged at all
  eq(daySatisfied(e, "2026-08-09"), true, "empty Sunday.");
  eq(daySatisfied(e, "2026-08-10"), false, "empty Monday.");
});

check("a missing day breaks the run behind it", () => {
  // The 6th is missing, so the run can only reach back as far as the 7th.
  const e = map({ "2026-08-05": "sgd", "2026-08-07": "sgd" });
  eq(currentStreak(e, "2026-08-08"), { count: 1, pending: true }, "yesterday only.");
  // And once the gap is yesterday too, there is nothing left to count.
  eq(currentStreak(map({ "2026-08-05": "sgd" }), "2026-08-08"), { count: 0, pending: true });
});

/* ---- today is never a break ---------------------------------------- */

check("an unchecked today is pending, not zero", () => {
  const e = map({ "2026-08-05": "sgd", "2026-08-06": "sgd", "2026-08-07": "sgd" });
  const s = currentStreak(e, "2026-08-08");
  eq(s.count, 3, "the three completed days still count.");
  eq(s.pending, true, "and today is flagged as still open.");
});

check("today extends the streak the moment it qualifies", () => {
  const e = map({ "2026-08-07": "sgd", "2026-08-08": "sgd" });
  eq(currentStreak(e, "2026-08-08"), { count: 2, pending: false });
});

check("a half-logged today does not count yet", () => {
  const e = map({ "2026-08-07": "sgd", "2026-08-08": "s" });
  eq(currentStreak(e, "2026-08-08"), { count: 1, pending: true }, "swim without diet.");
});

/* ---- Sundays inside a run ------------------------------------------ */

check("a rest Sunday bridges two active weeks", () => {
  const e = map({
    "2026-08-07": "sgd", // Fri
    "2026-08-08": "sgd", // Sat
    // 9th is Sunday, nothing logged — free
    "2026-08-10": "sgd", // Mon
  });
  eq(currentStreak(e, "2026-08-10").count, 4, "Fri, Sat, free Sunday, Mon.");
});

/* ---- best streak --------------------------------------------------- */

check("best streak is the longest run ever, not the current one", () => {
  const e = map({
    "2026-08-08": "sgd",
    "2026-08-10": "sgd",
    "2026-08-11": "sgd",
    "2026-08-12": "sgd",
    // 13th missed, breaking it
    "2026-08-14": "sgd",
  });
  // 8th + free Sunday 9th + 10th,11th,12th = 5
  eq(bestStreak(e, "2026-08-14", "2026-08-08"), 5);
});

check("an open today can't set a record on its own", () => {
  const e = map({ "2026-08-08": "sgd" });
  eq(bestStreak(e, "2026-08-12", "2026-08-08"), 2, "8th + free Sunday, then it stops.");
});

/* ---- week strip ---------------------------------------------------- */

check("week strip is Mon–Sun and marks the future", () => {
  const w = streakWeek(map({ "2026-08-03": "sgd" }), "2026-08-05");
  eq(w.length, 7);
  eq(w[0].date, "2026-08-03", "Monday first.");
  eq(w[6].date, "2026-08-09", "Sunday last.");
  eq(w[0].done, true);
  eq(w[1].done, false, "Tuesday empty.");
  eq(w[5].future, true, "Saturday is ahead of Wednesday.");
  eq(w[6].done, false, "a future Sunday is not yet 'done'.");
});

/* ---- monthly targets ------------------------------------------------ */

check("month targets count only this month, only up to today", () => {
  const e = map({
    "2026-07-30": "sgd", // last month
    "2026-08-02": "sgd",
    "2026-08-03": "sg",
    "2026-08-20": "sgd", // future
  });
  const t = buildMonthTargets(e, "2026-08-08", SETTINGS);
  eq(t[0].done, 2, "swim: 2 and 3 Aug.");
  eq(t[1].done, 2, "gym: 2 and 3 Aug.");
  eq(t[2].done, 1, "diet: 2 Aug only.");
  eq(t[1].target, 20, "5/week x 4 weeks in August.");
});

check("month targets warn when the maths stops working", () => {
  const t = buildMonthTargets(map({}), "2026-08-30", SETTINGS);
  // 2 days left, 16 swims needed.
  eq(t[0].note.includes("out of reach"), true, t[0].note);
});

check("a met target says so instead of showing a pace", () => {
  // Swim target for August is 4/week x 4 weeks = 16.
  const e: EntryMap = {};
  for (let d = 1; d <= 16; d++) {
    const k = `2026-08-${String(d).padStart(2, "0")}`;
    e[k] = entry(k, "s");
  }
  eq(buildMonthTargets(e, "2026-08-20", SETTINGS)[0].note, "Target met for the month");
});

/* ---- the weight plan ------------------------------------------------ */

check("weight plan back-calculates a sane weekly pace", () => {
  const w = buildWeightPlan(map({}), "2026-08-08", SETTINGS);
  eq(w.currentKg, 88, "no weight logged yet — falls back to the start weight.");
  eq(w.toGoKg, 10);
  eq(w.daysToGoal, 146);
  eq(w.perWeekNeeded, 0.48, "10 kg over 146 days.");
});

check("checkpoints land on month ends and finish exactly on goal", () => {
  const w = buildWeightPlan(map({}), "2026-08-08", SETTINGS);
  eq(w.checkpoints[0], { month: "Aug", date: "2026-08-31", targetKg: 86.4 });
  eq(w.checkpoints[1].targetKg, 84.4, "end of Sept.");
  const last = w.checkpoints[w.checkpoints.length - 1];
  eq(last.date, "2027-01-01");
  eq(last.targetKg, 78, "the line arrives exactly on the goal.");
});

check("the pace rises if you fall behind", () => {
  const e = map({ "2026-11-01": "" });
  e["2026-11-01"].weightKg = 86;
  const w = buildWeightPlan(e, "2026-11-01", SETTINGS);
  eq(w.currentKg, 86);
  eq(w.lostKg, 2);
  eq(w.perWeekNeeded > 0.48, true, `8 kg in 61 days should exceed the original pace, got ${w.perWeekNeeded}`);
});

check("weight progress is clamped and survives a gain", () => {
  const e = map({ "2026-08-08": "" });
  e["2026-08-08"].weightKg = 90; // heavier than the start
  const w = buildWeightPlan(e, "2026-08-08", SETTINGS);
  eq(w.lostKg, -2);
  eq(w.pct, 0, "never negative.");
  eq(w.toGoKg, 12);
});

/* ---- calendar heat and perfect days --------------------------------- */

check("heat level counts the three habits", () => {
  const e = map({ "2026-08-01": "", "2026-08-02": "s", "2026-08-03": "sg", "2026-08-04": "sgd" });
  eq(heatLevel(e, "2026-08-01"), 0);
  eq(heatLevel(e, "2026-08-02"), 1);
  eq(heatLevel(e, "2026-08-03"), 2);
  eq(heatLevel(e, "2026-08-04"), 3);
  eq(heatLevel(e, "2026-08-05"), 0, "a day with no row at all.");
});

check("a perfect run needs all three every day — Sundays included", () => {
  const e: EntryMap = {};
  for (let d = 1; d <= 7; d++) {
    const k = `2026-08-${String(d).padStart(2, "0")}`;
    e[k] = entry(k, "sgd");
  }
  eq(longestPerfectRun(e, "2026-08-07", "2026-08-01"), 7, "Sundays don't come free here.");
  e["2026-08-04"] = entry("2026-08-04", "sg");
  eq(longestPerfectRun(e, "2026-08-07", "2026-08-01"), 3, "broken on the 4th.");
});

/* ---- year boundary --------------------------------------------------- */

check("a streak survives Dec into Jan", () => {
  const e = map({
    "2026-12-30": "sgd",
    "2026-12-31": "sgd",
    "2027-01-01": "sgd",
  });
  eq(currentStreak(e, "2027-01-01").count, 3);
});

/* ---- rewards --------------------------------------------------------- */

const REWARD_SEEDS = [
  { id: "r2", kgLost: 2, label: "New swimsuit", claimedAt: null },
  { id: "r4", kgLost: 4, label: "Full body massage", claimedAt: null },
  { id: "r6", kgLost: 6, label: "Day trip somewhere new", claimedAt: null },
  { id: "r8", kgLost: 8, label: "New outfit in the new size", claimedAt: null },
  { id: "r10", kgLost: 10, label: "Weekend getaway", claimedAt: null },
];

/** A weight plan with `lostKg` forced, so reward tests don't depend on dates. */
function planAt(lostKg: number) {
  const w = buildWeightPlan(map({}), "2026-08-08", SETTINGS);
  return { ...w, lostKg, pct: lostKg / (w.startKg - w.goalKg) };
}

check("no rewards earned at the starting weight", () => {
  const r = buildRewards(REWARD_SEEDS, planAt(0));
  eq(r.earnedCount, 0);
  eq(r.next?.label, "New swimsuit");
  eq(r.toNextKg, 2);
});

check("rewards unlock as the kilos come off", () => {
  eq(buildRewards(REWARD_SEEDS, planAt(2)).earnedCount, 1);
  eq(buildRewards(REWARD_SEEDS, planAt(5)).earnedCount, 2, "5 kg clears 2 and 4, not 6.");
  eq(buildRewards(REWARD_SEEDS, planAt(10)).earnedCount, 5);
});

check("the next reward is the first one not yet earned", () => {
  const r = buildRewards(REWARD_SEEDS, planAt(5));
  eq(r.next?.kgLost, 6);
  eq(r.toNextKg, 1, "1 kg from 5 to 6.");
});

check("once everything is unlocked there is no next", () => {
  const r = buildRewards(REWARD_SEEDS, planAt(10));
  eq(r.next, null);
  eq(r.toNextKg, 0);
});

check("a hair under the threshold still counts — scales aren't that precise", () => {
  eq(buildRewards(REWARD_SEEDS, planAt(1.96)).earnedCount, 1, "1.96 kg clears the 2 kg mark.");
  eq(buildRewards(REWARD_SEEDS, planAt(1.9)).earnedCount, 0, "1.9 kg does not.");
});

check("dots sit proportionally along the whole journey", () => {
  const r = buildRewards(REWARD_SEEDS, planAt(0));
  // 88 -> 78 is a 10 kg span, so 2 kg is a fifth of the way along.
  eq(r.rewards[0].pos, 0.2);
  eq(r.rewards[2].pos, 0.6);
  eq(r.rewards[4].pos, 1);
});

check("each reward knows the weight it is waiting at", () => {
  const r = buildRewards(REWARD_SEEDS, planAt(0));
  eq(r.rewards[0].atKg, 86, "2 kg down from 88.");
  eq(r.rewards[4].atKg, 78, "the last one is the goal itself.");
});

check("claimed is stored, earned is derived — they are not the same thing", () => {
  const seeds = [
    { id: "r2", kgLost: 2, label: "New swimsuit", claimedAt: new Date("2026-08-01") },
    { id: "r4", kgLost: 4, label: "Full body massage", claimedAt: null },
  ];
  const r = buildRewards(seeds, planAt(5));
  eq(r.earnedCount, 2, "both earned.");
  eq(r.rewards[0].claimed, true);
  eq(r.rewards[1].claimed, false);
  eq(r.unclaimed, 1, "earned but not collected.");
});

check("rewards come back in order however they were stored", () => {
  const shuffled = [REWARD_SEEDS[3], REWARD_SEEDS[0], REWARD_SEEDS[4], REWARD_SEEDS[1]];
  const r = buildRewards(shuffled, planAt(0));
  eq(
    r.rewards.map((x) => x.kgLost),
    [2, 4, 8, 10],
  );
});

check("no rewards configured is not a crash", () => {
  const r = buildRewards([], planAt(3));
  eq(r.rewards.length, 0);
  eq(r.next, null);
  eq(r.earnedCount, 0);
});

/* ---- partner confirmation ------------------------------------------- */

check("an unconfirmed day does not count toward the streak", () => {
  // 5 Aug 2026 is a Wednesday. "sgd!" = everything claimed, nothing confirmed.
  const e = map({ "2026-08-05": "sgd!" });
  eq(daySatisfied(e, "2026-08-05"), false, "claimed but never ticked.");
  const ok = map({ "2026-08-05": "sgd" });
  eq(daySatisfied(ok, "2026-08-05"), true, "same day, confirmed.");
});

check("confirmation is per-half — move and diet are independent", () => {
  const e = map({ "2026-08-05": "sgd" });
  // Confirm the move but not the diet.
  e["2026-08-05"].dietConfirmedAt = null;
  eq(daySatisfied(e, "2026-08-05"), false, "diet still outstanding.");
  e["2026-08-05"].dietConfirmedAt = "2026-08-05T10:00:00.000Z";
  e["2026-08-05"].moveConfirmedAt = null;
  eq(daySatisfied(e, "2026-08-05"), false, "move still outstanding.");
});

check("Sundays satisfy the streak with no confirmation at all", () => {
  const e = map({ "2026-08-09": "" }); // 9 Aug 2026 is a Sunday
  eq(daySatisfied(e, "2026-08-09"), true, "rest days are free, always.");
  eq(daySatisfied({}, "2026-08-16"), true, "even with no row at all.");
});

check("an unconfirmed claim expires once the 24h window closes", () => {
  const e = map({ "2026-08-05": "sgd!" });
  eq(dayExpired(e, "2026-08-05", "2026-08-05"), false, "same day — still open.");
  eq(dayExpired(e, "2026-08-05", "2026-08-06"), false, "next day — still open.");
  eq(dayExpired(e, "2026-08-05", "2026-08-07"), true, "window closed, claim gone.");
});

check("a confirmed day never expires", () => {
  const e = map({ "2026-08-05": "sgd" });
  eq(dayExpired(e, "2026-08-05", "2026-08-30"), false);
});

check("a day with nothing claimed has nothing to expire", () => {
  eq(dayExpired(map({}), "2026-08-05", "2026-08-30"), false, "no row.");
  eq(dayExpired(map({ "2026-08-05": "" }), "2026-08-05", "2026-08-30"), false, "empty row.");
});

check("month targets ignore unconfirmed sessions", () => {
  const e = map({ "2026-08-03": "sgd", "2026-08-04": "sgd!" });
  const t = buildMonthTargets(e, "2026-08-08", SETTINGS);
  eq(t[0].done, 1, "only the confirmed swim counts.");
  eq(t[2].done, 1, "only the confirmed diet counts.");
});

check("calendar heat only shows confirmed habits", () => {
  const e = map({ "2026-08-04": "sgd!" });
  eq(heatLevel(e, "2026-08-04"), 0, "claimed but unconfirmed reads as an empty day.");
});

check("confirm rows run Monday to Sunday for the current week", () => {
  // 8 Aug 2026 is a Saturday; its Monday is the 3rd.
  const rows = buildConfirmRows(map({}), "2026-08-08");
  eq(rows.length, 7);
  eq(rows[0].date, "2026-08-03");
  eq(rows[6].date, "2026-08-09");
  eq(rows[6].isSunday, true);
  eq(rows[5].isToday, true, "Saturday is today.");
  eq(rows[6].future, true, "Sunday hasn't happened yet.");
});

check("confirm rows report what was claimed and what's still open", () => {
  const e = map({ "2026-08-07": "gd!" }); // Friday: gym + diet, unconfirmed
  const rows = buildConfirmRows(e, "2026-08-08");
  const fri = rows[4];
  eq(fri.date, "2026-08-07");
  eq(fri.movedLogged, true);
  eq(fri.moveKinds, ["gym"]);
  eq(fri.moveConfirmed, false);
  eq(fri.dietLogged, true);
  eq(fri.dietConfirmed, false);
  eq(fri.confirmable, true, "yesterday — window still open.");
  eq(fri.expired, false);
});

check("a row past its window reports as expired, not confirmable", () => {
  const e = map({ "2026-08-03": "sd!" }); // Monday, unconfirmed
  const rows = buildConfirmRows(e, "2026-08-08");
  eq(rows[0].confirmable, false);
  eq(rows[0].expired, true);
});

/* ---- report ---------------------------------------------------------- */

if (failures.length > 0) {
  console.error(`\n${failures.length} failed, ${passed} passed:\n`);
  for (const f of failures) console.error(`  ✗ ${f}\n`);
  process.exit(1);
}
console.log(`✓ all ${passed} tests passed`);
