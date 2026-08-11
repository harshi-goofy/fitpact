"use client";

import { useEffect, useMemo, useState } from "react";
import { activeDaysInMonth, calendarStats } from "@/lib/derive";
import { heatLevel } from "@/lib/stats";
import {
  addDays,
  dayOfWeek,
  daysInMonth,
  isCheatSunday,
  monthRange,
} from "@/lib/timezone";
import type { BoardPayload, HabitKey } from "@/lib/types";
import { Card, Eyebrow, HABIT, HABIT_ORDER, HEAT, ScreenTitle, StatTile } from "./ui";

const DOW = ["S", "M", "T", "W", "T", "F", "S"];

export default function CalendarScreen({
  board,
  onRefresh,
  canLog = true,
}: {
  board: BoardPayload;
  onRefresh?: () => void;
  canLog?: boolean;
}) {
  const { today, entries } = board;
  const [selected, setSelected] = useState(today);
  const [weightInput, setWeightInput] = useState("");
  const [saving, setSaving] = useState(false);

  const { start } = monthRange(today);
  const total = daysInMonth(today);
  // The grid runs Sunday-first, but dayOfWeek() is Monday-indexed.
  const lead = (dayOfWeek(start) + 1) % 7;

  const days = useMemo(
    () => Array.from({ length: total }, (_, i) => addDays(start, i)),
    [start, total],
  );

  const sel = entries[selected];
  const selLogged: HabitKey[] = HABIT_ORDER.filter((h) => sel?.[`${h}Done`]);
  const monthName = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "long" }).format(
    new Date(`${today}T00:00:00.000Z`),
  );

  // Sync the weight input whenever the selected day or entries change.
  useEffect(() => {
    const w = entries[selected]?.weightKg;
    setWeightInput(w != null ? w.toFixed(1) : "");
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
      if (res.ok) onRefresh?.();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fp-screen flex flex-col gap-3">
      <ScreenTitle
        eyebrow={`${activeDaysInMonth(entries, today)} of ${total} days active`}
        title={monthName}
        aside={
          <div className="flex items-center gap-[5px]">
            <span className="text-[9.5px] font-bold tracking-[.4px]" style={{ color: "#535c4c" }}>
              LESS
            </span>
            {HEAT.map((c) => (
              <div key={c} className="h-2.5 w-2.5 rounded-[3px]" style={{ background: c }} />
            ))}
            <span className="text-[9.5px] font-bold tracking-[.4px]" style={{ color: "#535c4c" }}>
              MORE
            </span>
          </div>
        }
      />

      {/* Month grid */}
      <Card className="rounded-3xl px-4 py-[18px]">
        <div className="grid grid-cols-7 gap-1.5">
          {DOW.map((d, i) => (
            <div
              key={`${d}${i}`}
              className="pb-1 text-center text-[9.5px] font-bold tracking-[.6px]"
              style={{ color: "#535c4c" }}
            >
              {d}
            </div>
          ))}

          {Array.from({ length: lead }, (_, i) => (
            <div key={`lead-${i}`} aria-hidden />
          ))}

          {days.map((d) => {
            const isToday = d === today;
            const isSel = d === selected;
            const future = d > today;
            const heat = heatLevel(entries, d);
            const cheat = isCheatSunday(d);
            const hasWeight = entries[d]?.weightKg != null;

            let bg = "var(--color-well)";
            let fg = "var(--color-faint)";
            if (heat > 0) {
              bg = HEAT[heat];
              fg = "#131709";
            }
            if (future) {
              bg = "#131610";
              fg = "#3a4234";
            }
            if (isSel) {
              bg = "#f4f6f1";
              fg = "#131709";
            }

            return (
              <button
                key={d}
                onClick={() => setSelected(d)}
                aria-current={isToday ? "date" : undefined}
                aria-label={d}
                className="fp-tap box-border flex aspect-square flex-col items-center justify-center gap-px rounded-[11px]"
                style={{
                  background: bg,
                  border: `1.5px ${cheat && !isSel ? "dashed" : "solid"} ${
                    cheat && !isSel ? "#7f9a2c" : isToday && !isSel ? "var(--color-lime)" : "transparent"
                  }`,
                }}
              >
                <span className="fp-nums text-[12px] font-bold leading-none" style={{ color: fg }}>
                  {Number(d.slice(8))}
                </span>
                <span
                  className="h-[3px] w-[3px] rounded-full"
                  style={{ background: hasWeight ? HABIT.diet.hex : "transparent" }}
                />
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex items-center gap-3.5 border-t border-line pt-3.5">
          <div className="flex items-center gap-1.5">
            <div className="h-[5px] w-[5px] rounded-full" style={{ background: HABIT.diet.hex }} />
            <span className="text-[10.5px] font-semibold text-muted">weight logged</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className="box-border h-2.5 w-2.5 rounded-[3px]"
              style={{ border: "1.5px dashed var(--color-lime)" }}
            />
            <span className="text-[10.5px] font-semibold text-muted">cheat day</span>
          </div>
        </div>
      </Card>

      {/* Selected day */}
      <Card className="rounded-3xl p-5">
        <Eyebrow>
          {selLogged.length ? "Logged · " : ""}
          {new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short" }).format(
            new Date(`${selected}T00:00:00.000Z`),
          )}
        </Eyebrow>

        <div className="mt-3 flex flex-col gap-0.5">
          {selLogged.length ? (
            selLogged.map((h) => {
              const confirmed =
                h === "diet" ? sel?.dietConfirmedAt != null : sel?.moveConfirmedAt != null;
              return (
                <div key={h} className="flex items-center gap-3 py-[7px]">
                  <div
                    className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-xl text-[12.5px] font-extrabold"
                    style={{ background: HABIT[h].tint, color: HABIT[h].hex }}
                  >
                    {HABIT[h].letter}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-bold" style={{ color: "#eef0e9" }}>
                      {HABIT[h].label}
                    </div>
                    <div className="mt-0.5 text-[11.5px] font-semibold text-muted">
                      {confirmed
                        ? `Confirmed by ${board.partner?.name ?? "partner"}`
                        : "Awaiting confirmation"}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="flex items-center gap-3 py-[7px]">
              <div
                className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-xl text-[12.5px] font-extrabold"
                style={{ background: "var(--color-well)", color: "var(--color-muted)" }}
              >
                —
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-bold" style={{ color: "#eef0e9" }}>
                  Nothing logged
                </div>
                <div className="mt-0.5 text-[11.5px] font-semibold text-muted">
                  {selected > today ? "Not yet" : "Rest day"}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Weight is logged here rather than on Today because it is a fact about
            a date, not a claim about effort — it needs no confirmation. */}
        {canLog ? (
          <div className="mt-4 flex items-center gap-2.5 border-t border-line pt-4">
            <Eyebrow className="shrink-0">Weight</Eyebrow>
            <input
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
              inputMode="decimal"
              placeholder="e.g. 87.4"
              aria-label="Weight in kilograms"
              className="fp-nums min-w-0 flex-1 rounded-[13px] px-3.5 py-[11px] text-[13.5px] font-bold text-text outline-none"
              style={{ background: "var(--color-input)", border: "1px solid #2b3025" }}
            />
            <button
              onClick={saveWeight}
              disabled={saving || !weightInput}
              className="fp-tap shrink-0 rounded-[13px] px-[18px] py-[11px] text-[13px] font-bold disabled:opacity-40"
              style={{ background: "var(--color-lime)", color: "var(--color-on-lime)" }}
            >
              {saving ? "…" : "Save"}
            </button>
          </div>
        ) : null}
      </Card>

      {/* Month summary */}
      <div className="flex gap-2.5">
        {calendarStats(entries, today).map((s) => (
          <StatTile key={s.label} value={s.value} label={s.label} color={s.color} />
        ))}
      </div>
    </div>
  );
}
