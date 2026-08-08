import type { BoardStats } from "@/lib/types";

/**
 * The highest-contrast type on the page. Three numbers side by side rather
 * than one combined score, because a single score lets a strong habit mask a
 * collapsing one — which is exactly the information the board exists to show.
 */
export default function StatHeader({ stats }: { stats: BoardStats }) {
  return (
    <section className="mt-6 rounded-2xl border border-line bg-surface p-4">
      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label="Movement" value={stats.streaks.movement.count} tone="movement" />
        <Stat label="Swim" value={stats.streaks.swim.count} tone="swim" />
        <Stat label="Diet" value={stats.streaks.diet.count} tone="diet" />
      </div>

      <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1 border-t border-line pt-3 text-xs text-muted">
        <span className={stats.gymWeek.noSlack ? "text-warn" : undefined}>
          Gym {stats.gymWeek.done}/{stats.gymWeek.target} wk
        </span>
        <span>
          Swim {stats.swimWeek.done}/{stats.swimWeek.target} wk
        </span>
        <span>Rest {stats.rest.left} left</span>
        <span>Cheat {stats.cheat.left} left</span>
        {stats.metWeekStreak > 0 && (
          <span className="text-movement">
            {stats.metWeekStreak} good {stats.metWeekStreak === 1 ? "week" : "weeks"}
          </span>
        )}
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "movement" | "swim" | "diet";
}) {
  const color =
    tone === "movement" ? "text-movement" : tone === "swim" ? "text-swim" : "text-diet";
  return (
    <div>
      <p className={`text-3xl font-bold tabular-nums leading-none ${color}`}>{value}</p>
      <p className="mt-1 text-[10px] uppercase tracking-wider text-muted">{label}</p>
    </div>
  );
}
