"use client";

import { useState } from "react";
import type { BoardPayload, ConfirmRow } from "@/lib/types";
import { ALERT, Card, Eyebrow, HABIT, ScreenTitle } from "./ui";

/**
 * The pact, rendered.
 *
 * Seven rows, two boxes each. Harshi's logging is a claim; this screen is where
 * it becomes a fact. Only the partner's PIN can tick a box, and only while the
 * day is still inside the 24h window — after that the claim is gone for good.
 *
 * The grid is a real CSS grid rather than seven flex rows so the MOVE and DIET
 * columns stay aligned no matter how long a sub-label runs.
 */

type CellState = "confirmed" | "claimed" | "rest" | "empty" | "expired" | "future";

function cellVisuals(state: CellState): { bg: string; border: string; fg: string; sub: string } {
  switch (state) {
    case "confirmed":
      return {
        bg: "var(--color-lime)",
        border: "var(--color-lime)",
        fg: "var(--color-on-lime)",
        sub: "rgba(19,23,9,.6)",
      };
    case "claimed":
      return {
        bg: "rgba(203,240,63,.07)",
        border: "var(--color-lime)",
        fg: "var(--color-lime)",
        sub: "var(--color-text-2)",
      };
    case "rest":
      return { bg: "rgba(203,240,63,.04)", border: "#3b451f", fg: "#6b7462", sub: "#3f4839" };
    case "expired":
      return { bg: "transparent", border: "#3a2020", fg: "#8a5a5a", sub: "#6d4444" };
    case "future":
      return { bg: "transparent", border: "#1e2219", fg: "#3f4839", sub: "#3f4839" };
    default:
      return { bg: "transparent", border: "#1e2219", fg: "#6b7462", sub: "#3f4839" };
  }
}

function Cell({
  label,
  sub,
  state,
  onClick,
  busy,
}: {
  label: string;
  sub: string;
  state: CellState;
  onClick?: () => void;
  busy: boolean;
}) {
  const v = cellVisuals(state);
  const actionable = !!onClick;
  return (
    <button
      onClick={onClick}
      disabled={!actionable || busy}
      aria-pressed={state === "confirmed"}
      className="fp-tap box-border rounded-[14px] border-[1.5px] px-2 py-[13px] text-center disabled:cursor-default"
      style={{ background: v.bg, borderColor: v.border }}
    >
      <div className="text-[13px] font-bold leading-[1.2]" style={{ color: v.fg }}>
        {label}
      </div>
      <div className="mt-[3px] text-[10.5px] font-semibold" style={{ color: v.sub }}>
        {busy ? "…" : sub}
      </div>
    </button>
  );
}

const HOW_STEPS = [
  "Harshi logs Move (swim or gym) and Diet on the Today screen.",
  "Manoj taps the matching boxes here to confirm them.",
  "Only confirmed days count toward the streak, calendar and monthly targets.",
  "Not confirmed by the end of the next day? The claim expires and is lost.",
];

