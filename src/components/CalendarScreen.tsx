"use client";

import { useEffect, useMemo, useState } from "react";
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

export default function CalendarScreen({
  board,
  onRefresh,
  canLog = true,
}: {
  board: BoardPayload;
  onRefresh?: () => void;
  canLog?: boolean;
}) {
  const { today, entries, stats } = board;
  const [selected, setSelected] = useState(today);
  const [weightInput, setWeightInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const { start } = monthRange(today);
  const total = daysInMonth(today);
  const lead = (dayOfWeek(start) + 1) % 7;

  const days = useMemo(
    () => Array.from({ length: total }, (_, i) => addDays(start, i)),
    [start, total],
  );

  const activeCount = days.filter((d) => d <= today && heatLevel(entries, d) > 0).length;

  const sel = entries[selected];
  const selLogged: HabitKey[] = HABIT_ORDER.filter((h) => sel?.[`${h}Done`]);
  const isFuture = selected > today;

  const pctOf = (n: number, d: number) => (d === 0 ? 0 : Math.round((n / d) * 100));
  const elapsed = Math.max(days.filter((d) => d <= today).length, 1);

  // Sync the weight input whenever the selected day or entries change.
  useEffect(() => {
    const w = entries[selected]?.weightKg;
    setWeightInput(w != null ? w.toFixed(1) : "");
    setSaved(false);
  }, [selected, entries]);

  async function saveWeight() {
    const kg = parseFloat(weightInput);
    if (!Number.isFinite(kg) || kg <= 0) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/day/${selected}/weight`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weightKg: kg }),
      });
      if (res.ok) {
        setSaved(true);
        onRefresh?.();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fp-screen">
      <header className="pt-3.5 pb-5">
        <Eyebrow>This month</Eyebrow>
        <h1 className="mt-1 text-[28px] font-bold tracking-[-.5px] text-text">
          {stats.monthLabel}
        </h1>
      </header>

      <Card className="p-4">
        <div className="mb-2 grid grid-cols-7 gap-1.5">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <div key={i} className="text-center text-[11px] font-bold text-faint">
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
            const restOnly = isSunday(d) && level === 0 && !future;
            const hasWeight = entries[d]?.weightKg != null;
            return (
              <button
                key={d}
                onClick={() => setSelected(d)}
                aria-label={`${formatDayLabel(d)}, ${level} of 3 logged`}
                aria-pressed={isSel}
                className="relative flex aspect-square flex-col items-center justify-center rounded-[9px] text-[11px] font-bold transition-transform active:scale-95"
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
                <span>{Number(d.slice(8))}</span>
                {hasWeight ? (
                  <span
                    className="absolute bottom-[3px] left-1/2 h-[4px] w-[4px] -translate-x-1/2 rounded-full"
                    style={{
                      background: isSel ? HABIT.diet.hex : level >= 2 ? "#12150f" : HABIT.diet.hex,
                    }}
                  />
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-[12px] font-semibold text-muted">
              {activeCount} of {total} days active
            </span>
            <div className="flex items-center gap-1">
              <span
                className="h-[5px] w-[5px] rounded-full"
                style={{ background: HABIT.diet.hex }}
              />
              <span className="text-[11px] font-semibold text-faint">weight logged</span>
            </div>
          </div>
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
            {selLogged.length > 0 ? "Logged" : isSunday(selected) ? "Rest day" : "Nothing logged"}{" "}
            · {formatDayLabel(selected)}
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
                <LetterBadge
                  letter={HABIT[h].letter}
                  color={HABIT[h].hex}
                  tint={HABIT[h].tint}
                  size={34}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-bold text-text">{HABIT[h].label}</div>
                  <div className="text-[12px] font-semibold text-faint">Completed</div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2.5 text-[13px] font-semibold text-faint">
            {isFuture
              ? "Still to come."
              : isSunday(selected)
                ? "Sundays are rest days — the streak holds."
                : "No swim, gym or diet recorded."}
          </p>
        )}

        {/* Weight logging */}
        <div className="mt-4 border-t border-line pt-4">
          <Eyebrow className="mb-2.5">Weight</Eyebrow>
          {!canLog ? (
            <p className="text-[13px] font-semibold text-faint">
              Only {board.tracker.name} can log weight.
            </p>
          ) : !isFuture ? (
            <div className="flex items-center gap-2.5">
              <input
                type="number"
                step="0.1"
                min="30"
                max="300"
                placeholder="e.g. 87.5"
                value={weightInput}
                onChange={(e) => {
                  setWeightInput(e.target.value);
                  setSaved(false);
                }}
                onKeyDown={(e) => e.key === "Enter" && saveWeight()}
                className="w-[90px] rounded-xl border border-line bg-screen px-3 py-2 text-[15px] font-bold text-text placeholder:text-faint focus:outline-none focus:border-[var(--color-lime)]"
              />
              <span className="text-[14px] font-semibold text-muted">kg</span>
              <button
                onClick={saveWeight}
                disabled={saving || !weightInput}
                className="rounded-xl px-4 py-2 text-[13px] font-bold transition-opacity disabled:opacity-40"
                style={{ background: "var(--color-lime)", color: "var(--color-on-lime)" }}
              >
                {saving ? "Saving…" : saved ? "Saved ✓" : "Save"}
              </button>
            </div>
          ) : (
            <p className="text-[13px] font-semibold text-faint">Future date — nothing to log.</p>
          )}
        </div>

        {sel?.note ? (
          <p className="mt-3 text-[13px] font-medium italic text-text-2">"{sel.note}"</p>
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
            <div className="mt-0.5 text-[12px] font-semibold leading-tight text-muted">{s.l}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}
