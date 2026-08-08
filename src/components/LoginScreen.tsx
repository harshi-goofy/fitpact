"use client";

import { useState } from "react";

/**
 * The PIN gate.
 *
 * Four boxes rather than one text field because a 4-digit PIN on a phone
 * should be four taps and nothing else — no keyboard mode switching, no
 * submit button to reach for. Filling the last box submits.
 */
export default function LoginScreen({ onSignedIn }: { onSignedIn: () => void }) {
  const [digits, setDigits] = useState(["", "", "", ""]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(pin: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "That PIN didn't work.");
        setDigits(["", "", "", ""]);
        document.getElementById("pin-0")?.focus();
        return;
      }
      onSignedIn();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  function setAt(i: number, v: string) {
    const d = v.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = d;
    setDigits(next);
    setError(null);

    if (d && i < 3) {
      document.getElementById(`pin-${i + 1}`)?.focus();
    }
    if (d && i === 3) {
      const pin = next.join("");
      if (pin.length === 4) submit(pin);
    }
  }

  function onKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      document.getElementById(`pin-${i - 1}`)?.focus();
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col justify-center px-8">
      <div className="fp-screen">
        <div
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] text-[28px] font-extrabold"
          style={{ background: "var(--color-lime)", color: "var(--color-on-lime)" }}
        >
          F
        </div>

        <h1 className="mt-6 text-center text-[30px] font-extrabold tracking-[-1px] text-text">
          FitPact
        </h1>
        <p className="mt-2 text-center text-[14px] font-semibold text-muted">
          Enter your PIN to continue
        </p>

        <div className="mt-8 flex justify-center gap-3">
          {digits.map((d, i) => (
            <input
              key={i}
              id={`pin-${i}`}
              inputMode="numeric"
              autoComplete="off"
              type="password"
              maxLength={1}
              value={d}
              disabled={busy}
              autoFocus={i === 0}
              onChange={(e) => setAt(i, e.target.value)}
              onKeyDown={(e) => onKeyDown(i, e)}
              className="h-16 w-14 rounded-2xl border-2 bg-card text-center text-[26px] font-extrabold text-text outline-none transition-colors disabled:opacity-50"
              style={{ borderColor: d ? "var(--color-lime)" : "var(--color-line)" }}
            />
          ))}
        </div>

        <div className="mt-5 h-6 text-center">
          {busy ? (
            <span className="text-[13px] font-semibold text-muted">Checking…</span>
          ) : error ? (
            <span className="text-[13px] font-semibold" style={{ color: "#ff8a8a" }}>
              {error}
            </span>
          ) : null}
        </div>

        <p className="mt-6 text-center text-[12px] font-semibold leading-relaxed text-faint">
          Each of you has your own PIN. It decides what you can do — Harshi logs
          the day, Manoj confirms it.
        </p>
      </div>
    </div>
  );
}
