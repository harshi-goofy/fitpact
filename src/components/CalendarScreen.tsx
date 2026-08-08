"use client";

import { useMemo, useState } from "react";
import { heatLevel } from "@/lib/stats";
import {
  addDays,
  dayOfWeek,
  daysInMonth,
  formatDayLabel,
  isCheatSunday,
  isSunday,
  monthRange,
} from "@/lib/timezone";
import type { BoardPayload, HabitKey } from "@/lib/types";
import { Card, Eyebrow, HABIT, HABIT_ORDER, HEAT, LetterBadge } from "./ui";

export default function CalendarScreen({ board }: { board: BoardPayload }) {
  const { today, entries, stats } = board;
  const [selected, setSelected] = useState(today);

  const { start } = monthRange(today);
  const total = daysInMonth(today);

  // The grid runs Sun–Sat, so the leading blanks are however far into the week
  // the 1st falls. dayOfWeek is Mon=0, so Sunday (6) maps to column 0.
  const lead = (dayOfWeek(start) + 1) % 7;

  const days = useMemo(
    () => Array.from({ length: total }, (_, i) => addDays(start, i)),
    [start, total],
  );

  const activeCount = days.filter((d) => d <= today && heatLevel(entries, d) > 0).length;

  const sel = entries[selected];
  const selLogged: HabitKey[] = HABIT_ORDER.filter((h) => sel?.[`${h}Done`]);

  const pctOf = (n: number, d: number) => (d === 0 ? 0 : Math.round((n / d) * 100));
  const elapsed = Math.max(days.filter((d) => d <= today).length, 1);

  return (
    <div className="fp-screen">
      <header className="pt-3.5 pb-5">
        <Eyebrow>This month</Eyebrow>
        <h1 className="mt-1 text-[26px] font-bold tracking-[-.5px] text-text">
          {stats.monthLabel}
        </h1>
      </header>

      <Card className="p-4">
        <div className="mb-2 grid grid-cols-7 gap-1.5">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <div key={i} className="text-center text-[10px] font-bold text-faint">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: lead }, (_, i) => (
            <div key={`pad-${i}`} aria-hidden />
          ))}
          {days.map((d) => {
            const level = heatLevel(entries, d);
            const isSel = d === selected;
            const future = d > today;
            // A rest Sunday with nothing logged is a day the plan worked. It
            // gets an outline rather than the empty fill, so a run of Sundays
            // never reads as a run of misses.
            const restOnly = isSunday(d) && level === 0 && !future;
            return (
              <button
                key={d}
                onClick={() => setSelected(d)}
                aria-label={`${formatDayLabel(d)}, ${level} of 3 logged`}
                aria-pressed={isSel}
                className="flex aspect-square items-center justify-center rounded-[9px] text-[11px] font-bold transition-transform active:scale-95"
                style={{
                  background: isSel ? "#f2f4ef" : future ? "transparent" : HEAT[level],
                  border: future
                    ? "1px solid #1e221b"
                    : restOnly
                      ? "1px dashed rgba(200,245,66,.4)"
                      : "1px solid transparent",
                  color: isSel || level >= 2 ? "#12150f" : future ? "#3a4034" : "#7c8474",
                  opacity: future ? 0.6 : 1,
                }}
              >
                {Number(d.slice(8))}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-[11.5px] font-semibold text-muted">
            {activeCount} of {total} days active
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold text-faint">less</span>
            {HEAT.map((c) => (
              <span key={c} className="h-2.5 w-2.5 rounded-[3px]" style={{ background: c }} />
            ))}
            <span className="text-[10px] font-semibold text-faint">more</span>
          </div>
        </div>
      </Card>

      {/* Selected day detail */}
      <Card className="mt-3 p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[15px] font-bold text-text">
            {selLogged.length > 0 ? "Logged" : isSunday(selected) ? "Rest day" : "Nothing logged"} ·{" "}
            {formatDayLabel(selected)}
          </h2>
          {isCheatSunday(selected) ? (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[1px]"
              style={{ background: HABIT.diet.tint, color: HABIT.diet.hex }}
            >
              Cheat
            </span>
          ) : null}
        </div>

        {selLogged.length > 0 ? (
          <ul className="mt-3.5 flex flex-col gap-3">
            {selLogged.map((h) => (
              <li key={h} className="flex items-center gap-3">
                <LetterBadge letter={HABIT[h].letter} color={HABIT[h].hex} tint={HABIT[h].tint} size={34} />
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-bold text-text">{HABIT[h].label}</div>
                  <div className="text-[11.5px] font-semibold text-faint">Completed</div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2.5 text-[12.5px] font-semibold text-faint">
            {selected > today
              ? "Still to come."
              : isSunday(selected)
                ? "Sundays are rest days — the streak holds."
                : "No swim, gym or diet recorded."}
          </p>
        )}

        {sel?.weightKg ? (
          <p className="mt-3.5 border-t border-line pt-3 text-[12.5px] font-semibold text-text-2">
            Weight: <span className="text-text">{sel.weightKg.toFixed(1)} kg</span>
          </p>
        ) : null}
        {sel?.note ? (
          <p className="mt-2.5 text-[12.5px] font-medium italic text-text-2">“{sel.note}”</p>
        ) : null}
      </Card>

      {/* Month stats */}
      <div className="mt-3 flex gap-2.5">
        {[
          { v: `${pctOf(stats.monthTargets[0].done, elapsed)}%`, l: "Swim days", c: HABIT.swim.hex },
          { v: String(stats.monthTargets[1].done), l: "Gym sessions", c: HABIT.gym.hex },
          { v: `${pctOf(stats.monthTargets[2].done, elapsed)}%`, l: "Diet on target", c: HABIT.diet.hex },
        ].map((s) => (
          <Card key={s.l} className="flex-1 p-3.5">
            <div className="text-[22px] font-extrabold tracking-[-1px]" style={{ color: s.c }}>
              {s.v}
            </div>
            <div className="mt-0.5 text-[11px] font-semibold leading-tight text-muted">{s.l}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}
