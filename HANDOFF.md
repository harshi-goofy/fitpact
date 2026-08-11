# FitPact — session handoff (v3, post-deploy + accountability rebuild)

## What this is

**FitPact**: a private accountability board for swim/gym/diet, built for two
people — **Harshi (tracker)** and **Manoj (partner)**. Dark near-black + lime,
Archivo font, four-tab bottom nav.

The user (Manoj) is **not technical**. Give exact commands to paste, explain
what success looks like, don't assume Terminal/npm/git knowledge. He does not
know what Neon vs Vercel do — explain in plain terms when it comes up.

## ⚠️ START HERE — the one thing that matters

**The code in `~/Desktop/fitpact` is well ahead of what's deployed and ahead of
the database schema.** Everything below was written and unit-tested this
session but the user **has not yet run the migration commands**. Nothing from
"Partner confirmation" onward is live.

First thing in the new session: ask whether he ran these. If not, walk him
through them one at a time:

```bash
cd ~/Desktop/fitpact
echo "AUTH_SECRET=\"$(openssl rand -hex 32)\"" >> .env
npm run db:push
npx prisma generate      # <- clears the 6 expected TS errors
npm run db:seed
npm run dev
```

Then, once it renders correctly in his browser:

```bash
git add -A && git commit -m "Partner confirmation, PIN auth, rewards" && git push
```

And finally: **add `AUTH_SECRET` to Vercel** → Project Settings → Environment
Variables, same value as in `.env`, then redeploy. Login will silently fall
back to a hardcoded dev secret without it, which works but is not what we want
in production.

## Deployment (done and working)

- **Live**: `fitpact-tau.vercel.app`
- **GitHub**: `harshi-goofy/fitpact`, branch `main`
- **Vercel project**: `fitpact` under account `harshithar976-5578` (Hobby).
  Two duplicate projects (`fitpact.`, `fitpact-68`) were created by accident
  and deleted.
- **Database**: Neon, connected via `DATABASE_URL`. Uploaded to Vercel with
  the "Import .env" button — **not** committed to git.
- Push to `main` → Vercel auto-redeploys in ~1 minute. No manual step.
- Git auth was a sticking point: he couldn't paste a PAT into the terminal
  password prompt. Solved with `brew install gh` + `gh auth login` (browser
  flow). Don't send him back to personal access tokens.

## Decisions made this session (don't relitigate)

Confirmed directly with the user:

- **Targets are weekly, not monthly**: swim 4, gym 5, diet 7 **per week**. The
  `Settings.monthlyXTarget` columns now hold *weekly* values and
  `buildMonthTargets` multiplies by weeks-in-month. Column names are stale —
  left alone deliberately to avoid a migration for a rename.
- **Swim and gym never show decimals.** Pace notes use `Math.ceil` for those
  two; diet still shows one decimal place.
- **Weight is logged on the Calendar tab**, any day in the current month (not
  restricted to today/yesterday like habits). A small orange dot marks days
  with a weight entry. Feeds the Today screen automatically.
- **Weight card restructured**: only "Target this month" + current weight +
  on-track/off-track are visible. Everything else — progress bar, stats,
  week-by-week table, monthly plan — is behind a "Weight details ▾" expander.
- **Comments and cheers were removed from the Together tab entirely** and
  replaced with the confirmation grid below. The `Comment` model, its API
  routes and the `unseen` field still exist in the codebase but nothing
  renders them. Harmless dead code; safe to delete if it ever gets in the way.
- **Cheat meals are every other Sunday**, on a rolling 14-day cadence anchored
  at `CHEAT_ANCHOR = "2026-08-16"` in `src/lib/timezone.ts`. Not "2nd and 4th",
  not "1st and 3rd" — he explicitly asked for a rolling alternate rhythm.
  **Accepted consequence**: a month can contain two *or three* cheat Sundays,
  because the cadence doesn't reset on the 1st. He was told this and chose it
  anyway. To shift the rhythm, change `CHEAT_ANCHOR` to any Sunday you want.
