"use client";

import { useEffect, useState } from "react";
import {
  awaitingLabel,
  awaitingToday,
  cheatUsage,
  claimDeadline,
  formatCountdown,
  nextRewardLine,
  nextStep,
  weightDelta,
} from "@/lib/derive";
import { formatDayLabel } from "@/lib/timezone";
import type { BoardPayload, Entry, HabitKey } from "@/lib/types";
import InsightsCard from "./InsightsCard";
import {
  ALERT,
  Bar,
  Card,
  Disclosure,
  Eyebrow,
  HABIT,
  HABIT_ORDER,
  LetterBadge,
  RewardTrack,
  Sparkline,
} from "./ui";

/**
 * A claim state, as the design names them.
 *   none      — nothing logged
 *   awaiting  — claimed, the partner hasn't ticked it
 *   confirmed — ticked, and therefore counting
 */
type LogState = "none" | "awaiting" | "confirmed";

function stateFor(entry: Entry, key: HabitKey): LogState {
  const done = entry[`${key}Done`];
  if (!done) return "none";
  // Swim and gym share one move confirmation; diet carries its own.
  const confirmed = key === "diet" ? entry.dietConfirmedAt !== null : entry.moveConfirmedAt !== null;
  return confirmed ? "confirmed" : "awaiting";
}

/**
 * The live countdown to the moment today's claims expire.
 *
 * Ticks once a second, and only while something is actually pending — an
 * interval running behind a card nobody is looking at is a battery cost for
 * nothing. The deadline itself comes from the server's date, so a phone with
 * the wrong clock shows the wrong remaining time but never the wrong deadline.
 */
function useCountdown(deadline: Date, active: boolean): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return formatCountdown(deadline.getTime() - now);
}

