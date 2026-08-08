"use client";

import { useState } from "react";
import { formatDayLabel } from "@/lib/timezone";
import type { BoardPayload } from "@/lib/types";
import { Card, Eyebrow } from "./ui";

const CHEERS = ["Proud of you 💪", "Great week", "Keep going", "That's the one"];

function relativeTime(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export default function PartnerScreen({
  board,
  onPost,
  onDelete,
  posting,
}: {
  board: BoardPayload;
  onPost: (body: string, cheer: boolean, asPartner: boolean) => Promise<void>;
  onDelete: (id: string) => void;
  posting: boolean;
}) {
  const { comments, tracker, partner, today } = board;
  // No login, so who is speaking is an explicit choice rather than a guess.
  const [asPartner, setAsPartner] = useState(true);
  const [draft, setDraft] = useState("");

  const canPost = partner !== null;
  const authorName = asPartner ? (partner?.name ?? "Partner") : tracker.name;

  // Newest day first; within a day, oldest message first, like a thread.
  const byDay = comments.reduce<Record<string, typeof comments>>((acc, c) => {
    (acc[c.date] ??= []).push(c);
    return acc;
  }, {});
  const dates = Object.keys(byDay).sort().reverse();

  async function submit(body: string, cheer: boolean) {
    const text = body.trim();
    if (!text || posting) return;
    await onPost(text.slice(0, 500), cheer, asPartner);
    setDraft("");
  }

  return (
    <div className="fp-screen">
      <header className="pt-3.5 pb-5">
        <Eyebrow>{comments.length === 0 ? "Nothing yet" : `${comments.length} messages`}</Eyebrow>
        <h1 className="mt-1 text-[26px] font-bold tracking-[-.5px] text-text">Together</h1>
      </header>

      {!canPost ? (
        <Card className="p-5 text-[13px] font-semibold text-muted">
          No partner account yet. Run{" "}
          <code className="text-text">npm run db:seed</code> to create one.
        </Card>
      ) : (
        <Card className="p-4">
          {/* Who's writing. Two people, no auth — so just ask. */}
          <div className="flex gap-1.5 rounded-2xl bg-[#1b1f19] p-1">
            {[
              { label: partner?.name ?? "Partner", v: true },
              { label: tracker.name, v: false },
            ].map((o) => (
              <button
                key={String(o.v)}
                onClick={() => setAsPartner(o.v)}
                className="flex-1 rounded-xl px-3 py-2 text-[12.5px] font-bold transition-colors"
                style={{
                  background: asPartner === o.v ? "var(--color-lime)" : "transparent",
                  color: asPartner === o.v ? "var(--color-on-lime)" : "var(--color-muted)",
                }}
              >
                {o.label}
              </button>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {CHEERS.map((c) => (
              <button
                key={c}
                onClick={() => submit(c, true)}
                disabled={posting}
                className="rounded-full border border-line px-3 py-1.5 text-[12px] font-bold text-text-2 transition-colors active:border-lime disabled:opacity-50"
              >
                {c}
              </button>
            ))}
          </div>

          <div className="mt-3 flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, 500))}
              placeholder={`Say something to ${asPartner ? tracker.name : partner?.name}…`}
              rows={2}
              className="flex-1 resize-none rounded-2xl border border-line bg-[#1b1f19] px-3.5 py-2.5 text-[13px] font-medium text-text outline-none placeholder:text-faint focus:border-line-hover"
            />
            <button
              onClick={() => submit(draft, false)}
              disabled={posting || draft.trim() === ""}
              className="rounded-2xl bg-lime px-4 py-2.5 text-[13px] font-bold text-on-lime disabled:opacity-35"
            >
              Send
            </button>
          </div>
          <p className="mt-1.5 text-[11px] font-semibold text-faint">
            Posting as {authorName} · on {formatDayLabel(today)}
          </p>
        </Card>
      )}

      {dates.length === 0 ? (
        <p className="mt-6 text-center text-[13px] font-semibold text-faint">
          Comments land here. Any day, any time — no edit window.
        </p>
      ) : (
        dates.map((date) => (
          <section key={date} className="mt-5">
            <Eyebrow>{formatDayLabel(date)}</Eyebrow>
            <div className="mt-2 flex flex-col gap-2">
              {byDay[date].map((c) => (
                <Card
                  key={c.id}
                  className="px-4 py-3"
                  style={
                    c.cheer
                      ? { borderColor: "rgba(200,245,66,.35)", background: "rgba(200,245,66,.06)" }
                      : undefined
                  }
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[12px] font-bold text-lime">{c.authorName}</span>
                    <span className="shrink-0 text-[11px] font-semibold text-faint">
                      {relativeTime(c.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 text-[13.5px] font-medium leading-snug text-text">{c.body}</p>
                  <button
                    onClick={() => onDelete(c.id)}
                    className="mt-1.5 text-[11px] font-semibold text-faint underline-offset-2 hover:underline"
                  >
                    Delete
                  </button>
                </Card>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
