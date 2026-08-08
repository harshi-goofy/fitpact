/**
 * Checks on the rules that are easy to get subtly wrong.
 * Run with: npx tsx src/lib/stats.test.ts
 */

import assert from "node:assert";
import { computeStats, gymQuota, streak, tokens } from "./stats";
import { addDays, isEditable, monthRange, weekStart } from "./timezone";
import { EMPTY_ENTRY, type Entry } from "./types";

const TODAY = "2026-08-08"; // a Saturday

function entry(date: string, patch: Partial<Entry>): Entry {
  return { ...EMPTY_ENTRY(date), ...patch };
}

function map(...es: Entry[]): Record<string, Entry> {
  return Object.fromEntries(es.map((e) => [e.date, e]));
}

const SETTINGS = {
  weeklyGymTarget: 5,
  weeklySwimTarget: 7,
  monthlyRestTokens: 4,
  monthlyCheatTokens: 4,
};

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.error(`  ✗ ${name}\n    ${e instanceof Error ? e.message : e}`);
    process.exitCode = 1;
  }
}

console.log("\nstreaks");

test("an unchecked today is pending, not a break", () => {
  const entries = map(
    entry(addDays(TODAY, -1), { gymDone: true }),
    entry(addDays(TODAY, -2), { walkDone: true }),
  );
  const s = streak("movement", entries, TODAY);
  assert.equal(s.count, 2, "should count through yesterday");
  assert.equal(s.pending, true, "today is undecided, not zero");
});

test("today counts once it is satisfied", () => {
  const entries = map(
    entry(TODAY, { runDone: true }),
    entry(addDays(TODAY, -1), { gymDone: true }),
  );
  const s = streak("movement", entries, TODAY);
  assert.equal(s.count, 2);
  assert.equal(s.pending, false);
});

test("a missed yesterday breaks the streak to 0", () => {
  const entries = map(entry(addDays(TODAY, -2), { gymDone: true }));
  assert.equal(streak("movement", entries, TODAY).count, 0);
});

test("streaks are independent — a swim miss leaves movement alone", () => {
  const entries = map(
    entry(addDays(TODAY, -1), { gymDone: true, swimDone: false }),
    entry(addDays(TODAY, -2), { gymDone: true, swimDone: true }),
  );
  assert.equal(streak("movement", entries, TODAY).count, 2);
  assert.equal(streak("swim", entries, TODAY).count, 0);
});

test("a rest day preserves both movement and swim, but not diet", () => {
  const entries = map(entry(addDays(TODAY, -1), { isRestDay: true }));
  assert.equal(streak("movement", entries, TODAY).count, 1);
  assert.equal(streak("swim", entries, TODAY).count, 1);
  assert.equal(streak("diet", entries, TODAY).count, 0, "you still eat on a rest day");
});

test("a cheat day preserves diet only", () => {
  const entries = map(entry(addDays(TODAY, -1), { isCheatDay: true }));
  assert.equal(streak("diet", entries, TODAY).count, 1);
  assert.equal(streak("movement", entries, TODAY).count, 0);
});

test("swimming does not satisfy movement, and vice versa", () => {
  const swimOnly = map(entry(addDays(TODAY, -1), { swimDone: true }));
  assert.equal(streak("movement", swimOnly, TODAY).count, 0);
  const gymOnly = map(entry(addDays(TODAY, -1), { gymDone: true }));
  assert.equal(streak("swim", gymOnly, TODAY).count, 0);
});

console.log("\nweekly gym quota");

test("walks and runs do not count toward the gym quota", () => {
  const monday = weekStart(TODAY);
  const entries = map(
    entry(monday, { gymDone: true }),
    entry(addDays(monday, 1), { walkDone: true }),
    entry(addDays(monday, 2), { runDone: true }),
  );
  assert.equal(gymQuota(entries, TODAY, 5).done, 1);
});

test("a rest day does not count toward the gym quota", () => {
  const monday = weekStart(TODAY);
  const entries = map(entry(monday, { isRestDay: true }));
  assert.equal(gymQuota(entries, TODAY, 5).done, 0);
});

test("noSlack fires when gym days needed >= days left", () => {
  // Saturday: Sat + Sun remain. 3 done, 5 needed -> 2 needed, 2 left.
  const monday = weekStart(TODAY);
  const entries = map(
    entry(monday, { gymDone: true }),
    entry(addDays(monday, 1), { gymDone: true }),
    entry(addDays(monday, 2), { gymDone: true }),
  );
  const q = gymQuota(entries, TODAY, 5);
  assert.equal(q.daysRemaining, 2);
  assert.equal(q.noSlack, true);
});

test("noSlack is off when the week still has slack", () => {
  const monday = weekStart(TODAY);
  const entries = map(
    entry(monday, { gymDone: true }),
    entry(addDays(monday, 1), { gymDone: true }),
    entry(addDays(monday, 2), { gymDone: true }),
    entry(addDays(monday, 3), { gymDone: true }),
  );
  assert.equal(gymQuota(entries, TODAY, 5).noSlack, false);
});

test("a met week never shows noSlack", () => {
  const monday = weekStart(TODAY);
  const entries = map(
    ...Array.from({ length: 5 }, (_, i) => entry(addDays(monday, i), { gymDone: true })),
  );
  const q = gymQuota(entries, TODAY, 5);
  assert.equal(q.met, true);
  assert.equal(q.noSlack, false);
});

console.log("\ntokens");

test("tokens are derived from entries and scoped to the month", () => {
  const entries = map(
    entry("2026-08-02", { isRestDay: true }),
    entry("2026-08-03", { isRestDay: true }),
    entry("2026-07-31", { isRestDay: true }), // last month, must not count
  );
  const t = tokens(entries, TODAY, 4, "isRestDay");
  assert.equal(t.used, 2);
  assert.equal(t.left, 2);
});

test("token count never goes negative", () => {
  const entries = map(
    ...Array.from({ length: 6 }, (_, i) =>
      entry(`2026-08-${String(i + 1).padStart(2, "0")}`, { isCheatDay: true }),
    ),
  );
  assert.equal(tokens(entries, TODAY, 4, "isCheatDay").left, 0);
});

test("month range rolls over December correctly", () => {
  assert.deepEqual(monthRange("2026-12-15"), { start: "2026-12-01", end: "2027-01-01" });
  assert.deepEqual(monthRange("2026-08-08"), { start: "2026-08-01", end: "2026-09-01" });
});

console.log("\nedit window");

test("today and yesterday are editable, older days are not", () => {
  assert.equal(isEditable(TODAY, TODAY), true);
  assert.equal(isEditable(addDays(TODAY, -1), TODAY), true);
  assert.equal(isEditable(addDays(TODAY, -2), TODAY), false);
});

test("weeks run Monday to Sunday", () => {
  assert.equal(weekStart("2026-08-08"), "2026-08-03"); // Sat -> Mon
  assert.equal(weekStart("2026-08-09"), "2026-08-03"); // Sun -> same Mon
  assert.equal(weekStart("2026-08-10"), "2026-08-10"); // Mon -> itself
});

console.log("\nintegration");

test("computeStats returns all three streaks plus quotas", () => {
  const entries = map(entry(addDays(TODAY, -1), { gymDone: true, swimDone: true, dietDone: true }));
  const s = computeStats(entries, TODAY, SETTINGS);
  assert.equal(s.streaks.movement.count, 1);
  assert.equal(s.streaks.swim.count, 1);
  assert.equal(s.streaks.diet.count, 1);
  assert.equal(s.rest.left, 4);
  assert.equal(s.today, TODAY);
});

console.log(`\n${passed} passed\n`);
