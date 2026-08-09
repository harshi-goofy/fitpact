import type { HabitKey } from "@/lib/types";

/**
 * The one place a habit maps to a colour.
 *
 * Position and hue are fixed everywhere in the app — quick-log tiles, month
 * targets, calendar detail, badges — because the whole value of a glanceable
 * board is that you learn where a colour lives and stop reading labels.
 */
export const HABIT: Record<HabitKey, { label: string; letter: string; hex: string; tint: string }> = {
  swim: { label: "Swim", letter: "S", hex: "#5ad9ff", tint: "rgba(90,217,255,.14)" },
  gym: { label: "Gym", letter: "G", hex: "#c8f542", tint: "rgba(200,245,66,.14)" },
  diet: { label: "Diet", letter: "D", hex: "#ffb45c", tint: "rgba(255,180,92,.14)" },
};

export const HABIT_ORDER: HabitKey[] = ["swim", "gym", "diet"];

export const HEAT = ["#22261f", "#3f5b1a", "#8ab52c", "#c8f542"] as const;

export function Card({
  children,
  className = "",
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-3xl border border-line bg-card ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

/** The small uppercase eyebrow used above every number in the design. */
export function Eyebrow({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`text-[12px] font-bold uppercase tracking-[1.4px] text-muted ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionHeading({ title, aside }: { title: string; aside?: string }) {
  return (
    <div className="mt-7 mb-3 flex items-baseline justify-between">
      <h2 className="text-[18px] font-bold tracking-[-.2px] text-text">{title}</h2>
      {aside ? <span className="text-[13.5px] font-semibold text-muted">{aside}</span> : null}
    </div>
  );
}

/** Thin progress bar. `pct` is 0–1 and is clamped here so callers can be sloppy. */
export function Bar({ pct, color, height = 6 }: { pct: number; color: string; height?: number }) {
  const w = Math.min(Math.max(pct, 0), 1) * 100;
  return (
    <div
      className="overflow-hidden rounded-full bg-line"
      style={{ height }}
      role="progressbar"
      aria-valuenow={Math.round(w)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full transition-[width] duration-500 ease-out"
        style={{ width: `${w}%`, background: color }}
      />
    </div>
  );
}

/**
 * The reward track: one bar, one dot per reward.
 *
 * The dots sit *on* the bar rather than under it, so the fill sweeping past a
 * dot is the moment of unlocking — the bar and the milestones are one object,
 * not a chart with a legend. Earned dots go solid lime; the one you're working
 * toward gets a ring so your eye lands on it first.
 */
export function RewardTrack({
  pct,
  rewards,
  nextId,
}: {
  pct: number;
  rewards: { id: string; pos: number; earned: boolean; claimed: boolean }[];
  nextId?: string | null;
}) {
  const w = Math.min(Math.max(pct, 0), 1) * 100;
  return (
    <div className="relative py-2.5">
      <div className="h-2 overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out"
          style={{ width: `${w}%`, background: "var(--color-lime)" }}
        />
      </div>

      {rewards.map((r) => {
        const isNext = r.id === nextId;
        const size = r.earned ? 16 : isNext ? 15 : 11;
        return (
          <div
            key={r.id}
            className="absolute top-1/2 transition-all duration-500"
            style={{
              left: `${r.pos * 100}%`,
              width: size,
              height: size,
              marginLeft: -size / 2,
              marginTop: -size / 2,
              borderRadius: 999,
              background: r.earned ? "var(--color-lime)" : "var(--color-screen)",
              border: r.earned
                ? "2px solid var(--color-screen)"
                : isNext
                  ? "2px solid var(--color-lime)"
                  : "2px solid var(--color-line-hover)",
              boxShadow: isNext && !r.earned ? "0 0 0 4px rgba(200,245,66,.15)" : undefined,
            }}
            aria-hidden
          />
        );
      })}
    </div>
  );
}

/** The rounded-square letter badge used for habits and achievements. */
export function LetterBadge({
  letter,
  color,
  tint,
  filled = false,
  size = 38,
}: {
  letter: string;
  color: string;
  tint: string;
  filled?: boolean;
  size?: number;
}) {
  return (
    <div
      className="flex shrink-0 items-center justify-center font-extrabold"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.34,
        background: filled ? color : tint,
        color: filled ? "#12150f" : color,
        fontSize: size * 0.4,
      }}
      aria-hidden
    >
      {letter}
    </div>
  );
}

export function StatBlock({
  value,
  label,
  color = "var(--color-text)",
}: {
  value: string;
  label: string;
  color?: string;
}) {
  return (
    <div className="flex-1">
      <div className="text-[17px] font-bold tracking-[-.3px]" style={{ color }}>
        {value}
      </div>
      <div className="mt-0.5 text-[12px] font-semibold text-muted">{label}</div>
    </div>
  );
}
