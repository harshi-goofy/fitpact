"use client";

import { useCallback, useState } from "react";
import CheckIn from "./CheckIn";
import StatHeader from "./StatHeader";
import StreakCalendar from "./StreakCalendar";
import Toast from "./Toast";
import { computeStats } from "@/lib/stats";
import { EMPTY_ENTRY, type BoardPayload, type Entry } from "@/lib/types";

type Patch = Partial<Pick<
  Entry,
  "gymDone" | "walkDone" | "runDone" | "swimDone" | "dietDone" | "isRestDay" | "isCheatDay" | "note" | "weightKg"
>>;

export default function Board({ initial }: { initial: BoardPayload }) {
  const [board, setBoard] = useState<BoardPayload>(initial);
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /**
   * Optimistic write. The toggle flips instantly — at 11pm nobody wants to
   * watch a spinner — and reverts with a toast if the server disagrees.
   *
   * The optimistic stats are recomputed with the same `computeStats` the
   * server uses, so the streak numbers that flash up are the real ones rather
   * than a client-side approximation that drifts.
   */
  const patchDay = useCallback(
    async (date: string, patch: Patch) => {
      const previous = board;

      const nextEntries = {
        ...board.entries,
        [date]: { ...(board.entries[date] ?? EMPTY_ENTRY(date)), ...patch },
      };

      setBoard({
        ...board,
        entries: nextEntries,
        stats: computeStats(nextEntries, board.today, board.settings),
      });
      setSaving(true);

      try {
        const res = await fetch(`/api/day/${date}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });

        if (!res.ok) {
          const { error } = await res.json().catch(() => ({ error: "Could not save." }));
          setBoard(previous);
          setToast(error ?? "Could not save.");
          return;
        }

        // Server truth wins — it may know about token counts or streak history
        // beyond the window the client is holding.
        setBoard(await res.json());
      } catch {
        // Offline. Never silently drop the write.
        setBoard(previous);
        setToast("You're offline — that didn't save.");
      } finally {
        setSaving(false);
      }
    },
    [board],
  );

  const todayEntry = board.entries[board.today] ?? EMPTY_ENTRY(board.today);

  return (
    <main className="mx-auto w-full max-w-md px-4 pb-16 pt-5">
      <header className="mb-4 flex items-baseline justify-between">
        <h1 className="text-lg font-semibold tracking-tight">FitPact</h1>
        <span className="text-xs text-[var(--color-muted)]">
          {saving ? "Saving…" : board.tracker.name}
        </span>
      </header>

      {/* Today is above the fold, always. Everything else exists to make this
          worth opening. */}
      <CheckIn
        date={board.today}
        entry={todayEntry}
        stats={board.stats}
        editable
        onPatch={patchDay}
      />

      <StatHeader stats={board.stats} />

      <StreakCalendar days={board.days} entries={board.entries} today={board.today} />

      {/* The "why" note, surfaced exactly when it matters: the diet streak is
          broken and yesterday was a miss. */}
      {board.settings.whyNote && board.stats.streaks.diet.count === 0 && (
        <section className="mt-6 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
          <p className="text-[11px] uppercase tracking-wider text-[var(--color-muted)]">
            Why you started
          </p>
          <p className="mt-2 text-sm leading-relaxed">{board.settings.whyNote}</p>
        </section>
      )}

      <Toast message={toast} onDismiss={() => setToast(null)} />
    </main>
  );
}
