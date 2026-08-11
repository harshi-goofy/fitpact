import type { HabitKey } from "@/lib/types";

/**
 * The one place a habit maps to a colour.
 *
 * Position and hue are fixed everywhere in the app — quick-log tiles, month
 * targets, calendar detail, badges — because the whole value of a glanceable
 * board is that you learn where a colour lives and stop reading labels.
 *
 * Values come from the design handoff and are final.
 */
export const HABIT: Record<HabitKey, { label: string; letter: string; hex: string; tint: string }> = {
  swim: { label: "Swim", letter: "S", hex: "#5ecfe8", tint: "rgba(94,207,232,.13)" },
  gym: { label: "Gym", letter: "G", hex: "#cbf03f", tint: "rgba(203,240,63,.13)" },
  diet: { label: "Diet", letter: "D", hex: "#ffb45c", tint: "rgba(255,180,92,.13)" },
};

export const HABIT_ORDER: HabitKey[] = ["swim", "gym", "diet"];

export const HEAT = ["#22261e", "#41591f", "#88b52f", "#cbf03f"] as const;

export const ALERT = "#f9736b";

export function Card({
  children,
  className = "",
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`fp-card rounded-3xl border border-line ${className}`} {...rest}>
      {children}
    </div>
  );
}

/**
 * The small uppercase eyebrow used above every number in the design.
 * 10px / 700 / 1.6px tracking is a fixed pairing in the spec — the size and the
 * tracking are tuned to each other, so they travel together in one component
 * rather than being retyped per screen.
 */
export function Eyebrow({
  children,
  className = "",
  color = "var(--color-eyebrow)",
}: {
  children: React.ReactNode;
  className?: string;
  color?: string;
}) {
  return (
    <div
      className={`text-[10px] font-bold uppercase tracking-[1.6px] ${className}`}
      style={{ color }}
    >
      {children}
    </div>
  );
}

/** The screen title used at the top of Calendar, Badges and Together. */
export function ScreenTitle({
  eyebrow,
  title,
  eyebrowColor,
  aside,
  sub,
}: {
  eyebrow: string;
  title: string;
  eyebrowColor?: string;
  aside?: React.ReactNode;
  sub?: string;
}) {
  return (
    <header className="flex items-end justify-between pt-[18px] pb-0.5">
      <div>
        <Eyebrow className="tracking-[1.6px]" color={eyebrowColor}>
          {eyebrow}
        </Eyebrow>
        <h1 className="mt-[3px] text-[25px] font-bold tracking-[-.6px] text-text">{title}</h1>
        {sub ? (
          <p className="mt-2 max-w-[300px] text-[13px] font-medium leading-[1.5] text-text-2">
            {sub}
          </p>
        ) : null}
      </div>
      {aside ? <div className="pb-1">{aside}</div> : null}
    </header>
  );
}

