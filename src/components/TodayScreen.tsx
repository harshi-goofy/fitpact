"use client";

import { formatDayLabel } from "@/lib/timezone";
import type { BoardPayload, Entry, HabitKey } from "@/lib/types";
import { Bar, Card, Eyebrow, HABIT, HABIT_ORDER, LetterBadge, SectionHeading, StatBlock } from "./ui";

function greeting(name: string, hour: number) {
  const part = hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : "Evening";
  return `${part}, ${name}`;
}

export default function TodayScreen({
  board,
  entry,
  onToggle,
  busy,
}: {
  board: BoardPayload;
  entry: Entry;
  onToggle: (habit: HabitKey) => void;
  busy: HabitKey | null;
}) {
  const { stats, tracker, today } = board;
  const { streak, weight, cheat } = stats;

  // Only used to pick the word "Morning" — the date itself always comes from
  // the server in APP_TIMEZONE, never from the browser.
  const hour = new Date().getHours();

  return (
    <div className="fp-screen">
      {/* Header */}
      <header className="flex items-start justify-between pt-3.5 pb-5">
        <div>
          <Eyebrow className="tracking-[1.4px]">{formatDayLabel(today)}</Eyebrow>
          <h1 className="mt-1 text-[26px] font-bold tracking-[-.5px] text-text">
            {greeting(tracker.name, hour)}
          </h1>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#333830] bg-[#22261f] text-sm font-bold text-lime">
          {tracker.name.charAt(0).toUpperCase()}
        </div>
      </header>

      {/* Streak hero */}
      <section
        className="relative overflow-hidden rounded-[28px] bg-lime p-6 text-on-lime"
        aria-label="Current streak"
      >
        <div className="absolute -right-10 -top-10 h-45 w-45 rounded-full bg-white/25" aria-hidden />
        <div className="relative">
          <div className="text-[11px] font-bold uppercase tracking-[1.6px] opacity-65">
            Current streak
          </div>
          <div className="mt-1.5 flex items-end gap-2.5">
            <div className="text-[78px] font-extrabold leading-[.85] tracking-[-4px]">
              {streak.count}
            </div>
            <div className="pb-2 text-lg font-bold">{streak.count === 1 ? "day" : "days"}</div>
          </div>
          <p className="mt-3 text-sm font-medium opacity-75">
            {streak.count === 0 && streak.pending
              ? "Log diet plus a swim or gym to start"
              : streak.count >= streak.best
                ? `Your best run yet${streak.pending ? " · today still open" : ""}`
                : `${streak.best - streak.count} ${streak.best - streak.count === 1 ? "day" : "days"} from your record of ${streak.best}`}
          </p>

          <div className="mt-4.5 flex gap-1.5">
            {streak.week.map((d, i) => (
              <div key={d.date} className="flex flex-1 flex-col items-center gap-[7px]">
                <div
                  className="h-1.5 self-stretch rounded-full"
                  style={{
                    background: d.done
                      ? "rgba(18,21,15,.75)"
                      : d.future
                        ? "rgba(18,21,15,.15)"
                        : "rgba(18,21,15,.28)",
                  }}
                />
                <div className="text-[11px] font-bold opacity-60">{d.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Quick log */}
      <div className="mt-3 flex gap-2.5">
        {HABIT_ORDER.map((key) => {
          const h = HABIT[key];
          const done = entry[`${key}Done`];
          const isBusy = busy === key;
          return (
            <button
              key={key}
              onClick={() => onToggle(key)}
              disabled={isBusy}
              aria-pressed={done}
              className="flex flex-1 flex-col items-center gap-2.5 rounded-[20px] border bg-card px-3 py-4 transition-colors disabled:opacity-60"
              style={{ borderColor: done ? h.hex : "var(--color-line)" }}
            >
              <LetterBadge
                letter={done ? "✓" : h.letter}
                color={h.hex}
                tint={h.tint}
                filled={done}
              />
              <span className="text-[13px] font-bold text-text">{h.label}</span>
              <span
                className="text-[11px] font-semibold"
                style={{ color: done ? h.hex : "var(--color-muted)" }}
              >
                {isBusy ? "Saving…" : done ? "Logged" : "Not logged"}
              </span>
            </button>
          );
        })}
      </div>

      {stats.isRestToday ? (
        <p className="mt-3 rounded-2xl border border-line bg-card px-4 py-3 text-[12.5px] font-semibold text-text-2">
          <span className="text-lime">Rest day.</span> Sundays keep the streak whatever you do.
        </p>
      ) : null}

      {/* Month targets */}
      <SectionHeading
        title={`End of ${stats.monthLabel}`}
        aside={`${stats.daysLeftInMonth} ${stats.daysLeftInMonth === 1 ? "day" : "days"} left`}
      />
      <Card className="flex flex-col gap-4 p-[18px]">
        {stats.monthTargets.map((m) => (
          <div key={m.key}>
            <div className="flex items-baseline justify-between">
              <span className="text-[13.5px] font-semibold text-text">{m.label}</span>
              <span className="text-[12.5px] font-bold text-text-2">
                {m.done} / {m.target}
              </span>
            </div>
            <div className="mt-2">
              <Bar pct={m.pct} color={HABIT[m.key].hex} />
            </div>
            <p className="mt-1.5 text-[11.5px] font-semibold text-faint">{m.note}</p>
          </div>
        ))}
      </Card>

      {/* Weight plan */}
      <Card className="mt-3 p-5">
        <div className="flex items-start justify-between">
          <div>
            <Eyebrow>
              Goal weight ·{" "}
              {new Intl.DateTimeFormat("en-GB", {
                timeZone: "UTC",
                day: "numeric",
                month: "short",
              }).format(new Date(`${weight.goalDate}T00:00:00.000Z`))}
            </Eyebrow>
            <div className="mt-2 flex items-end gap-2">
              <span className="text-[38px] font-extrabold leading-none tracking-[-1.5px] text-text">
                {weight.goalKg.toFixed(1)}
              </span>
              <span className="pb-1 text-sm font-bold text-muted">kg</span>
            </div>
          </div>
          <div className="text-right">
            <Eyebrow>Today</Eyebrow>
            <div className="mt-2 text-xl font-bold text-text-2">
              {weight.currentKg.toFixed(1)} kg
            </div>
          </div>
        </div>

        <div className="mt-4.5">
          <Bar pct={weight.pct} color={HABIT.diet.hex} height={8} />
        </div>
        <div className="mt-2 flex justify-between text-[11.5px] font-semibold text-faint">
          <span>
            {weight.lostKg >= 0
              ? `${weight.lostKg.toFixed(1)} kg down`
              : `${Math.abs(weight.lostKg).toFixed(1)} kg up`}
          </span>
          <span>{weight.toGoKg.toFixed(1)} kg to go</span>
        </div>

        <div className="mt-4.5 flex gap-2.5 border-t border-line pt-4">
          <StatBlock
            value={`${weight.perWeekNeeded.toFixed(2)} kg`}
            label="Needed per week"
            color={weight.perWeekNeeded > 1 ? "#ff8a8a" : "var(--color-text)"}
          />
          {weight.nextCheckpoint ? (
            <StatBlock
              value={`${weight.nextCheckpoint.targetKg.toFixed(1)} kg`}
              label={`Checkpoint ${weight.nextCheckpoint.month} ${weight.nextCheckpoint.date.slice(8)}`}
              color={HABIT.diet.hex}
            />
          ) : null}
          <StatBlock value={String(weight.daysToGoal)} label="Days to go" />
        </div>

        {/* The month-by-month plan, since the whole point was splitting the
            10 kg into something you can check against on the 31st. */}
        <details className="mt-4 border-t border-line pt-3.5">
          <summary className="cursor-pointer list-none text-[12px] font-bold uppercase tracking-[1.2px] text-muted">
            Monthly plan ▾
          </summary>
          <ul className="mt-3 flex flex-col gap-2">
            {weight.checkpoints.map((c) => (
              <li key={c.date} className="flex items-baseline justify-between text-[13px]">
                <span className="font-semibold text-text-2">
                  {c.month} {c.date.slice(8)}
                </span>
                <span className="font-bold text-text">{c.targetKg.toFixed(1)} kg</span>
              </li>
            ))}
          </ul>
        </details>
      </Card>

      {/* Cheat meal */}
      <Card className="mt-3 p-5">
        <div className="flex items-start gap-3">
          <LetterBadge letter="C" color={HABIT.diet.hex} tint={HABIT.diet.tint} />
          <div className="min-w-0">
            <Eyebrow>Next cheat meal</Eyebrow>
            <div className="mt-1 text-[15px] font-bold text-text">
              {cheat.whenLabel} · {cheat.nextLabel}
            </div>
          </div>
        </div>
        <p className="mt-3 text-[12.5px] font-semibold leading-relaxed text-faint">
          Afternoon meal only. The 2nd and 4th Sunday of each month — two per month, always.
        </p>
        <div className="mt-3.5 flex gap-2.5">
          {cheat.slots.map((s) => (
            <div
              key={s.date}
              className="flex-1 rounded-2xl border border-line px-3 py-2.5"
              style={{ opacity: s.past ? 0.45 : 1 }}
            >
              <div className="text-[12.5px] font-bold text-text">{s.label}</div>
              <div className="mt-0.5 text-[11px] font-semibold text-muted">{s.state}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
