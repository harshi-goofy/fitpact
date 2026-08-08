"use client";

import { useEffect, useState } from "react";
import { formatDayLabel } from "@/lib/timezone";
import type { BoardStats, Entry } from "@/lib/types";

type Props = {
  date: string;
  entry: Entry;
  stats: BoardStats;
  editable: boolean;
  onPatch: (date: string, patch: Record<string, unknown>) => void | Promise<void>;
};

/*
 * Tailwind can't see class names built at runtime, so every colour variant is
 * written out literally here rather than interpolated from the habit key.
 */
const GROUP_STYLES = {
  movement: {
    border: "border-movement/30",
    label: "text-movement",
    on: "bg-movement text-ink border-movement",
  },
  swim: {
    border: "border-swim/30",
    label: "text-swim",
    on: "bg-swim text-ink border-swim",
  },
  diet: {
    border: "border-diet/30",
    label: "text-diet",
    on: "bg-diet text-ink border-diet",
  },
} as const;

type HabitKey = keyof typeof GROUP_STYLES;

function Toggle({
  label,
  on,
  habit,
  disabled,
  onClick,
}: {
  label: string;
  on: boolean;
  habit: HabitKey;
  disabled?: boolean;
  onClick: () => void;
}) {
  const s = GROUP_STYLES[habit];
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={disabled}
      onClick={onClick}
      // 56px minimum: this gets tapped with a thumb, one-handed, in the dark.
      className={[
        "min-h-14 flex-1 rounded-xl border text-sm font-semibold transition-colors",
        "active:scale-[0.98] disabled:opacity-40",
        on ? s.on : "border-line bg-surface-2 text-text",
      ].join(" ")}
    >
      {label}
      {on ? " ✓" : ""}
    </button>
  );
}

