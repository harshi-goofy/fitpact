"use client";

import { useState } from "react";
import type { BoardPayload, ConfirmRow } from "@/lib/types";
import { Card, Eyebrow, HABIT } from "./ui";

/**
 * The pact, rendered.
 *
 * Seven rows, Monday to Sunday, two boxes each. Harshi's logging is a claim;
 * this screen is where it becomes a fact. Only the partner's PIN can tick a
 * box, and only while the day is still inside the 24h window — after that the
 * row reads "expired" and the claim is gone for good.
 */

function Box({
  label,
  detail,
  state,
  color,
  onClick,
  disabled,
}: {
  label: string;
  detail: string;
  state: "confirmed" | "pending" | "expired" | "empty" | "rest";
  color: string;
  onClick?: () => void;
  disabled: boolean;
}) {
  const style: Record<string, { bg: string; border: string; fg: string }> = {
    confirmed: { bg: color, border: color, fg: "#12150f" },
    pending: { bg: "rgba(200,245,66,.06)", border: color, fg: color },
    expired: { bg: "transparent", border: "#3a2020", fg: "#8a5a5a" },
    empty: { bg: "transparent", border: "var(--color-line)", fg: "var(--color-faint)" },
    rest: { bg: "rgba(200,245,66,.05)", border: "rgba(200,245,66,.25)", fg: "var(--color-muted)" },
  };
  const s = style[state];

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl border-2 px-2 py-2.5 transition-transform active:scale-[.97] disabled:active:scale-100"
      style={{ background: s.bg, borderColor: s.border, color: s.fg }}
    >
      <span className="text-[13px] font-extrabold leading-none">
        {state === "confirmed" ? "✓ " : ""}
        {label}
      </span>
      <span className="text-[10.5px] font-semibold leading-tight opacity-80">{detail}</span>
    </button>
  );
}

export default function PartnerScreen({
  board,
  onConfirm,
  busyKey,
}: {
  board: BoardPayload;
  onConfirm: (date: string, kind: "move" | "diet", confirmed: boolean) => void;
  busyKey: string | null;
}) {
  const { stats, tracker, me } = board;
  const rows = stats.confirmRows;
  const isPartner = me?.role === "PARTNER";
  const [note, setNote] = useState<string | null>(null);

  function boxState(r: ConfirmRow, kind: "move" | "diet") {
    const logged = kind === "move" ? r.movedLogged : r.dietLogged;
    const confirmed = kind === "move" ? r.moveConfirmed : r.dietConfirmed;
    if (r.isSunday) return "rest" as const;
    if (confirmed) return "confirmed" as const;
    if (!logged) return r.future ? ("empty" as const) : r.expired ? ("expired" as const) : ("empty" as const);
    if (r.confirmable) return "pending" as const;
    return "expired" as const;
  }

  function detailFor(r: ConfirmRow, kind: "move" | "diet") {
    if (r.isSunday) return "rest day";
    if (r.future) return "—";
    const logged = kind === "move" ? r.movedLogged : r.dietLogged;
    const confirmed = kind === "move" ? r.moveConfirmed : r.dietConfirmed;
    if (confirmed) {
      return kind === "move" ? r.moveKinds.map((k) => HABIT[k].label).join(" + ") : "confirmed";
    }
    if (!logged) return "not logged";
    if (r.confirmable) {
      return kind === "move" ? r.moveKinds.map((k) => HABIT[k].label).join(" + ") : "tap to confirm";
    }
    return "expired";
  }

  function handle(r: ConfirmRow, kind: "move" | "diet") {
    if (!isPartner) {
      setNote(`Only ${board.partner?.name ?? "your partner"} can confirm these.`);
      setTimeout(() => setNote(null), 2200);
      return;
    }
    const logged = kind === "move" ? r.movedLogged : r.dietLogged;
    const confirmed = kind === "move" ? r.moveConfirmed : r.dietConfirmed;
    if (!logged || (!r.confirmable && !confirmed)) return;
    onConfirm(r.date, kind, !confirmed);
  }

  return (
    <div className="fp-screen">
      <header className="pt-3.5 pb-5">
        <Eyebrow>
          {stats.awaitingConfirm === 0
            ? "Nothing waiting"
            : `${stats.awaitingConfirm} waiting on you`}
        </Eyebrow>
        <h1 className="mt-1 text-[28px] font-bold tracking-[-.5px] text-text">Together</h1>
        <p className="mt-1.5 text-[13px] font-semibold text-muted">
          {isPartner
            ? `Confirm what ${tracker.name} logged. Unconfirmed by end of the next day and it's gone.`
            : `Waiting on ${board.partner?.name ?? "your partner"} to confirm. You can't tick your own boxes.`}
        </p>
      </header>

      <Card className="p-3.5">
        {/* Column headers */}
        <div className="mb-2 flex items-center gap-2 px-1">
          <div className="w-11 shrink-0" />
          <div className="flex flex-1 gap-2">
            <div className="flex-1 text-center text-[11px] font-bold uppercase tracking-[1.2px] text-muted">
              Move
            </div>
            <div className="flex-1 text-center text-[11px] font-bold uppercase tracking-[1.2px] text-muted">
              Diet
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {rows.map((r) => {
            const rowBusy = busyKey?.startsWith(r.date);
            return (
              <div
                key={r.date}
                className="flex items-center gap-2"
                style={{ opacity: r.future ? 0.4 : rowBusy ? 0.6 : 1 }}
              >
                {/* Day label */}
                <div className="w-11 shrink-0">
                  <div
                    className="text-[14px] font-extrabold leading-none"
                    style={{ color: r.isToday ? "var(--color-lime)" : "var(--color-text)" }}
                  >
                    {r.dayLetter}
                  </div>
                  <div className="mt-0.5 text-[10.5px] font-semibold text-faint">
                    {r.date.slice(8)}
                    {r.isToday ? " ·now" : ""}
                  </div>
                </div>

                <div className="flex flex-1 gap-2">
                  <Box
                    label="Move"
                    detail={detailFor(r, "move")}
                    state={boxState(r, "move")}
                    color={HABIT.gym.hex}
                    onClick={() => handle(r, "move")}
                    disabled={r.future || rowBusy === true}
                  />
                  <Box
                    label="Diet"
                    detail={detailFor(r, "diet")}
                    state={boxState(r, "diet")}
                    color={HABIT.diet.hex}
                    onClick={() => handle(r, "diet")}
                    disabled={r.future || rowBusy === true}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {note ? (
        <p
          className="mt-3 rounded-2xl border px-4 py-3 text-[13px] font-bold"
          style={{ borderColor: "rgba(255,138,138,.35)", color: "#ff8a8a" }}
        >
          {note}
        </p>
      ) : null}

      {/* Legend */}
      <Card className="mt-3 p-4">
        <Eyebrow className="mb-2.5">How it works</Eyebrow>
        <ul className="flex flex-col gap-2 text-[12.5px] font-semibold leading-snug text-text-2">
          <li>
            <span className="text-lime">1.</span> {tracker.name} logs Move (swim or gym) and Diet on
            the Today screen.
          </li>
          <li>
            <span className="text-lime">2.</span> {board.partner?.name ?? "The partner"} taps the
            matching boxes here to confirm them.
          </li>
          <li>
            <span className="text-lime">3.</span> Only confirmed days count toward the streak,
            calendar and monthly targets.
          </li>
          <li>
            <span style={{ color: "#ff8a8a" }}>4.</span> Not confirmed by the end of the next day?
            The claim expires and is lost.
          </li>
        </ul>
      </Card>
    </div>
  );
}
