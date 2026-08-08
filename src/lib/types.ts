import type { DateKey } from "./timezone";

/** A logged day. Three booleans plus the optional extras. */
export type Entry = {
  date: DateKey;
  swimDone: boolean;
  gymDone: boolean;
  dietDone: boolean;
  note: string | null;
  weightKg: number | null;
  hasPhoto: boolean;
};

export type HabitKey = "swim" | "gym" | "diet";

/** A streak that hasn't been decided yet, because the evening hasn't happened. */
export type Streak = {
  count: number;
  best: number;
  /** True when today is still open — render as pending, never as a break. */
  pending: boolean;
  /** Mon..Sun bars for the hero card. */
  week: { label: string; date: DateKey; done: boolean; future: boolean }[];
};

export type MonthTarget = {
  key: HabitKey;
  label: string;
  done: number;
  target: number;
  /** 0–1, clamped. */
  pct: number;
  note: string;
};

export type WeightPlan = {
  startKg: number;
  goalKg: number;
  currentKg: number;
  goalDate: DateKey;
  /** kg shed so far (can be negative if you have gained). */
  lostKg: number;
  toGoKg: number;
  /** 0–1, clamped. */
  pct: number;
  /** kg/week needed from today to hit the goal on time. */
  perWeekNeeded: number;
  daysToGoal: number;
  /** Where the plan says you should be at the end of each month. */
  checkpoints: { month: string; date: DateKey; targetKg: number }[];
  /** The checkpoint for the current month, surfaced on the card. */
  nextCheckpoint: { month: string; date: DateKey; targetKg: number } | null;
};

export type CheatPlan = {
  /** Both cheat Sundays in the current month. */
  slots: { date: DateKey; label: string; state: string; past: boolean }[];
  next: DateKey;
  nextLabel: string;
  /** "Today", "Tomorrow", "in 5 days". */
  whenLabel: string;
};

export type Badge = {
  id: string;
  name: string;
  description: string;
  habit: HabitKey | "streak" | "weight";
  letter: string;
  earned: boolean;
};

export type BoardStats = {
  today: DateKey;
  streak: Streak;
  monthTargets: MonthTarget[];
  daysLeftInMonth: number;
  monthLabel: string;
  weight: WeightPlan;
  cheat: CheatPlan;
  isRestToday: boolean;
  totals: { swim: number; gym: number; diet: number; sessions: number };
  badges: Badge[];
  badgesEarned: number;
};

export type CommentDTO = {
  id: string;
  date: DateKey;
  authorId: string;
  authorName: string;
  authorRole: "TRACKER" | "PARTNER";
  body: string;
  cheer: boolean;
  createdAt: string;
  seen: boolean;
};

export type BoardPayload = {
  today: DateKey;
  days: DateKey[];
  entries: Record<DateKey, Entry>;
  stats: BoardStats;
  settings: {
    timezone: string;
    monthlySwimTarget: number;
    monthlyGymTarget: number;
    monthlyDietTarget: number;
    startWeightKg: number;
    goalWeightKg: number;
    goalDate: DateKey;
    whyNote: string | null;
  };
  tracker: { id: string; name: string };
  partner: { id: string; name: string } | null;
  comments: CommentDTO[];
  unseen: number;
};

export const EMPTY_ENTRY = (date: DateKey): Entry => ({
  date,
  swimDone: false,
  gymDone: false,
  dietDone: false,
  note: null,
  weightKg: null,
  hasPhoto: false,
});