export default function PartnerScreen({
  board,
  onConfirm,
  busyKey,
}: {
  board: BoardPayload;
  onConfirm: (date: string, kind: "move" | "diet", confirmed: boolean) => void;
  busyKey: string | null;
}) {
  const [showHow, setShowHow] = useState(true);
  const { stats } = board;
  const rows = stats.confirmRows;
  const isPartner = board.me?.role === "PARTNER";
  const waiting = stats.awaitingConfirm;

  /** What a single box should look like and whether it can be tapped. */
  function describe(row: ConfirmRow, kind: "move" | "diet") {
    const logged = kind === "move" ? row.movedLogged : row.dietLogged;
    const confirmed = kind === "move" ? row.moveConfirmed : row.dietConfirmed;
    const label = kind === "move" ? "Move" : "Diet";

    if (confirmed) {
      const names = kind === "move" ? row.moveKinds.map((k) => HABIT[k].label).join(" + ") : "Diet";
      return { state: "confirmed" as CellState, label, sub: "confirmed", title: names, act: true };
    }
    if (row.future) return { state: "future" as CellState, label, sub: "—", act: false };
    if (logged && row.confirmable) {
      const names = kind === "move" ? row.moveKinds.map((k) => HABIT[k].label).join(" + ") : "Logged";
      return { state: "claimed" as CellState, label, sub: names, act: true };
    }
    if (logged && row.expired) return { state: "expired" as CellState, label, sub: "expired", act: false };
    if (row.isSunday) return { state: "rest" as CellState, label, sub: "rest day", act: false };
    return { state: "empty" as CellState, label, sub: "not logged", act: false };
  }

  return (
    <div className="fp-screen flex flex-col gap-3">
      <ScreenTitle
        eyebrow={waiting > 0 ? `${waiting} waiting on ${board.partner?.name ?? "your partner"}` : "All caught up"}
        eyebrowColor={waiting > 0 ? "var(--color-lime)" : undefined}
        title="Together"
        sub={
          isPartner
            ? "Tap a claimed box to confirm it. Only what you confirm counts."
            : `Waiting on ${board.partner?.name ?? "your partner"} to confirm. You can't tick your own boxes.`
        }
      />

      <Card className="rounded-3xl px-4 py-[18px]">
        <div className="grid items-center gap-[7px]" style={{ gridTemplateColumns: "44px 1fr 1fr" }}>
          <div />
          <div
            className="pb-1 text-center text-[9.5px] font-bold tracking-[1.4px]"
            style={{ color: "#535c4c" }}
          >
            MOVE
          </div>
          <div
            className="pb-1 text-center text-[9.5px] font-bold tracking-[1.4px]"
            style={{ color: "#535c4c" }}
          >
            DIET
          </div>

          {rows.map((row) => {
            const move = describe(row, "move");
            const diet = describe(row, "diet");
            return (
              <div key={row.date} className="contents">
                <div className="pr-1.5">
                  <div
                    className="text-[13px] font-bold leading-[1.2]"
                    style={{ color: row.isToday ? "var(--color-lime)" : "var(--color-text-2)" }}
                  >
                    {row.dayLetter}
                  </div>
                  <div className="fp-nums mt-[3px] text-[10.5px] font-semibold text-faint">
                    {row.isToday ? `${Number(row.date.slice(8))} · now` : Number(row.date.slice(8))}
                  </div>
                </div>

                {(["move", "diet"] as const).map((kind) => {
                  const d = kind === "move" ? move : diet;
                  const key = `${row.date}:${kind}`;
                  // Only the partner can act, and only on a box that is
                  // claimed-and-open or already confirmed (to undo it).
                  const canAct = isPartner && d.act;
                  return (
                    <Cell
                      key={key}
                      label={d.label}
                      sub={d.sub}
                      state={d.state}
                      busy={busyKey === key}
                      onClick={
                        canAct
                          ? () => onConfirm(row.date, kind, d.state !== "confirmed")
                          : undefined
                      }
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="rounded-[22px] px-[18px] py-4">
        <button
          onClick={() => setShowHow((v) => !v)}
          aria-expanded={showHow}
          className="fp-tap flex w-full items-center justify-between"
        >
          <Eyebrow>How it works</Eyebrow>
          <span className="text-[11px] font-bold text-lime">{showHow ? "Hide" : "Show"}</span>
        </button>

        {showHow ? (
          <ol className="mt-[15px] flex flex-col gap-[11px]">
            {HOW_STEPS.map((text, i) => (
              <li key={text} className="flex gap-2.5">
                <span
                  className="w-3 shrink-0 text-[12.5px] font-extrabold"
                  style={{ color: i === 3 ? ALERT : "var(--color-lime)" }}
                >
                  {i + 1}.
                </span>
                <span className="text-[12.5px] font-medium leading-[1.5] text-text-2">{text}</span>
              </li>
            ))}
          </ol>
        ) : null}
      </Card>
    </div>
  );
}
