"use client";

import { badgeProgress } from "@/lib/derive";
import type { BoardPayload } from "@/lib/types";
import InsightsCard from "./InsightsCard";
import { Card, Eyebrow, HABIT, ScreenTitle, StatTile } from "./ui";

/**
 * Earned badges get a solid coloured tile and their own card; locked ones get a
 * grey list row with progress on the right.
 *
 * The asymmetry is the point — a wall of half-faded cards makes what you've
 * done and what you haven't equally loud, and the earned ones should win.
 */
function tintFor(habit: string): string {
  if (habit === "swim") return HABIT.swim.hex;
  if (habit === "gym" || habit === "streak") return HABIT.gym.hex;
  return HABIT.diet.hex;
}

export default function BadgesScreen({ board }: { board: BoardPayload }) {
  const { stats } = board;
  const { streak, badges, badgesEarned, totals } = stats;

  const earned = badges.filter((b) => b.earned);
  const locked = badges.filter((b) => !b.earned);

  return (
    <div className="fp-screen flex flex-col gap-3">
      <ScreenTitle
        eyebrow={`${badgesEarned} of ${badges.length} earned`}
        title="Streaks & badges"
      />

      <div className="flex gap-2.5">
        <StatTile value={String(streak.count)} label="Current streak" color="var(--color-lime)" big />
        <StatTile value={String(streak.best)} label="Best streak" color="#eef0e9" big />
        <StatTile value={String(totals.sessions)} label="Total sessions" color="#eef0e9" big />
      </div>

      {earned.length > 0 ? (
        <>
          <Eyebrow className="mt-2 pl-1">Earned</Eyebrow>
          <div className="grid grid-cols-2 gap-2.5">
            {earned.map((b) => (
              <Card key={b.id} className="rounded-[22px] p-4">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-[13px] text-sm font-extrabold"
                  style={{ background: tintFor(b.habit), color: "#131709" }}
                >
                  {b.letter}
                </div>
                <div className="mt-3.5 text-[13.5px] font-bold tracking-[-.1px]" style={{ color: "#eef0e9" }}>
                  {b.name}
                </div>
                <div className="mt-[3px] text-[11px] font-semibold leading-[1.4] text-muted">
                  {b.description}
                </div>
              </Card>
            ))}
          </div>
        </>
      ) : null}

      {locked.length > 0 ? (
        <>
          <Eyebrow className="mt-2 pl-1">Locked</Eyebrow>
          <div
            className="fp-card rounded-[22px] border px-[18px] py-2"
            style={{ borderColor: "#1c2018" }}
          >
            {locked.map((b, i) => (
              <div
                key={b.id}
                className="flex items-center gap-3.5 py-3"
                style={{
                  borderBottom: i === locked.length - 1 ? "1px solid transparent" : "1px solid #1c2018",
                }}
              >
                <div
                  className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[11px] text-xs font-extrabold"
                  style={{ background: "var(--color-well)", color: "#5a6450" }}
                >
                  {b.letter}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-bold text-text-2">{b.name}</div>
                  <div className="mt-0.5 text-[11px] font-semibold text-faint">{b.description}</div>
                </div>
                {badgeProgress(b.id, stats) ? (
                  <div className="fp-nums shrink-0 text-[10.5px] font-bold text-faint">
                    {badgeProgress(b.id, stats)}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </>
      ) : null}

      <InsightsCard board={board} />
    </div>
  );
}
