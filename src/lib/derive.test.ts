/**
 * Unit tests for the view-state helpers. Run: npx tsx src/lib/derive.test.ts
 *
 * Same dependency-free style as stats.test.ts — prints a count or exits 1.
 */

import {
  activeDaysInMonth,
  awaitingLabel,
  awaitingToday,
  badgeProgress,
  calendarStats,
  cheatUsage,
  claimDeadline,
  formatCountdown,
  nextStep,
} from "./derive";
import type { Entry } from "./types";

let passed = 0;
const failures: string[] = [];

function check(name: string, fn: () => void) {
  try {
    fn();
    passed++;
  } catch (err) {
    failures.push(`${name}\n    ${err instanceof Error ? err.message : String(err)}`);
  }
}

function eq<T>(actual: T, expected: T, msg = "") {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${msg}expected ${b}, got ${a}`);
}

/** An entry with the flags you name and sensible defaults for the rest. */
function entry(p: Partial<Entry> = {}): Entry {
  return {
    date: "2026-08-10",
    swimDone: false,
    gymDone: false,
    dietDone: false,
    moveConfirmedAt: null,
    dietConfirmedAt: null,
    note: null,
    weightKg: null,
    hasPhoto: false,
    ...p,
  };
}

const ISO = "2026-08-10T10:00:00.000Z";

/* ---- nextStep -------------------------------------------------------- */

check("nothing logged asks for all three", () => {
  const n = nextStep(entry(), 0);
  eq(n.action, "Log all three");
  eq(n.urgent, true);
});

check("swim logged still wants diet, and does not ask for gym", () => {
  // Swim satisfies the move, so Gym must not appear — that is the whole point
  // of move being one slot with two ways to fill it.
  const n = nextStep(entry({ swimDone: true }), 0);
  eq(n.action, "Log Diet");
  eq(n.note.startsWith("1 box"), true);
});

check("diet only still wants a move", () => {
  eq(nextStep(entry({ dietDone: true }), 0).action, "Log Move");
});

check("all claimed but unconfirmed chases the partner", () => {
  const n = nextStep(entry({ gymDone: true, dietDone: true }), 4);
  eq(n.action, "Chase Manoj");
  eq(n.urgent, false);
});

check("fully confirmed banks the day and names the streak", () => {
  const n = nextStep(
    entry({ gymDone: true, dietDone: true, moveConfirmedAt: ISO, dietConfirmedAt: ISO }),
    7,
  );
  eq(n.action, "Day closed");
  eq(n.note, "All three confirmed. Day 7 is banked.");
});

check("an untouched Sunday reads as a rest day, not a failure", () => {
  eq(nextStep(entry(), 5, true).action, "Rest day");
});

check("a Sunday with something logged behaves like a normal day", () => {
  eq(nextStep(entry({ swimDone: true, dietDone: true }), 5, true).action, "Chase Manoj");
});

/* ---- awaiting -------------------------------------------------------- */

check("awaitingToday counts move and diet separately", () => {
  eq(awaitingToday(entry({ swimDone: true, dietDone: true })), 2);
});

check("swim and gym together are still one move claim", () => {
  eq(awaitingToday(entry({ swimDone: true, gymDone: true })), 1);
});

check("a confirmed box is no longer awaiting", () => {
  eq(awaitingToday(entry({ swimDone: true, moveConfirmedAt: ISO })), 0);
});

check("a single pending claim is named in the countdown row", () => {
  eq(awaitingLabel(entry({ swimDone: true })), "Swim claim expires in");
  eq(awaitingLabel(entry({ dietDone: true })), "Diet claim expires in");
});

check("two pending claims are counted, not named", () => {
  eq(awaitingLabel(entry({ gymDone: true, dietDone: true })), "2 claims expire in");
});

/* ---- countdown ------------------------------------------------------- */

check("the deadline is the end of the day after today", () => {
  eq(claimDeadline("2026-08-10").toISOString(), "2026-08-12T00:00:00.000Z");
});

check("countdown shows days out past 24h", () => {
  eq(formatCountdown((37 * 3600 + 42 * 60) * 1000), "1d 13h 42m");
});

check("countdown drops days inside 24h", () => {
  eq(formatCountdown((5 * 3600 + 3 * 60) * 1000), "5h 3m");
});

check("countdown shows seconds only in the last hour", () => {
  eq(formatCountdown((12 * 60 + 40) * 1000), "12m 40s");
});

check("a passed deadline clamps to zero rather than counting up", () => {
  eq(formatCountdown(-500_000), "0m 0s");
});

/* ---- cheat ----------------------------------------------------------- */

check("cheat usage counts the Sundays already gone", () => {
  const plan = {
    slots: [
      { date: "2026-08-02", label: "", state: "", past: true },
      { date: "2026-08-16", label: "", state: "", past: false },
      { date: "2026-08-30", label: "", state: "", past: false },
    ],
    next: "2026-08-16",
    nextLabel: "",
    whenLabel: "",
  };
  eq(cheatUsage(plan).label, "1 of 3 used");
});

/* ---- calendar -------------------------------------------------------- */

check("calendar percentages divide by days elapsed, not days in the month", () => {
  // 10 August: one confirmed swim day out of ten elapsed = 10%.
  const entries = {
    "2026-08-08": entry({ date: "2026-08-08", swimDone: true, moveConfirmedAt: ISO }),
  };
  const [swim] = calendarStats(entries, "2026-08-10");
  eq(swim.value, "10%");
});

check("unconfirmed days do not appear in the calendar summary", () => {
  const entries = { "2026-08-08": entry({ date: "2026-08-08", swimDone: true }) };
  eq(calendarStats(entries, "2026-08-10")[0].value, "0%");
});

check("gym reads as a count and singularises", () => {
  const entries = { "2026-08-08": entry({ date: "2026-08-08", gymDone: true, moveConfirmedAt: ISO }) };
  const [, gym] = calendarStats(entries, "2026-08-10");
  eq(gym.value, "1");
  eq(gym.label, "Gym session");
});

check("last month's entries are ignored", () => {
  const entries = {
    "2026-07-30": entry({ date: "2026-07-30", swimDone: true, moveConfirmedAt: ISO }),
  };
  eq(calendarStats(entries, "2026-08-10")[0].value, "0%");
});

check("active days counts a day once however much is on it", () => {
  const entries = {
    "2026-08-08": entry({
      date: "2026-08-08",
      swimDone: true,
      dietDone: true,
      moveConfirmedAt: ISO,
      dietConfirmedAt: ISO,
    }),
    "2026-08-09": entry({ date: "2026-08-09", gymDone: true, moveConfirmedAt: ISO }),
  };
  eq(activeDaysInMonth(entries, "2026-08-10"), 2);
});

/* ---- badges ---------------------------------------------------------- */

const badgeStats = {
  streak: { count: 3, best: 5, pending: true, week: [] },
  totals: { swim: 2, gym: 1, diet: 4, sessions: 7 },
};

check("streak badges report against the best run, not the current one", () => {
  eq(badgeProgress("streak_7", badgeStats), "5/7");
});

check("session badges report against lifetime totals", () => {
  eq(badgeProgress("swim_25", badgeStats), "2/25");
});

check("progress never exceeds the target", () => {
  eq(badgeProgress("gym_1", badgeStats), "1/1");
});

check("badges that aren't a countable run get no progress label", () => {
  eq(badgeProgress("weight_half", badgeStats), null);
  eq(badgeProgress("perfect_7", badgeStats), null);
});

/* ---- report ---------------------------------------------------------- */

if (failures.length > 0) {
  console.error(`\n${failures.length} failed, ${passed} passed:\n`);
  for (const f of failures) console.error(`  ✗ ${f}\n`);
  process.exit(1);
}
console.log(`✓ all ${passed} derive tests passed`);
