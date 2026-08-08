import type { DateKey } from "./timezone";

/** The seven booleans plus the optional fields, keyed by day. */
export type Entry = {
  date: DateKey;
  gymDone: boolean;
  walkDone: boolean;
  runDone: boolean;
  swimDone: boolean;
  dietDone: boolean;
  isRestDay: boolean;
  isCheatDay: boolean;
  note: string | null;
  weightKg: number | null;
  hasPhoto: boolean;
};

export type HabitKey = "movement" | "swim" | "diet";

/** A streak that hasn't been decided yet, because the evening hasn't happened. */
export type StreakState = {
  count: number;
  /** True when today is unchecked — render as pending, not as a break. */
  pending: boolean;
};

export type WeekQuota = {
  done: number;
  target: number;
  /** Days left in the Mon–Sun week, including today. */
  daysRemaining: number;
  met: boolean;
  /** More still needed than days left to do them in. */
  noSlack: boolean;
};

export type Tokens = {
  used: number;
  total: number;
  left: number;
};

export type BoardStats = {
  today: DateKey;
  streaks: Record<HabitKey, StreakState>;
  gymWeek: WeekQuota;
  swimWeek: WeekQuota;
  metWeekStreak: number;
  rest: Tokens;
  cheat: Tokens;
};

export type BoardPayload = {
  today: DateKey;
  days: DateKey[];
  entries: Record<DateKey, Entry>;
  stats: BoardStats;
  settings: {
    timezone: string;
    weeklyGymTarget: number;
    weeklySwimTarget: number;
    monthlyRestTokens: number;
    monthlyCheatTokens: number;
    whyNote: string | null;
  };
  tracker: { id: string; name: string };
};

export const EMPTY_ENTRY = (date: DateKey): Entry => ({
  date,
  gymDone: false,
  walkDone: false,
  runDone: false,
  swimDone: false,
  dietDone: false,
  isRestDay: false,
  isCheatDay: false,
  note: null,
  weightKg: null,
  hasPhoto: false,
});