- **Rewards every 2.5 kg**, four of them:

  | kg down | at weight | reward |
  |---|---|---|
  | 2.5 | 85.5 kg | New makeup brush set |
  | 5 | 83 kg | Weekend getaway |
  | 7.5 | 80.5 kg | Bobbi Brown cream |
  | 10 | 78 kg | International trip |

- **Icons added to the bottom nav** (inline SVGs in `App.tsx`, feather-style).
- **Font sizes bumped ~1–1.5px** across the board.

### Carried over from the previous session, still true

- Tracker is Harshi, Manoj is the partner.
- One combined streak. Every Sunday auto-satisfies it (rest day).
- Walk and Run don't exist. Only Swim / Gym / Diet.
- Weight plan: 88 kg → 78 kg by 1 Jan 2027, ~0.48 kg/week.
- No email or push nudges. Still deferred, still needs Resend / a service worker.

## The big change: partner confirmation + PIN auth

This is the heart of the session and the thing most likely to need follow-up.

### The mechanic

1. Harshi logs Move (swim and/or gym) and Diet on the Today screen. This is a
   **claim**, not a fact.
2. Manoj opens the **Together** tab: seven rows (Mon–Sun of the current week),
   two boxes each — Move and Diet.
3. He taps a box to confirm. Confirming "Move" validates whatever she logged
   for that day (swim, gym, or both); confirming "Diet" validates diet.
4. **Only confirmed days count** toward the streak, calendar heat, month
   targets and lifetime totals.
5. **The window is 24h** — the day itself and the day after. Miss it and the
   claim **expires and is lost**. He chose this over a softer option.

### Guard rails already built

- **Editing a claim clears its confirmation.** If Harshi logs gym, gets it
  confirmed, then also ticks swim, the move confirmation resets — otherwise
  the swim would arrive pre-confirmed without Manoj ever seeing it. Handled in
  `PATCH /api/day/[date]`.
- **Role enforcement is server-side, not just UI.** `requireRole("TRACKER")`
  on the logging and weight routes, `requireRole("PARTNER")` on the confirm
  route. Disabling a button is a courtesy; these routes are the actual rule.
- **The confirm route re-checks the window** rather than trusting the client.

### PIN auth

He asked how hard real user identity would be, and picked the 4-digit PIN
option over secret URLs / magic links / honor system.

- `User.pinHash` — SHA-256 of a 4-digit PIN.
- **Harshi = `1111`, Manoj = `2222`.** Set in the editable block at the top of
  `prisma/seed.ts`. He may well want to change these; re-seed after editing.
- `src/lib/auth.ts` — signed httpOnly cookie (`fitpact_session`), HMAC'd with
  `AUTH_SECRET` so it can't be hand-edited to promote yourself to PARTNER.
  One-year expiry. Falls back to a dev constant if the env var is missing.
- `LoginScreen.tsx` — four boxes, auto-advance, submits on the last digit.
  Gates the entire app; `App.tsx` returns it when `board.me` is null.
- A "Switch" link in the header logs out, for testing both roles on one device.
- This is **not** bank-grade and was never sold as such. It makes
  self-validation a deliberate act rather than a tap. That was the stated goal.

## Where the code lives

`~/Desktop/fitpact` on the user's Mac (mounted in Cowork).

## Architecture

- `prisma/schema.prisma`
  - `User` gained `pinHash String?`
  - `DayEntry` gained `moveConfirmedAt DateTime?` / `dietConfirmedAt DateTime?`
  - New `Reward` model: `kgLost Float @unique`, `label`, `claimedAt DateTime?`
  - All new columns are **nullable**, so plain `db:push` works — no
    `--force-reset` needed this time.
- `src/lib/timezone.ts` — added `isConfirmable`, `CHEAT_ANCHOR`, rewrote
  `isCheatSunday` / `cheatSundays` / `nextCheatSunday` for the rolling cadence.
  Positive-modulo helper so dates *before* the anchor work too.