export default function TodayScreen({
  board,
  entry,
  onToggle,
  busy,
  canLog = true,
  onClaimReward,
  claimBusy,
  onGoTogether,
  onFlash,
}: {
  board: BoardPayload;
  entry: Entry;
  onToggle: (habit: HabitKey) => void;
  busy: HabitKey | null;
  canLog?: boolean;
  onClaimReward?: (id: string, claimed: boolean) => void;
  claimBusy?: string | null;
  onGoTogether?: () => void;
  onFlash?: (msg: string) => void;
}) {
  const { stats, tracker, today } = board;
  const { streak, weight, cheat, rewards } = stats;

  const [showRewards, setShowRewards] = useState(false);
  const [showCheat, setShowCheat] = useState(false);

  const awaiting = awaitingToday(entry);
  const next = nextStep(entry, streak.count, stats.isRestToday);
  const countdown = useCountdown(claimDeadline(today), awaiting > 0);
  const cheatUsed = cheatUsage(cheat);

  /* The last eight weigh-ins, oldest first — the sparkline's whole input. */
  const series = Object.keys(board.entries)
    .filter((k) => k <= today && board.entries[k]?.weightKg != null)
    .sort()
    .map((k) => board.entries[k].weightKg as number)
    .slice(-8);
  const seriesDelta = series.length >= 2 ? series[series.length - 1] - series[0] : null;

  /* Movement since the previous weigh-in, and the next reward restated
     against the latest one — both recompute the moment a weight is logged. */
  const delta = weightDelta(board.entries, today);
  const nextReward = nextRewardLine(weight, rewards);

  const confirmedCount = HABIT_ORDER.filter((k) => stateFor(entry, k) === "confirmed").length;
  const pillText =
    awaiting > 0
      ? `${awaiting} WAITING →`
      : confirmedCount < 3
        ? `${3 - confirmedCount} TO LOG`
        : "ALL CONFIRMED";

  /**
   * Tapping a tile claims it. Tapping one that is already claimed says so
   * rather than un-claiming it: a claim is a statement to another person, and
   * quietly retracting it behind their back is the one thing this app exists
   * to prevent.
   */
  const handleTile = (key: HabitKey) => {
    const state = stateFor(entry, key);
    if (!canLog) {
      onFlash?.("Only Harshi can log — you confirm on Together.");
      return;
    }
    if (state === "confirmed") {
      onFlash?.(`${HABIT[key].label} already confirmed`);
      return;
    }
    if (state === "awaiting") {
      onFlash?.(`${HABIT[key].label} is waiting on ${board.partner?.name ?? "your partner"}`);
      return;
    }
    onToggle(key);
  };

  return (
    <div className="fp-screen flex flex-col gap-3">
      {/* Header */}
      <header className="flex items-center justify-between px-0.5 pt-4 pb-0.5">
        <div>
          <Eyebrow className="tracking-[1.6px]">{formatDayLabel(today)}</Eyebrow>
          <h1 className="mt-[3px] text-[25px] font-bold tracking-[-.6px] text-text">FitPact</h1>
        </div>
        <div
          className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-lime"
          style={{ background: "#171b14", border: "1px solid #2b3025" }}
        >
          {tracker.name.charAt(0).toUpperCase()}
        </div>
      </header>

      {/* Streak hero */}
      <section
        className="relative overflow-hidden rounded-[26px] bg-lime p-[22px] text-on-lime"
        aria-label="Current streak"
      >
        <div
          className="absolute rounded-full bg-white/[.22]"
          style={{ right: -52, top: -64, width: 180, height: 180 }}
          aria-hidden
        />
        <div className="relative">
          <div className="flex items-start justify-between">
            <div className="text-[10.5px] font-bold uppercase tracking-[1.8px] opacity-55">
              Current streak
            </div>
            <button
              onClick={onGoTogether}
              className="fp-tap rounded-full px-3 py-1.5 text-[10.5px] font-bold tracking-[.5px] text-on-lime"
              style={{ background: awaiting > 0 ? "rgba(19,23,9,.12)" : "rgba(19,23,9,.08)" }}
            >
              {pillText}
            </button>
          </div>

          <div className="mt-2 flex items-end gap-[9px]">
            <div className="fp-nums text-[68px] font-extrabold leading-[.82] tracking-[-4px]">
              {streak.count}
            </div>
            <div className="pb-2 text-[17px] font-bold opacity-65">days</div>
          </div>

          <div className="mt-2.5 text-[13px] font-semibold opacity-60">
            {streak.count === 0 && streak.pending
              ? "Log a move and diet to start"
              : streak.count >= streak.best
                ? `Your best run yet${streak.pending ? " · today still open" : ""}`
                : `${streak.best - streak.count} ${streak.best - streak.count === 1 ? "day" : "days"} from your record of ${streak.best}`}
          </div>

          <div className="mt-5 flex gap-1.5">
            {streak.week.map((d) => (
              <div key={d.date} className="flex flex-1 flex-col items-center gap-2">
                <div
                  className="h-[5px] self-stretch rounded-full"
                  style={{
                    background: d.done
                      ? "rgba(19,23,9,.55)"
                      : d.future
                        ? "rgba(19,23,9,.1)"
                        : "rgba(19,23,9,.16)",
                  }}
                />
                <div className="text-[10.5px] font-bold opacity-50">{d.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Quick log */}
      <div className="flex gap-[9px]">
        {HABIT_ORDER.map((key) => {
          const h = HABIT[key];
          const state = stateFor(entry, key);
          const isBusy = busy === key;
          return (
            <button
              key={key}
              onClick={() => handleTile(key)}
              disabled={isBusy}
              aria-pressed={state !== "none"}
              className={`fp-card fp-tap flex flex-1 flex-col items-center gap-2.5 rounded-[20px] border px-2 pb-3.5 pt-4 disabled:opacity-60 ${
                state === "awaiting" ? "fp-pending" : ""
              }`}
              style={{
                borderColor:
                  state === "confirmed" ? h.hex : state === "awaiting" ? `${h.hex}66` : "var(--color-line)",
              }}
            >
              <LetterBadge
                letter={state === "confirmed" ? "✓" : h.letter}
                color={h.hex}
                tint={h.tint}
                filled={state === "confirmed"}
              />
              <span className="text-[13px] font-bold text-text">{h.label}</span>
              <span
                className="text-[10px] font-bold uppercase tracking-[.5px]"
                style={{
                  color:
                    state === "confirmed"
                      ? h.hex
                      : state === "awaiting"
                        ? "var(--color-text-2)"
                        : "var(--color-muted)",
                }}
              >
                {isBusy ? "Saving…" : state === "confirmed" ? "Confirmed" : state === "awaiting" ? "Awaiting" : "Not logged"}
              </span>
            </button>
          );
        })}
      </div>

      {/* Do this next */}
      <Card
        className="rounded-[22px] p-[18px]"
        style={{ borderColor: next.urgent ? "#2e3524" : "var(--color-line)" }}
      >
        <Eyebrow>Do this next</Eyebrow>
        <div className="mt-[7px] text-[16px] font-bold tracking-[-.3px] text-text">
          {next.action}
        </div>
        <p className="mt-[5px] text-[12.5px] font-medium leading-[1.5] text-text-2">{next.note}</p>

        {awaiting > 0 ? (
          <div className="mt-3.5 flex items-center gap-[9px] border-t border-line pt-3.5">
            <div className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: HABIT.diet.hex }} />
            <div className="flex-1 text-[12px] font-semibold text-text-2">{awaitingLabel(entry)}</div>
            <div
              className="fp-nums text-[13px] font-extrabold tracking-[-.2px]"
              style={{ color: HABIT.diet.hex }}
            >
              {countdown}
            </div>
          </div>
        ) : null}
      </Card>

      {/* Weight and rewards — deliberately one card. The reward ladder is the
          same 88 → 78 journey as the weight bar, so splitting them would draw
          the same line twice and imply two separate goals. */}
      <Card className="rounded-3xl p-5">
        <div className="flex items-start justify-between">
          <div>
            <Eyebrow>Current</Eyebrow>
            <div className="mt-2 flex items-end gap-1.5">
              <div className="fp-nums text-[38px] font-extrabold leading-[.9] tracking-[-1.8px] text-text">
                {weight.currentKg.toFixed(1)}
              </div>
              <div className="pb-[3px] text-[13px] font-bold" style={{ color: "#6b7462" }}>
                kg
              </div>
            </div>
            {/* Movement since the last weigh-in. Down is lime, up is the alert
                colour — the arrow and the colour say the same thing twice, on
                purpose, so it reads at a glance and still works colour-blind. */}
            {delta ? (
              <div
                className="mt-1.5 flex items-center gap-1 text-[12px] font-bold"
                style={{
                  color:
                    delta.direction === "up"
                      ? ALERT
                      : delta.direction === "down"
                        ? "var(--color-lime)"
                        : "#6b7462",
                }}
              >
                <span aria-hidden className="text-[10px] leading-none">
                  {delta.direction === "up" ? "▲" : delta.direction === "down" ? "▼" : "—"}
                </span>
                <span className="fp-nums">{delta.label}</span>
              </div>
            ) : null}

            <div
              className="mt-2 text-[12px] font-bold"
              style={{ color: weight.currentKg <= weight.monthlyTargetKg ? "var(--color-lime)" : ALERT }}
            >
              {weight.currentKg <= weight.monthlyTargetKg
                ? "On track for this month"
                : `${(weight.currentKg - weight.monthlyTargetKg).toFixed(1)} kg above this month's target`}
            </div>
          </div>

          <div className="text-right">
            <Eyebrow>{stats.monthLabel.slice(0, 3)} target</Eyebrow>
            <div className="fp-nums mt-2 text-[19px] font-bold tracking-[-.4px] text-text-2">
              {weight.monthlyTargetKg.toFixed(1)} kg
            </div>
            <Eyebrow className="mt-3.5">Goal</Eyebrow>
            <div className="fp-nums mt-1.5 text-[19px] font-bold tracking-[-.4px] text-lime">
              {weight.goalKg.toFixed(1)} kg
            </div>
          </div>
        </div>

        {/* Trend */}
        {series.length >= 2 ? (
          <div className="mt-5 flex items-end gap-3.5 border-t border-line pt-[18px]">
            <Sparkline values={series} color="var(--color-lime)" />
            <div className="shrink-0 text-right">
              <div
                className="fp-nums text-[13px] font-extrabold tracking-[-.3px]"
                style={{ color: seriesDelta !== null && seriesDelta > 0 ? ALERT : "var(--color-lime)" }}
              >
                {seriesDelta === null
                  ? "—"
                  : `${seriesDelta > 0 ? "+" : "−"}${Math.abs(seriesDelta).toFixed(1)} kg`}
              </div>
              <div className="mt-[3px] text-[10px] font-semibold text-muted">
                last {series.length} weigh-ins
              </div>
            </div>
          </div>
        ) : null}

        {/* Reward ladder */}
        <RewardTrack pct={weight.pct} rewards={rewards.rewards} nextId={rewards.next?.id} />

        <div className="mt-0.5 flex justify-between text-[11px] font-bold text-muted">
          <span>{weight.startKg.toFixed(0)} kg</span>
          <span>{weight.goalKg.toFixed(0)} kg</span>
        </div>

        {/* Next reward, in the terms the scale speaks: the reading to hit and
            how far that is from the latest weigh-in. Surfaced here rather than
            left inside the collapsed list, because it is the number the user
            opens the app to check. */}
        {nextReward ? (
          <div className="mt-[18px] rounded-2xl border border-line p-3.5">
            <div className="flex items-baseline justify-between gap-3">
              <Eyebrow>Next reward</Eyebrow>
              <div className="fp-nums text-[11px] font-bold text-muted">
                {rewards.earnedCount} of {rewards.rewards.length}
              </div>
            </div>
            <div className="fp-nums mt-2 text-[17px] font-extrabold tracking-[-.4px] text-text">
              {nextReward.headline}
            </div>
            <div className="mt-1 text-[12px] font-semibold text-text-2">{nextReward.label}</div>
            <div className="mt-2.5">
              <Bar pct={nextReward.pct} color="var(--color-lime)" />
            </div>
          </div>
        ) : null}

        <Disclosure
          className="mt-5 border-t border-line pt-[18px]"
          open={showRewards}
          onToggle={() => setShowRewards((v) => !v)}
          openLabel="Hide"
          closedLabel="All rewards"
          header={
            <div>
              <Eyebrow>
                Next reward · {rewards.earnedCount} of {rewards.rewards.length} unlocked
              </Eyebrow>
              <div className="mt-1.5 text-[15.5px] font-bold tracking-[-.2px] text-text">
                {rewards.next
                  ? `${rewards.toNextKg.toFixed(1)} kg to ${rewards.next.label}`
                  : "Every reward unlocked"}
              </div>
            </div>
          }
        >
          <ul className="mt-3.5 flex flex-col gap-0.5">
            {rewards.rewards.map((r) => {
              const isNext = r.id === rewards.next?.id;
              const isBusy = claimBusy === r.id;
              return (
                <li key={r.id} className="flex items-center gap-3 py-2">
                  <LetterBadge
                    letter={r.earned ? "✓" : String(r.kgLost)}
                    color={isNext || r.earned ? "var(--color-lime)" : "#5a6450"}
                    tint={isNext || r.earned ? HABIT.gym.tint : "var(--color-well)"}
                    filled={r.earned}
                  />
                  <div className="min-w-0 flex-1">
                    <div
                      className="text-[13.5px] font-bold"
                      style={{
                        color: isNext || r.earned ? "#eef0e9" : "var(--color-text-2)",
                        textDecoration: r.claimed ? "line-through" : undefined,
                      }}
                    >
                      {r.label}
                    </div>
                    <div className="mt-0.5 text-[11px] font-semibold text-muted">
                      {r.kgLost} kg down · at {r.atKg.toFixed(1)} kg
                    </div>
                  </div>
                  {r.earned && onClaimReward ? (
                    <button
                      onClick={() => onClaimReward(r.id, !r.claimed)}
                      disabled={isBusy}
                      className="fp-tap shrink-0 rounded-[11px] px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[.5px] disabled:opacity-40"
                      style={
                        r.claimed
                          ? { color: "var(--color-faint)" }
                          : { background: "var(--color-lime)", color: "var(--color-on-lime)" }
                      }
                    >
                      {isBusy ? "…" : r.claimed ? "Claimed" : "Claim"}
                    </button>
                  ) : (
                    <span className="shrink-0 text-[10px] font-bold uppercase tracking-[.5px] text-faint">
                      Locked
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </Disclosure>
      </Card>

      {/* Month targets */}
      <div className="mt-2.5 flex items-center justify-between px-1">
        <div className="text-[11px] font-bold uppercase tracking-[1.5px] text-eyebrow">
          End of {stats.monthLabel}
        </div>
        <div className="text-[11px] font-bold text-muted">
          {stats.daysLeftInMonth} {stats.daysLeftInMonth === 1 ? "day" : "days"} left
        </div>
      </div>

      <Card className="flex gap-3.5 rounded-3xl p-[18px]">
        {stats.monthTargets.map((m) => (
          <div key={m.key} className="flex-1">
            <div className="text-[11px] font-bold tracking-[.2px] text-text-2">{m.label}</div>
            <div className="fp-nums mt-1.5 text-[19px] font-bold tracking-[-.5px] text-text">
              {m.done} / {m.target}
            </div>
            <div className="mt-2">
              <Bar pct={m.pct} color={HABIT[m.key].hex} />
            </div>
            <div className="mt-[7px] text-[10px] font-semibold leading-[1.3] text-muted">
              {m.note}
            </div>
          </div>
        ))}
      </Card>

      {/* Cheat meal */}
      <Card className="flex items-center gap-3.5 rounded-[22px] px-[18px] py-4">
        <LetterBadge letter="C" color={HABIT.diet.hex} tint={HABIT.diet.tint} />
        <div className="min-w-0 flex-1">
          <Eyebrow>Next cheat meal · {cheatUsed.label}</Eyebrow>
          <div className="mt-[5px] text-[14.5px] font-bold tracking-[-.2px] text-text">
            {cheat.nextLabel} · {cheat.whenLabel}
          </div>
        </div>
        <button
          onClick={() => setShowCheat((v) => !v)}
          aria-expanded={showCheat}
          className="fp-tap shrink-0 whitespace-nowrap text-[11px] font-bold"
          style={{ color: HABIT.diet.hex }}
        >
          {showCheat ? "Hide" : "Rules"}
        </button>
      </Card>

      {showCheat ? (
        <Card className="-mt-1 rounded-[22px] p-[18px]">
          <p className="text-[12.5px] font-medium leading-[1.55] text-text-2">
            Afternoon meal only. Every other Sunday — one every two weeks, no exceptions.
          </p>
          <div className="mt-3.5 flex gap-2">
            {cheat.slots.map((s) => {
              const isNext = s.date === cheat.next;
              return (
                <div
                  key={s.date}
                  className="flex-1 rounded-[14px] border px-3 py-[11px]"
                  style={{
                    borderColor: isNext ? "rgba(255,180,92,.35)" : "var(--color-line)",
                    background: isNext ? "rgba(255,180,92,.07)" : "transparent",
                  }}
                >
                  <div
                    className="text-[12px] font-bold"
                    style={{ color: isNext ? HABIT.diet.hex : s.past ? "var(--color-muted)" : "var(--color-text-2)" }}
                  >
                    {s.label}
                  </div>
                  <div className="mt-[5px] text-[10px] font-bold uppercase tracking-[.4px] text-muted">
                    {s.state}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ) : null}

      {/* Insights — derived on the client, no extra database work */}
      <InsightsCard board={board} />
    </div>
  );
}
