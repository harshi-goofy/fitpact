"use client";

import type { BoardPayload } from "@/lib/types";
import { Card, Eyebrow, HABIT, LetterBadge } from "./ui";

const NEUTRAL = { hex: "#c8f542", tint: "rgba(200,245,66,.14)" };

function paletteFor(habit: string) {
  if (habit === "swim") return HABIT.swim;
  if (habit === "gym") return HABIT.gym;
  if (habit === "diet" || habit === "weight") return HABIT.diet;
  return NEUTRAL;
}

export default function BadgesScreen({ board }: { board: BoardPayload }) {
  const { stats } = board;
  const { streak, badges, badgesEarned, totals } = stats;

  return (
    <div className="fp-screen">
      <header className="pt-3.5 pb-5">
        <Eyebrow>
          {badgesEarned} of {badges.length} earned
        </Eyebrow>
        <h1 className="mt-1 text-[26px] font-bold tracking-[-.5px] text-text">Streaks & badges</h1>
      </header>

      <div className="flex gap-2.5">
        {[
          { v: String(streak.count), l: "Current streak" },
          { v: String(streak.best), l: "Best streak" },
          { v: String(totals.sessions), l: "Total sessions" },
        ].map((s) => (
          <Card key={s.l} className="flex-1 p-3.5">
            <div className="text-[26px] font-extrabold tracking-[-1.2px] text-text">{s.v}</div>
            <div className="mt-0.5 text-[11px] font-semibold leading-tight text-muted">{s.l}</div>
          </Card>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2.5">
        {badges.map((b) => {
          const p = paletteFor(b.habit);
          return (
            <Card
              key={b.id}
              className="flex flex-col gap-2.5 p-4"
              style={{ opacity: b.earned ? 1 : 0.42 }}
            >
              <LetterBadge
                letter={b.letter}
                color={p.hex}
                tint={p.tint}
                filled={b.earned}
                size={44}
              />
              <div>
                <div className="text-sm font-bold text-text">{b.name}</div>
                <div className="mt-0.5 text-xs font-medium leading-snug text-muted">
                  {b.description}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