/** Thin progress bar. `pct` is 0–1 and is clamped here so callers can be sloppy. */
export function Bar({ pct, color, height = 4 }: { pct: number; color: string; height?: number }) {
  const w = Math.min(Math.max(pct, 0), 1) * 100;
  return (
    <div
      className="overflow-hidden rounded-full"
      style={{ height, background: "var(--color-heat-0)" }}
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
 * The reward ladder: one 88 kg → 78 kg track with a pin per reward.
 *
 * The pins sit *on* the track rather than under it, so the fill sweeping past
 * a pin is the moment of unlocking — the bar and the milestones are one object,
 * not a chart with a legend. The next pin is ringed in lime so the eye lands on
 * the thing being worked toward rather than on the ones already banked.
 */
export function RewardTrack({
  pct,
  rewards,
  nextId,
}: {
  pct: number;
  rewards: { id: string; pos: number; kgLost: number; earned: boolean }[];
  nextId?: string | null;
}) {
  const w = Math.min(Math.max(pct, 0), 1) * 100;
  return (
    <div className="relative mt-6 h-[34px]">
      <div
        className="absolute inset-x-0 top-[5px] h-1 rounded-full"
        style={{ background: "var(--color-heat-0)" }}
      />
      <div
        className="absolute left-0 top-[5px] h-1 rounded-full transition-[width] duration-700 ease-out"
        style={{ width: `${w}%`, background: "var(--color-lime)" }}
      />
      {rewards.map((r) => {
        const isNext = r.id === nextId;
        return (
          <div
            key={r.id}
            className="absolute top-0 flex -translate-x-1/2 flex-col items-center gap-1.5"
            style={{ left: `${Math.min(Math.max(r.pos, 0), 1) * 100}%` }}
          >
            <div
              className="box-border h-3.5 w-3.5 rounded-full border-2 transition-colors duration-500"
              style={{
                background: r.earned ? "var(--color-lime)" : "var(--color-input)",
                borderColor: r.earned || isNext ? "var(--color-lime)" : "#2f3628",
              }}
            />
            <div
              className="whitespace-nowrap text-[9.5px] font-bold"
              style={{ color: isNext || r.earned ? "var(--color-text-2)" : "var(--color-faint)" }}
            >
              −{r.kgLost}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** The rounded-square letter tile used for habits, rewards and badges. */
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
        color: filled ? "#131709" : color,
        fontSize: size * 0.38,
      }}
      aria-hidden
    >
      {letter}
    </div>
  );
}

/** The compact number-over-label card used on Calendar and Badges. */
export function StatTile({
  value,
  label,
  color = "var(--color-text)",
  big = false,
}: {
  value: string;
  label: string;
  color?: string;
  big?: boolean;
}) {
  return (
    <Card className="flex-1 px-3.5 py-4">
      <div
        className={`fp-nums font-bold ${big ? "text-2xl tracking-[-1px]" : "text-[21px] tracking-[-.7px]"}`}
        style={{ color }}
      >
        {value}
      </div>
      <div className="mt-[5px] text-[10.5px] font-semibold leading-tight text-muted">{label}</div>
    </Card>
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
      <div className="fp-nums text-[17px] font-bold tracking-[-.3px]" style={{ color }}>
        {value}
      </div>
      <div className="mt-0.5 text-[12px] font-semibold text-muted">{label}</div>
    </div>
  );
}

/**
 * A minimal trend line. No axes, no grid, no labels.
 *
 * At this size a sparkline answers exactly one question — "which way is it
 * going" — and any chrome added to it competes with that answer. Fewer than
 * two points is not a trend, so it renders nothing rather than a misleading
 * flat line.
 *
 * Stretches to fill its container via a non-uniform viewBox, which is why the
 * stroke uses vector-effect to stay an honest 2px.
 */
export function Sparkline({
  values,
  color = "var(--color-lime)",
  height = 40,
}: {
  values: number[];
  color?: string;
  height?: number;
}) {
  if (values.length < 2) return null;

  // A little headroom top and bottom so the endpoint dot never clips.
  const lo = Math.min(...values) - 0.3;
  const hi = Math.max(...values) + 0.3;
  const span = hi - lo || 1;
  const y = (v: number) => 36 - ((v - lo) / span) * 32;

  const pts = values
    .map((v, i) => `${((i * 200) / (values.length - 1)).toFixed(1)},${y(v).toFixed(1)}`)
    .join(" ");
  const lastTop = `${((y(values[values.length - 1]) / 40) * 100).toFixed(1)}%`;

  return (
    <div className="relative flex-1" style={{ height }}>
      <svg
        viewBox="0 0 200 40"
        preserveAspectRatio="none"
        style={{ width: "100%", height, display: "block" }}
        aria-hidden
      >
        <polyline
          points={pts}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div
        className="absolute h-2 w-2 -translate-y-1/2 rounded-full"
        style={{ right: -1, top: lastTop, background: color, boxShadow: "0 0 0 3px var(--color-card)" }}
        aria-hidden
      />
    </div>
  );
}

/**
 * A circular progress ring, used on the Insights card for percentages that are
 * a *quality* rather than a *quantity*. A bar implies distance toward an end;
 * a ring implies how full a thing is right now, which is the right metaphor
 * when there is no finish line.
 */
export function Ring({
  pct,
  size = 62,
  stroke = 6,
  color = "var(--color-lime)",
  children,
}: {
  pct: number;
  size?: number;
  stroke?: number;
  color?: string;
  children?: React.ReactNode;
}) {
  const clamped = Math.min(Math.max(pct, 0), 1);
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-heat-0)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - clamped)}
          style={{ transition: "stroke-dashoffset 700ms ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

/** Small pill for a label-value pair. */
export function Chip({
  children,
  color = "var(--color-text-2)",
  tint = "var(--color-well)",
}: {
  children: React.ReactNode;
  color?: string;
  tint?: string;
}) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold"
      style={{ background: tint, color }}
    >
      {children}
    </span>
  );
}

/**
 * A card whose header is the toggle. Used for "All rewards", "Rules" and
 * "How it works" — three places the spec uses the same disclosure gesture with
 * a lime or amber word on the right instead of a chevron.
 */
export function Disclosure({
  open,
  onToggle,
  openLabel,
  closedLabel,
  accent = "var(--color-lime)",
  children,
  header,
  className = "",
}: {
  open: boolean;
  onToggle: () => void;
  openLabel: string;
  closedLabel: string;
  accent?: string;
  children: React.ReactNode;
  header: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="fp-tap flex w-full items-center justify-between gap-3 text-left"
      >
        {header}
        <span className="whitespace-nowrap text-[11px] font-bold" style={{ color: accent }}>
          {open ? openLabel : closedLabel}
        </span>
      </button>
      {open ? children : null}
    </div>
  );
}
