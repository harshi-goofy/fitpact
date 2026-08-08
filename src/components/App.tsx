"use client";

import React, { useCallback, useEffect, useState } from "react";
import type { BoardPayload, HabitKey } from "@/lib/types";
import { EMPTY_ENTRY } from "@/lib/types";
import BadgesScreen from "./BadgesScreen";
import CalendarScreen from "./CalendarScreen";
import LoginScreen from "./LoginScreen";
import PartnerScreen from "./PartnerScreen";
import TodayScreen from "./TodayScreen";
import { HABIT } from "./ui";

type Tab = "today" | "calendar" | "badges" | "partner";

function IconToday({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function IconCalendar({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function IconBadges({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="6" />
      <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11" />
    </svg>
  );
}

function IconTogether({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

const TAB_ICONS: Record<Tab, (props: { size?: number }) => React.ReactElement> = {
  today: IconToday,
  calendar: IconCalendar,
  badges: IconBadges,
  partner: IconTogether,
};

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
  const [confirmBusy, setConfirmBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; bad?: boolean } | null>(null);

  const entry = board.entries[board.today] ?? EMPTY_ENTRY(board.today);
  const isTracker = board.me?.role === "TRACKER";
  const stats = board.stats;

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
      if (!isTracker) {
        setToast({ text: "Only the tracker can log habits.", bad: true });
        return;
      }
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
    [board, busy, entry, isTracker],
  );

  /**
   * The partner ticking a box. Not optimistic — a confirmation changing the
   * streak is exactly the thing that must not flicker back if the write fails.
   */
  const confirm = useCallback(
    async (date: string, kind: "move" | "diet", confirmed: boolean) => {
      const key = `${date}:${kind}`;
      if (confirmBusy) return;
      setConfirmBusy(key);
      try {
        const res = await fetch(`/api/confirm/${date}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind, confirmed }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error ?? "Could not confirm");
        }
        const fresh: BoardPayload = await res.json();
        setBoard(fresh);
        setToast({
          text: confirmed
            ? `${kind === "move" ? "Move" : "Diet"} confirmed · streak ${fresh.stats.streak.count}`
            : `${kind === "move" ? "Move" : "Diet"} unconfirmed`,
        });
      } catch (err) {
        setToast({ text: err instanceof Error ? err.message : "Could not confirm", bad: true });
      } finally {
        setConfirmBusy(null);
      }
    },
    [confirmBusy],
  );

  const signOut = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setBoard((b) => ({ ...b, me: null }));
  }, []);

  // Not signed in — the PIN gate is the whole app until it is satisfied.
  if (!board.me) {
    return <LoginScreen onSignedIn={refresh} />;
  }

  return (
    <div className="mx-auto min-h-dvh w-full max-w-[430px] px-5 pb-28">
      {/* Who's holding the phone, and a way out of it. */}
      <div className="flex items-center justify-between pt-3">
        <span className="text-[11.5px] font-bold uppercase tracking-[1.2px] text-faint">
          {board.me.name} · {board.me.role === "TRACKER" ? "logging" : "confirming"}
        </span>
        <button
          onClick={signOut}
          className="text-[11.5px] font-bold uppercase tracking-[1.2px] text-faint underline-offset-2 active:underline"
        >
          Switch
        </button>
      </div>

      {stats.awaitingConfirm > 0 && tab !== "partner" ? (
        <button
          onClick={() => setTab("partner")}
          className="mt-2 w-full rounded-2xl border px-4 py-3 text-left text-[13px] font-bold"
          style={{ borderColor: "rgba(200,245,66,.35)", background: "rgba(200,245,66,.07)" }}
        >
          <span className="text-lime">{stats.awaitingConfirm}</span>{" "}
          {stats.awaitingConfirm === 1 ? "box" : "boxes"}{" "}
          {board.me.role === "PARTNER" ? "waiting on you" : `waiting on ${board.partner?.name ?? "your partner"}`} →
        </button>
      ) : null}

      {tab === "today" ? (
        <TodayScreen
          board={board}
          entry={entry}
          onToggle={toggle}
          busy={busy}
          canLog={isTracker}
        />
      ) : tab === "calendar" ? (
        <CalendarScreen board={board} onRefresh={refresh} canLog={isTracker} />
      ) : tab === "badges" ? (
        <BadgesScreen board={board} />
      ) : (
        <PartnerScreen board={board} onConfirm={confirm} busyKey={confirmBusy} />
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
            const Icon = TAB_ICONS[t.id];
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                aria-current={active ? "page" : undefined}
                className="relative flex flex-1 flex-col items-center gap-1 py-1.5"
                style={{ color: active ? "var(--color-lime)" : "var(--color-muted)" }}
              >
                <Icon size={22} />
                <span
                  className="text-[12px] font-bold transition-colors"
                  style={{ color: active ? "var(--color-text)" : "var(--color-muted)" }}
                >
                  {t.label}
                </span>
                {t.id === "partner" && stats.awaitingConfirm > 0 ? (
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
