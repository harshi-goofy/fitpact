"use client";

/**
 * Insights — derived entirely on the client from the entry map the board
 * already sends.
 *
 * Deliberately no new API route, no new column and no extra query. Everything
 * here is a different reading of data that has already crossed the wire, which
 * is why the card costs nothing on a metered database.
 *
 * The rules mirror src/lib/stats.ts: a day counts only when the partner has
 * confirmed it. An unconfirmed claim is not a workout as far as this card is
 * concerned, exactly as it isn't for the streak.
 */

import { addDays, isSunday } from "@/lib/timezone";
import type { BoardPayload } from "@/lib/types";
import { ALERT, Card, Chip, Eyebrow, HABIT, Ring } from "./ui";

const WINDOW = 28; // four clean weeks — long enough to be a habit, short enough to be current

export default function InsightsCard({ board }: { board: BoardPayload }) {
  const { entries, today } = board;

  // Yesterday backwards. Today is still open, so including it would drag every
  // percentage down for most of the day.
  const window: string[] = [];
  for (let i = 1; i <= WINDOW; i++) window.push(addDays(today, -i));

  const moveOk = (k: string) => {
    const e = entries[k];
    return !!e && (e.swimDone || e.gymDone) && e.moveConfirmedAt !== null;
  };
  const dietOk = (k: string) => {
    const e = entries[k];
    return !!e && e.dietDone && e.dietConfirmedAt !== null;
  };
  const fullDay = (k: string) => moveOk(k) && dietOk(k);

  /* -------------------------------------------------- consistency */
  // Sundays are free by design, so counting them would inflate this to
  // meaninglessness — a 14% floor for doing nothing at all.
  const workDays = window.filter((k) => !isSunday(k));
  const hitDays = workDays.filter(fullDay).length;
  const consistency = workDays.length ? hitDays / workDays.length : 0;

  /* -------------------------------------------------- confirmation rate */
  // Of the days something was actually claimed, how many survived the window?
  // A low number here is a Manoj problem, not a Harshi problem — worth surfacing.
  const claimedDays = window.filter((k) => {
    const e = entries[k];
    return !!e && (e.swimDone || e.gymDone || e.dietDone);
  });
  const confirmedDays = claimedDays.filter((k) => moveOk(k) || dietOk(k)).length;
  const confirmRate = claimedDays.length ? confirmedDays / claimedDays.length : 1;
  const lostClaims = claimedDays.length - confirmedDays;

  /* -------------------------------------------------- swim / gym split */
  const swims = window.filter((k) => entries[k]?.swimDone && entries[k]?.moveConfirmedAt).length;
  const gyms = window.filter((k) => entries[k]?.gymDone && entries[k]?.moveConfirmedAt).length;
  const moves = swims + gyms;

  /* -------------------------------------------------- strongest weekday */
  // Mon-indexed to match weekStart() elsewhere in the app.
  const names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const tally = names.map(() => ({ hit: 0, total: 0 }));
  for (const k of workDays) {
    const dow = (new Date(`${k}T00:00:00.000Z`).getUTCDay() + 6) % 7;
    tally[dow].total++;
    if (fullDay(k)) tally[dow].hit++;
  }
  let bestDow = -1;
  let bestRate = 0;
  let worstDow = -1;
  let worstRate = 1.01;
  tally.forEach((t, i) => {
    if (t.total < 2) return; // one sample is an anecdote, not a pattern
    const rate = t.hit / t.total;
    if (rate > bestRate) {
      bestRate = rate;
      bestDow = i;
    }
    if (rate < worstRate) {
      worstRate = rate;
      worstDow = i;
    }
  });

  // The weight trend lives on the Today card's sparkline; repeating it here
  // would be the same line twice on one scroll.
  const nothingYet = hitDays === 0 && claimedDays.length === 0;
  if (nothingYet) return null;

  return (
    <Card className="rounded-3xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <Eyebrow>Last 4 weeks</Eyebrow>
          <div className="mt-1.5 text-[15px] font-bold text-text">
            {consistency >= 0.85
              ? "Locked in"
              : consistency >= 0.6
                ? "Holding steady"
                : consistency >= 0.3
                  ? "Patchy"
                  : "Just getting going"}
          </div>
        </div>
        <Ring pct={consistency} color="var(--color-lime)">
          <span className="fp-nums text-[15px] font-extrabold leading-none text-text">
            {Math.round(consistency * 100)}
          </span>
          <span className="text-[9px] font-bold text-muted">%</span>
        </Ring>
      </div>

      <p className="mt-1 text-[12.5px] font-semibold text-faint">
        {hitDays} of {workDays.length} non-Sunday days fully confirmed
      </p>

      {/* Move split */}
      {moves > 0 ? (
        <div className="mt-4 border-t border-line pt-4">
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] font-bold text-text">Move split</span>
            <span className="fp-nums text-[12.5px] font-bold text-text-2">{moves} sessions</span>
          </div>
          <div className="mt-2.5 flex h-2.5 overflow-hidden rounded-full bg-line">
            <div
              style={{ width: `${(swims / moves) * 100}%`, background: HABIT.swim.hex }}
              className="transition-[width] duration-500"
            />
            <div
              style={{ width: `${(gyms / moves) * 100}%`, background: HABIT.gym.hex }}
              className="transition-[width] duration-500"
            />
          </div>
          <div className="mt-2 flex gap-2">
            <Chip color={HABIT.swim.hex} tint={HABIT.swim.tint}>
              {swims} swim
            </Chip>
            <Chip color={HABIT.gym.hex} tint={HABIT.gym.tint}>
              {gyms} gym
            </Chip>
          </div>
        </div>
      ) : null}

      {/* Weekday pattern */}
      {bestDow >= 0 && bestRate > 0 ? (
        <div className="mt-4 border-t border-line pt-4">
          <span className="text-[13px] font-bold text-text">Your pattern</span>
          <p className="mt-1 text-[12.5px] font-semibold leading-relaxed text-faint">
            <span className="text-lime">{names[bestDow]}s</span> are your strongest at{" "}
            {Math.round(bestRate * 100)}%
            {worstDow >= 0 && worstDow !== bestDow && worstRate < bestRate ? (
              <>
                {" "}
                · <span style={{ color: ALERT }}>{names[worstDow]}s</span> slip most at{" "}
                {Math.round(worstRate * 100)}%
              </>
            ) : null}
            .
          </p>
        </div>
      ) : null}

      {/* Claims lost to an expired window — the accountability leak */}
      {lostClaims > 0 ? (
        <div className="mt-4 border-t border-line pt-4">
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] font-bold text-text">Confirmed in time</span>
            <span className="fp-nums text-[12.5px] font-bold text-text-2">
              {Math.round(confirmRate * 100)}%
            </span>
          </div>
          <p className="mt-1 text-[12.5px] font-semibold text-faint">
            {lostClaims} {lostClaims === 1 ? "day" : "days"} logged but never confirmed — those are
            gone for good.
          </p>
        </div>
      ) : null}
    </Card>
  );
}
