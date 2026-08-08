import type { DateKey } from "./timezone";

/** A logged day. Three booleans plus the optional extras. */
export type Entry = {
  date: DateKey;
  swimDone: boolean;
  gymDone: boolean;
  dietDone: boolean;
  /** ISO timestamps, set when the partner confirms. null = still provisional. */
  moveConfirmedAt: string | null;
  dietConfirmedAt: string | null;
  note: string | null;
  weightKg: number | null;
  hasPhoto: boolean;
};

/** One Mon–Sun row on the Together screen. */
export type ConfirmRow = {
  date: DateKey;
  label: string;
  dayLetter: string;
  /** What the tracker claims for this day. */
  movedLogged: boolean;
  dietLogged: boolean;
  /** Which of swim/gym were claimed — shown so the partner knows what they're confirming. */
  moveKinds: HabitKey[];
  moveConfirmed: boolean;
  dietConfirmed: boolean;
  /** Still inside the 24h window, so the partner can act. */
  confirmable: boolean;
  /** Window closed with something unconfirmed — that claim is gone. */
  expired: boolean;
  future: boolean;
  isToday: boolean;
  isSunday: boolean;
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

export type WeightWeek = {
  weekNum: number;
  weekStart: DateKey;
  weekEnd: DateKey;
  /** What the plan says you should weigh by end of this week. */
  targetKg: number;
  /** Most recent weight logged within this week, or null. */
  loggedKg: number | null;
  past: boolean;
  current: boolean;
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
  /** Target weight at end of current month. */
  monthlyTargetKg: number;
  /** Per-week breakdown for the current month. */
  weeklyLogs: WeightWeek[];
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
  /** Mon–Sun rows powering the Together screen. */
  confirmRows: ConfirmRow[];
  /** How many boxes are waiting on the partner right now. */
  awaitingConfirm: number;
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
  /** Who is holding the phone. Drives what the UI lets them do. */
  me: { id: string; name: string; role: "TRACKER" | "PARTNER" } | null;
};

export const EMPTY_ENTRY = (date: DateKey): Entry => ({
  date,
  swimDone: false,
  gymDone: false,
  dietDone: false,
  moveConfirmedAt: null,
  dietConfirmedAt: null,
  note: null,
  weightKg: null,
  hasPhoto: false,
});