- `src/lib/stats.ts` — the one place all rules live.
  - `daySatisfied` now requires **confirmed** move AND **confirmed** diet.
  - New: `moveLogged/moveConfirmed/dietLogged/dietConfirmed`, `dayExpired`,
    `buildConfirmRows`, `buildRewards`.
  - `countInMonth`, `heatLevel` and lifetime totals all filter on confirmation.
  - `computeStats` takes a 4th arg, `rewardSeeds`.
- `src/lib/auth.ts` — new. PIN hashing, signed cookie, `requireUser`,
  `requireRole`, `AuthError`.
- `src/lib/board.ts` — loads reward rows and the current user; `BoardPayload`
  gained `me: { id, name, role } | null`.
- `src/components/`
  - `App.tsx` — nav icons, auth gate, `confirm` and `claimReward` handlers,
    role-aware banner. `PartnerScreen` props changed completely.
  - `PartnerScreen.tsx` — **fully rewritten** as the 7-row grid. No comments.
  - `TodayScreen.tsx` — pending/confirmed tile states, collapsible weight card,
    new rewards card.
  - `CalendarScreen.tsx` — weight input + dot indicator, `canLog` prop.
  - `LoginScreen.tsx` — new.
  - `ui.tsx` — new `RewardTrack` (bar with dots on it, not under it).
- `src/app/api/`
  - New: `auth/login`, `auth/logout`, `auth/me`, `confirm/[date]`,
    `day/[date]/weight`, `rewards/[id]`
  - `day/[date]` — now TRACKER-only, and resets confirmations on edit.

## Verification done

- **51/51 unit tests pass** (`src/lib/stats.test.ts`), including 12 new ones
  for confirmation/expiry and 10 for rewards. Run via a throwaway sandbox copy
  with `npm i -D tsx`, not the user's `node_modules` — those are macOS-built
  and can't run in the agent's Linux shell.
- `tsc --noEmit` leaves **exactly 6 errors, all from the stale Prisma client**
  (`pinHash`, `moveConfirmedAt`, `dietConfirmedAt`, `prisma.reward`, plus one
  knock-on `implicit any` in `board.ts` where the `Promise.all` tuple breaks).
  **These clear on `npx prisma generate`.** If any *other* error appears after
  generate, that's real and needs looking at.
- The agent sandbox **cannot** reach Prisma's binary CDN (403) or Google Fonts.
  Neither affects the user's machine. Don't chase these.
- **Nothing has been visually confirmed in a browser since the redesign.** All
  verification is unit tests and typechecking.

## Next steps

1. **Run the migration commands at the top of this file.** Nothing else
   matters until that's done.
2. **Smoke test both roles.** Log in as `1111`, log swim + diet on Today,
   confirm the tiles read "Awaiting ✓". Hit "Switch", log in as `2222`, open
   Together, tick both boxes for today, confirm the streak increments and the
   Today tiles flip to "Confirmed". Check the partner genuinely *cannot* log
   habits and the tracker genuinely *cannot* confirm.
3. **Check the reward bar renders** — four dots at clean quarter marks, the
   next one ringed. At 88 kg nothing is earned yet, so it should read
   "2.5 kg to New makeup brush set".
4. **Confirm the cheat card** shows the next cheat Sunday as 16 Aug 2026 (or
   later, depending on when the session runs) and that 9 Aug reads as a plain
   rest Sunday.
5. `prisma/seed.ts` still has the placeholder email `harshi@example.com`.
   Flagged twice now, never resolved. Only matters if email is ever built.

## Not built (still open)

- Email nudges / reminders / weekly recap (Resend) — deferred.
- Web push — deferred.
- Milestone celebration animations. Badges and rewards derive live; nothing
  fires a confetti moment. The `Milestone` model exists unused if wanted.
- Photo proof upload UI (schema + API support exist, no UI).
- Settings screen. Targets, weight plan, PINs and rewards are all editable
  only by hand-editing the block at the top of `prisma/seed.ts` and re-running
  `npm run db:seed`. **This is the most likely next request** — it's currently
  the only way to change a PIN or a reward, and it needs a terminal.
- Nothing lets you see *history* beyond the current week on Together, or
  confirm a day whose window has closed. By design, but worth knowing.