/** A bounded group makes the rule structure visible: these are alternatives. */
function Group({
  title,
  habit,
  streak,
  pending,
  children,
  footer,
}: {
  title: string;
  habit: HabitKey;
  streak: number;
  pending: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const s = GROUP_STYLES[habit];
  return (
    <section className={`rounded-2xl border ${s.border} bg-surface p-3`}>
      <div className="mb-2 flex items-baseline justify-between px-1">
        <h2 className={`text-[11px] font-semibold uppercase tracking-wider ${s.label}`}>
          {title}
        </h2>
        <span className="text-xs text-muted">
          <span className={`text-base font-bold ${s.label}`}>{streak}</span>{" "}
          {streak === 1 ? "day" : "days"}
          {/* Today is undecided until the evening happens — say so rather than
              letting the number look like a settled fact. */}
          {pending && <span className="ml-1 opacity-60">· today pending</span>}
        </span>
      </div>
      <div className="flex gap-2">{children}</div>
      {footer && <div className="mt-2 px-1">{footer}</div>}
    </section>
  );
}

export default function CheckIn({ date, entry, stats, editable, onPatch }: Props) {
  const [note, setNote] = useState(entry.note ?? "");
  const [weight, setWeight] = useState(entry.weightKg?.toString() ?? "");

  // The server is the source of truth; re-sync when a save comes back.
  useEffect(() => setNote(entry.note ?? ""), [entry.note]);
  useEffect(() => setWeight(entry.weightKg?.toString() ?? ""), [entry.weightKg]);

  const set = (patch: Record<string, unknown>) => {
    if (!editable) return;
    onPatch(date, patch);
  };

  const restLeft = stats.rest.left;
  const cheatLeft = stats.cheat.left;
  const gym = stats.gymWeek;
  const swim = stats.swimWeek;

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between px-1">
        <p className="text-sm font-medium">{formatDayLabel(date)}</p>
        {!editable && <span className="text-xs text-muted">🔒 locked</span>}
      </div>

      <Group
        title="Movement"
        habit="movement"
        streak={stats.streaks.movement.count}
        pending={stats.streaks.movement.pending}
        footer={
          <p className={`text-xs ${gym.noSlack ? "text-warn" : "text-muted"}`}>
            Gym {gym.done}/{gym.target} this week
            {/* Appears from midweek, while the week can still be saved. */}
            {gym.noSlack && (
              <>
                {" · "}
                {gym.target - gym.done} left, {gym.daysRemaining}{" "}
                {gym.daysRemaining === 1 ? "day" : "days"} remaining — no slack
              </>
            )}
            {gym.met && " · met ✓"}
          </p>
        }
      >
        {/* Three independent booleans, not one choice. Gym *and* a walk is a
            normal day, and modelling it as an enum would throw that away. */}
        <Toggle
          label="Gym"
          habit="movement"
          on={entry.gymDone}
          disabled={!editable}
          onClick={() => set({ gymDone: !entry.gymDone })}
        />
        <Toggle
          label="Walk"
          habit="movement"
          on={entry.walkDone}
          disabled={!editable}
          onClick={() => set({ walkDone: !entry.walkDone })}
        />
        <Toggle
          label="Run"
          habit="movement"
          on={entry.runDone}
          disabled={!editable}
          onClick={() => set({ runDone: !entry.runDone })}
        />
      </Group>

      <Group
        title="Swim"
        habit="swim"
        streak={stats.streaks.swim.count}
        pending={stats.streaks.swim.pending}
        footer={
          <p className="text-xs text-muted">
            Swim {swim.done}/{swim.target} this week{swim.met && " · met ✓"}
          </p>
        }
      >
        <Toggle
          label="Swim"
          habit="swim"
          on={entry.swimDone}
          disabled={!editable}
          onClick={() => set({ swimDone: !entry.swimDone })}
        />
      </Group>

      <Group
        title="Diet"
        habit="diet"
        streak={stats.streaks.diet.count}
        pending={stats.streaks.diet.pending}
      >
        <Toggle
          label="Diet"
          habit="diet"
          on={entry.dietDone}
          disabled={!editable}
          onClick={() => set({ dietDone: !entry.dietDone })}
        />
      </Group>

      {/* Escape hatches, deliberately lighter than the primary toggles. They
          are budgeted resources you spend, not goals you aim at. */}
      <div className="flex gap-2">
        <TokenToggle
          label="Rest day"
          on={entry.isRestDay}
          left={restLeft}
          emptyMessage="No rest days left this month"
          disabled={!editable}
          onClick={() => set({ isRestDay: !entry.isRestDay })}
        />
        <TokenToggle
          label="Cheat day"
          on={entry.isCheatDay}
          left={cheatLeft}
          emptyMessage="No cheat days left this month"
          disabled={!editable}
          onClick={() => set({ isCheatDay: !entry.isCheatDay })}
        />
      </div>

      <div className="space-y-2 rounded-2xl border border-line bg-surface p-3">
        <textarea
          value={note}
          maxLength={280}
          rows={2}
          disabled={!editable}
          placeholder="Note (optional)"
          onChange={(e) => setNote(e.target.value)}
          // Saved on blur rather than per keystroke — no need for 280 writes.
          onBlur={() => note !== (entry.note ?? "") && set({ note })}
          className="w-full resize-none rounded-lg bg-surface-2 px-3 py-2 text-sm outline-none placeholder:text-muted disabled:opacity-50"
        />
        <div className="flex items-center gap-2">
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            value={weight}
            disabled={!editable}
            placeholder="Weight"
            onChange={(e) => setWeight(e.target.value)}
            onBlur={() => {
              const current = entry.weightKg?.toString() ?? "";
              if (weight !== current) set({ weightKg: weight === "" ? null : Number(weight) });
            }}
            className="w-28 rounded-lg bg-surface-2 px-3 py-2 text-sm outline-none placeholder:text-muted disabled:opacity-50"
          />
          <span className="text-xs text-muted">kg</span>
        </div>
      </div>
    </div>
  );
}

function TokenToggle({
  label,
  on,
  left,
  emptyMessage,
  disabled,
  onClick,
}: {
  label: string;
  on: boolean;
  left: number;
  emptyMessage: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  // At zero the toggle is disabled *and says why* — never silently inert.
  // Un-marking stays available, because that refunds the token.
  const spent = left <= 0 && !on;
  const isDisabled = disabled || spent;

  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={isDisabled}
      onClick={onClick}
      className={[
        "min-h-12 flex-1 rounded-xl border px-3 text-xs transition-colors",
        "active:scale-[0.98]",
        on
          ? "border-muted/50 bg-surface-2 text-text"
          : "border-line bg-transparent text-muted",
        isDisabled && "opacity-45",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span className="block font-medium">
        {label}
        {on ? " ✓" : ""}
      </span>
      <span className="block text-[10px] opacity-70">
        {spent ? emptyMessage : `${left} left`}
      </span>
    </button>
  );
}
