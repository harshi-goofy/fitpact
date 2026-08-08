"use client";

import { useCallback, useEffect, useState } from "react";
import type { BoardPayload, HabitKey } from "@/lib/types";
import { EMPTY_ENTRY } from "@/lib/types";
import BadgesScreen from "./BadgesScreen";
import CalendarScreen from "./CalendarScreen";
import PartnerScreen from "./PartnerScreen";
import TodayScreen from "./TodayScreen";
import { HABIT } from "./ui";

type Tab = "today" | "calendar" | "badges" | "partner";

const TABS: { id: Tab; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "calendar", label: "Calendar" },
  { id: "badges", label: "Badges" },
  { id: "partner", label: "Together" },
];

export default function App({ initial }: { initial: BoardPayload }) {
  const [board, setBoard] = useState(initial);
  const [tab, setTab] = useState<Tab>("today");
  const [busy, setBusy] = useState<HabitKey | null>(null);
  const [posting, setPosting] = useState(false);
  const [toast, setToast] = useState<{ text: string; bad?: boolean } | null>(null);

  const entry = board.entries[board.today] ?? EMPTY_ENTRY(board.today);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1900);
    return () => clearTimeout(t);
  }, [toast]);

  /**
   * The board is the server's word on everything, so a refetch is how any
   * mutation settles. Streaks and month targets can change in ways a single
   * toggle can't imply, and one round trip beats keeping two rule engines.
   */
  const refresh = useCallback(async () => {
    const res = await fetch("/api/board", { cache: "no-store" });
    if (res.ok) setBoard(await res.json());
  }, []);

  /**
   * Optimistic toggle. The tile flips immediately because tapping it at 11pm
   * should feel instant; if the write fails the previous board is put back and
   * a toast says so. It never silently drops the write.
   */
  const toggle = useCallback(
    async (habit: HabitKey) => {
      if (busy) return;
      const field = `${habit}Done` as const;
      const next = !entry[field];
      const snapshot = board;

      setBusy(habit);
      setBoard((b) => ({
        ...b,
        entries: { ...b.entries, [b.today]: { ...entry, [field]: next } },
      }));

      try {
        const res = await fetch(`/api/day/${board.today}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [field]: next }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Save failed");
        const fresh: BoardPayload = await res.json();
        setBoard(fresh);
        setToast({
          text: next
            ? `${HABIT[habit].label} logged · streak ${fresh.stats.streak.count}`
            : `${HABIT[habit].label} cleared`,
        });
      } catch (err) {
        setBoard(snapshot);
        setToast({ text: err instanceof Error ? err.message : "Could not save", bad: true });
      } finally {
        setBusy(null);
      }
    },
    [board, busy, entry],
  );

  const postComment = useCallback(
    async (body: string, cheer: boolean, asPartner: boolean) => {
      setPosting(true);
      try {
        const res = await fetch(`/api/day/${board.today}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body, cheer, asPartner }),
        });
        if (!res.ok) throw new Error("Could not post");
        await refresh();
        setToast({ text: cheer ? "Cheer sent" : "Comment posted" });
      } catch {
        setToast({ text: "Could not post", bad: true });
      } finally {
        setPosting(false);
      }
    },
    [board.today, refresh],
  );

  const deleteComment = useCallback(
    async (id: string) => {
      const snapshot = board;
      setBoard((b) => ({ ...b, comments: b.comments.filter((c) => c.id !== id) }));
      const res = await fetch(`/api/comments/${id}`, { method: "DELETE" });
      if (!res.ok) {
        setBoard(snapshot);
        setToast({ text: "Could not delete", bad: true });
      }
    },
    [board],
  );

  // Opening the tab is the acknowledgement — clear the dot.
  useEffect(() => {
    if (tab !== "partner" || board.unseen === 0) return;
    fetch("/api/comments/seen", { method: "POST" })
      .then(() => setBoard((b) => ({ ...b, unseen: 0 })))
      .catch(() => {});
  }, [tab, board.unseen]);

  return (
    <div className="mx-auto min-h-dvh w-full max-w-[430px] px-5 pb-28">
      {board.unseen > 0 && tab !== "partner" ? (
        <button
          onClick={() => setTab("partner")}
          className="mt-3 w-full rounded-2xl border px-4 py-3 text-left text-[13px] font-bold"
          style={{ borderColor: "rgba(200,245,66,.35)", background: "rgba(200,245,66,.07)" }}
        >
          <span className="text-lime">{board.partner?.name ?? "Your partner"}</span> left{" "}
          {board.unseen} new {board.unseen === 1 ? "message" : "messages"} →
        </button>
      ) : null}

      {tab === "today" ? (
        <TodayScreen board={board} entry={entry} onToggle={toggle} busy={busy} />
      ) : tab === "calendar" ? (
        <CalendarScreen board={board} />
      ) : tab === "badges" ? (
        <BadgesScreen board={board} />
      ) : (
        <PartnerScreen
          board={board}
          onPost={postComment}
          onDelete={deleteComment}
          posting={posting}
        />
      )}

      {toast ? (
        <div
          role="status"
          className="fp-toast fixed bottom-[92px] left-1/2 z-20 rounded-2xl px-4 py-2.5 text-[13px] font-bold shadow-lg"
          style={{
            background: toast.bad ? "#ff8a8a" : "var(--color-lime)",
            color: "var(--color-on-lime)",
          }}
        >
          {toast.text}
        </div>
      ) : null}

      {/* Bottom nav. Fixed, with a fade behind it so content scrolls under. */}
      <nav className="fixed inset-x-0 bottom-0 z-10 flex justify-center bg-gradient-to-t from-screen via-screen/95 to-transparent pt-6">
        <div className="flex w-full max-w-[430px] items-center justify-around px-5 pb-[max(14px,env(safe-area-inset-bottom))]">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                aria-current={active ? "page" : undefined}
                className="relative flex flex-1 flex-col items-center gap-1.5 py-1.5"
              >
                <span
                  className="h-1.5 w-1.5 rounded-[2px] transition-colors"
                  style={{ background: active ? "var(--color-lime)" : "#3a4034" }}
                />
                <span
                  className="text-[11.5px] font-bold transition-colors"
                  style={{ color: active ? "var(--color-text)" : "var(--color-muted)" }}
                >
                  {t.label}
                </span>
                {t.id === "partner" && board.unseen > 0 ? (
                  <span className="absolute right-[22%] top-0 h-1.5 w-1.5 rounded-full bg-lime" />
                ) : null}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
