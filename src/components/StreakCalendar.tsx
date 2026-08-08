"use client";

import { useMemo, useState } from "react";
import { SATISFIED, satisfiedByToken } from "@/lib/stats";
import { addDays, formatDayLabel, weekStart, type DateKey } from "@/lib/timezone";
import type { Entry, HabitKey } from "@/lib/types";

const HABITS: HabitKey[] = ["movement", "swim", "diet"];

/*
 * Sliver colours are applied as inline CSS variables rather than Tailwind
 * classes because the habit is chosen at runtime. Same palette as everywhere
 * else in the app.
 */
const HUE: Record<HabitKey, { full: string; muted: string; label: string }> = {
  movement: { full: "var(--color-movement)", muted: "var(--color-movement-muted)", label: "Movement" },
  swim: { full: "var(--color-swim)", muted: "var(--color-swim-muted)", label: "Swim" },
  diet: { full: "var(--color-diet)", muted: "var(--color-diet-muted)", label: "Diet" },
};

/**
 * 90 days as a GitHub-style grid: columns are weeks, rows are Mon–Sun, most
 * recent on the right.
 *
 * Every cell carries all three streaks as three vertical slivers in a fixed
 * order — Movement, Swim, Diet. The order never varies, so the eye learns the
 * position and a horizontal band of gaps down the middle sliver reads
 * instantly as "swimming is the problem". That is the entire reason this is a
 * three-part cell rather than three separate calendars.
 */
export default function StreakCalendar({
  days,
  entries,
  today,
}: {
  days: DateKey[];
  entries: Record<DateKey, Entry | undefined>;
  today: DateKey;
}) {
  const [selected, setSelected] = useState<DateKey | null>(null);

  // Pad to whole Mon–Sun weeks so the rows line up.
  const columns = useMemo(() => {
    const first = weekStart(days[0]);
    const last = weekStart(days[days.length - 1]);
    const cols: DateKey[][] = [];
    for (let m = first; m <= last; m = addDays(m, 7)) {
      cols.push(Array.from({ length: 7 }, (_, i) => addDays(m, i)));
    }
    return cols;
  }, [days]);

  const firstVisible = days[0];
  const selectedEntry = selected ? entries[selected] : undefined;

  return (
    <section className="mt-6 rounded-2xl border border-line bg-surface p-3">
      <div className="mb-3 flex items-baseline justify-between px-1">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
          Last 90 days
        </h2>
        <span className="text-[10px] text-muted">Mon → Sun</span>
      </div>

      {/*
        Fractional columns rather than fixed pixel cells: 90 days must never
        scroll horizontally at 375px, and shrinking the cell to fit more
        history would push the slivers below the legibility floor.
      */}
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
      >
        {columns.map((week, ci) => (
          <div key={ci} className="grid grid-rows-7 gap-1">
            {week.map((date) => {
              const inRange = date >= firstVisible && date <= today;
              const future = date > today;
              return (
                <DayCell
                  key={date}
                  date={date}
                  entry={entries[date]}
                  future={future}
                  dim={!inRange && !future}
                  onSelect={() => !future && setSelected(date)}
                />
              );
            })}
          </div>
        ))}
      </div>

      <Legend />

      {selected && (
        <div className="mt-3 rounded-xl border border-line bg-surface-2 p-3 text-xs">
          <div className="flex items-baseline justify-between">
            <p className="font-medium">{formatDayLabel(selected)}</p>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="text-muted"
              aria-label="Close day detail"
            >
              ✕
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-muted">
            {HABITS.map((h) => (
              <span key={h} style={{ color: SATISFIED[h](selectedEntry) ? HUE[h].full : undefined }}>
                {HUE[h].label} {SATISFIED[h](selectedEntry) ? "✓" : "—"}
              </span>
            ))}
          </div>
          {selectedEntry?.isRestDay && <p className="mt-1 text-muted">Rest day</p>}
          {selectedEntry?.isCheatDay && <p className="mt-1 text-muted">Cheat day</p>}
          {selectedEntry?.weightKg != null && (
            <p className="mt-1 text-muted">{selectedEntry.weightKg} kg</p>
          )}
          {selectedEntry?.note && <p className="mt-1">{selectedEntry.note}</p>}
        </div>
      )}
    </section>
  );
}

function DayCell({
  date,
  entry,
  future,
  dim,
  onSelect,
}: {
  date: DateKey;
  entry?: Entry;
  future: boolean;
  dim: boolean;
  onSelect: () => void;
}) {
  if (future) {
    return (
      <div
        aria-hidden
        className="aspect-square rounded-[3px] border border-line/60 opacity-40"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      title={formatDayLabel(date)}
      aria-label={formatDayLabel(date)}
      className={`flex aspect-square gap-[1px] overflow-hidden rounded-[3px] ${dim ? "opacity-30" : ""}`}
    >
      {HABITS.map((habit) => {
        const ok = SATISFIED[habit](entry);
        // A token-satisfied day is a day the plan worked — muted hue, never a
        // failure colour.
        const viaToken = satisfiedByToken(habit, entry);
        const bg = ok ? (viaToken ? HUE[habit].muted : HUE[habit].full) : "var(--color-empty)";
        return <span key={habit} className="flex-1" style={{ backgroundColor: bg }} />;
      })}
    </button>
  );
}

/** Three unlabelled slivers are not self-evident on first view. */
function Legend() {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-3 text-[10px] text-muted">
      {HABITS.map((h) => (
        <span key={h} className="flex items-center gap-1">
          <span
            className="inline-block h-2.5 w-1.5 rounded-[1px]"
            style={{ backgroundColor: HUE[h].full }}
          />
          {HUE[h].label}
        </span>
      ))}
      <span className="flex items-center gap-1">
        <span
          className="inline-block h-2.5 w-1.5 rounded-[1px]"
          style={{ backgroundColor: "var(--color-movement-muted)" }}
        />
        via token
      </span>
      <span className="flex items-center gap-1">
        <span
          className="inline-block h-2.5 w-1.5 rounded-[1px]"
          style={{ backgroundColor: "var(--color-empty)" }}
        />
        missed
      </span>
    </div>
  );
}
