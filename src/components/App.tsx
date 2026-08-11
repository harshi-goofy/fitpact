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

/* Nav icons, traced from the design handoff: 21px, 1.9 stroke, round caps. */
function Svg({ size, children }: { size: number; children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

function IconToday({ size = 21 }: { size?: number }) {
  return (
    <Svg size={size}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5.5 9.5V20h13V9.5" />
      <path d="M9.8 20v-5.4h4.4V20" />
    </Svg>
  );
}

function IconCalendar({ size = 21 }: { size?: number }) {
  return (
    <Svg size={size}>
      <rect x="3.5" y="5" width="17" height="16" rx="3" />
      <path d="M3.5 9.5h17M8 3.2v3.4M16 3.2v3.4" />
    </Svg>
  );
}

function IconBadges({ size = 21 }: { size?: number }) {
  return (
    <Svg size={size}>
      <circle cx="12" cy="9" r="5.6" />
      <path d="M8.6 13.6 7.4 21l4.6-2.5 4.6 2.5-1.2-7.4" />
    </Svg>
  );
}

function IconTogether({ size = 21 }: { size?: number }) {
  return (
    <Svg size={size}>
      <circle cx="9" cy="8.4" r="3.4" />
      <path d="M3.4 19.4c0-3.1 2.5-5.2 5.6-5.2s5.6 2.1 5.6 5.2" />
      <path d="M16.2 5.6a3.2 3.2 0 0 1 0 6M17.6 14.6c2.1.5 3.4 2.2 3.4 4.8" />
    </Svg>
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
  const [claimBusy, setClaimBusy] = useState<string | null>(null);
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

  const claimReward = useCallback(
    async (id: string, claimed: boolean) => {
      setClaimBusy(id);
      try {
        const res = await fetch(`/api/rewards/${id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ claimed }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error ?? "Could not update");
        }
        setBoard(await res.json());
        if (claimed) setToast({ text: "Reward claimed 🎉" });
      } catch (err) {
        setToast({ text: err instanceof Error ? err.message : "Could not update", bad: true });
      } finally {
        setClaimBusy(null);
      }
    },
    [],
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
    <div className="mx-auto min-h-dvh w-full max-w-[430px] px-[18px] pb-28">
      {/* Who's holding the phone, and a way out of it. The awaiting count used
          to live here too; the streak hero's pill says it better and in the
          place you already look. */}
      <div className="flex items-center justify-between pt-3">
        <span className="text-[10.5px] font-bold uppercase tracking-[1.4px] text-faint">
          {board.me.name} · {board.me.role === "TRACKER" ? "logging" : "confirming"}
        </span>
        <button
          onClick={signOut}
          className="text-[10.5px] font-bold uppercase tracking-[1.4px] text-faint underline-offset-2 active:underline"
        >
          Switch
        </button>
      </div>

      {tab === "today" ? (
        <TodayScreen
          board={board}
          entry={entry}
          onToggle={toggle}
          busy={busy}
          canLog={isTracker}
          onClaimReward={claimReward}
          claimBusy={claimBusy}
          onGoTogether={() => setTab("partner")}
          onFlash={(text) => setToast({ text })}
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
          className="fp-toast fixed bottom-[100px] left-1/2 z-20 w-[calc(100%-40px)] max-w-[390px] rounded-[18px] px-[18px] py-[15px] text-[13px] font-bold"
          style={{
            background: toast.bad ? "#f9736b" : "var(--color-lime)",
            color: "var(--color-on-lime)",
            boxShadow: "0 14px 34px rgba(0,0,0,.55)",
          }}
        >
          {toast.text}
        </div>
      ) : null}

      {/* Bottom nav. Fixed, with a fade behind it so content scrolls under. */}
      <nav
        className="fixed inset-x-0 bottom-0 z-10 flex justify-center pt-6"
        style={{ background: "linear-gradient(to top, #0b0d0c 62%, rgba(11,13,12,0))" }}
      >
        <div className="flex w-full max-w-[430px] items-center px-3 pb-[max(22px,env(safe-area-inset-bottom))]">
          {TABS.map((t) => {
            const active = tab === t.id;
            const Icon = TAB_ICONS[t.id];
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                aria-current={active ? "page" : undefined}
                className="fp-tap relative flex flex-1 flex-col items-center gap-1.5 py-1.5"
                style={{ color: active ? "var(--color-lime)" : "#6b7462" }}
              >
                <Icon size={21} />
                <span className="text-[10.5px] font-bold tracking-[.2px]">{t.label}</span>
                {t.id === "partner" && stats.awaitingConfirm > 0 ? (
                  <span
                    className="absolute h-[7px] w-[7px] rounded-full bg-lime"
                    style={{ top: -2, right: "calc(50% - 20px)" }}
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
