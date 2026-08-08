# FitPact — session handoff (v2, post-redesign)

## What this is

**FitPact**: a private accountability board for swim/gym/diet. Originally a
two-person PRD-driven build (see `PRD.md`, now superseded in most particulars
below); it was then **fully redesigned** to match a design handoff
(`Fitness tracking with streaks.zip` — dark near-black + lime, Archivo font,
four-tab bottom nav) the user uploaded mid-session. This file describes the
**current, redesigned app**, not the original PRD.

The user is **not technical**. Give exact commands to paste, explain what
success looks like, don't assume Terminal/npm/git knowledge.

## Decisions made in the redesign (don't relitigate)

Confirmed directly with the user:

- **Tracker is Harshi**, not Manoj. Manoj is the partner. (Seed file reflects this.)
- **One combined streak**, not three. Rule: **`dietDone AND (swimDone OR gymDone)`**
  on a given day. **Every Sunday auto-satisfies the streak** (rest day), no
  matter what was logged.
- **Walk and Run were dropped entirely.** Only Swim / Gym / Diet exist now, as
  three booleans on `DayEntry`.
- **No rest/cheat tokens.** Cheat meals are **calendar-derived**: the 2nd and
  4th Sunday of every month, afternoon only, always exactly two per month.
  Nothing to spend, nothing that can run out or drift out of sync.
- **Partner tab added** ("Together"): comments + one-tap cheers on any day
  (comments are never subject to the edit window). No login, so the UI has an
  explicit "posting as Harshi / posting as Manoj" switch. New partner messages
  show a lime dot on the nav tab + a banner on Today; opening the tab clears it.
- **No email/push nudges built.** Discussed with the user — email needs Resend
  setup, push needs a service worker + permission prompt, both deferred.
  Nudge UI reduced to the in-app unseen-comment indicator only.
- **Weight plan is real, not a placeholder.** Start **88 kg → goal 78 kg by
  1 Jan 2027**, linear pace **0.48 kg/week**, with per-month checkpoints
  back-calculated and shown in an expandable "Monthly plan" list. "Needed per
  week" recalculates from wherever the user actually is (rises if behind).
- **Monthly session targets**: swim 16, gym 20, diet 28 per month (user-specified,
  not the design mockup's numbers). Progress bars + pace note ("X to go · Y per
  week keeps you on track") on the Today screen.
- **Badges**: 12, all derived live from entries — no separate "shown" tracking
  needed yet since nothing fires a celebration animation (that's a possible
  future addition, not built).

## Where the code lives

`~/Desktop/fitpact` on the user's Mac (folder is mounted/connected in Cowork).

## Architecture after the redesign

- `prisma/schema.prisma` — `DayEntry` now has just `swimDone / gymDone / dietDone`
  (+ note/photo/weight). `isRestDay`, `isCheatDay`, `walkDone`, `runDone` are
  **gone**. `Settings` gained `monthlySwimTarget/monthlyGymTarget/monthlyDietTarget`,
  `startWeightKg`, `goalWeightKg`, `goalDate`. `Comment` gained `cheer: Boolean`
  and `seenAt: DateTime?`. `Nudge` gained `seenAt`.
- `src/lib/timezone.ts` — added calendar-fact helpers: `isSunday`,
  `sundaysInMonth`, `cheatSundays` (2nd + 4th Sunday), `nextCheatSunday`,
  `daysInMonth`, `daysLeftInMonth`. Same `DateKey` string discipline as before.
- `src/lib/stats.ts` — **fully rewritten**. Single streak rule
  (`daySatisfied`), month targets, the weight back-calculation
  (`buildWeightPlan`), cheat plan, badge derivation, calendar heat level. Still
  the one place all rules live; API and UI both call into it.
- `src/lib/stats.test.ts` — **25 tests**, all passing (verified in a sandboxed
  Linux copy since the user's local `node_modules` are macOS-built and can't
  run in the agent's Linux shell — tests were copied out, run with a fresh
  `npm i -D tsx typescript`, confirmed green, then the real file was updated).
- `src/lib/board.ts` — loader now also returns `partner`, `comments`, `unseen`.
- `src/components/` — old `Board.tsx`, `CheckIn.tsx`, `StatHeader.tsx`,
  `StreakCalendar.tsx`, `Toast.tsx` **deleted**. New: `App.tsx` (shell, tabs,
  optimistic toggle, toast), `TodayScreen.tsx`, `CalendarScreen.tsx`,
  `BadgesScreen.tsx`, `PartnerScreen.tsx`, `ui.tsx` (shared design-system
  primitives: `Card`, `Bar`, `LetterBadge`, `HABIT` color map, etc).
- `src/app/api/` — `PATCH /api/day/[date]` simplified (no token-budget checks
  left). Added `POST /api/day/[date]/comments`, `DELETE /api/comments/[id]`,
  `POST /api/comments/seen`.
- `src/app/globals.css` — new design tokens matching the handoff exactly
  (`--color-lime: #c8f542`, `--color-screen: #0b0d0c`, swim/gym/diet hues,
  4-level heat scale). `src/app/layout.tsx` uses `next/font/google` Archivo.

## Verification already done

- 25/25 unit tests pass (run via a throwaway sandbox copy, not the user's
  actual `node_modules` — see above).
- `tsc --noEmit` clean (verified in a parallel sandbox build with a hand-rolled
  Prisma client type stub, since the real `prisma generate` can't reach
  Prisma's binary CDN from the agent's sandbox).
- `next build` (Turbopack) completes successfully — compiled, typechecked,
  all routes collected — verified with a stubbed `@prisma/client` runtime and
  a locally-stubbed font (the sandbox can't reach Google Fonts either; this
  does **not** affect the user's real machine, which has normal internet).
- Confirmed generated CSS actually contains the design's exact values:
  `border-radius:28px`, `font-size:78px`, `max-width:430px`,
  `letter-spacing:-4px`, the lime/card/screen color vars, etc.

## Where the user is right now

Migrating an **existing** local Neon database from the old schema to the new
one. Sequence of errors hit and resolved, in order:

1. `prisma db push` refused because `goalDate` is a new required column with
   existing rows in `Settings` → told user to use `--force-reset` (acceptable
   since there's no real logged history yet).
2. After force-reset + reseed, `page.tsx` errored
   `Cannot read properties of undefined (reading 'toISOString')` — diagnosed
   as a **stale generated Prisma client** (dev server was still running the
   client generated before the schema change) → told user to stop `npm run
   dev`, run `npx prisma generate`, restart.
3. Next error: **`The column 'Settings.monthlySwimTarget' does not exist in
   the current database`** — this reveals the force-reset in step 1 either
   didn't actually run against the real Neon DB, or ran against stale
   `.env`/branch. Client is now correct; **the database itself still has the
   old schema**.

**Last instruction given, not yet confirmed successful:**

```bash
npm run db:push -- --force-reset
npm run db:seed
```

then restart `npm run dev` and reload.

## Next steps for the new session

1. **Confirm the force-reset actually landed.** Ask the user what happened
   after running the two commands above. If `db:push --force-reset` still
   doesn't apply cleanly, check: is `DATABASE_URL` in `.env` pointing at the
   Neon project `68kgs` reliably (no typos from earlier copy-paste)? Is there
   more than one `.env` file being loaded (dev vs prod)?
2. Once the board loads: **smoke test** — tap Swim/Gym/Diet tiles, confirm
   streak updates, confirm refresh persists state, check the Calendar tab
   heat grid renders, check Badges tab, check Together tab (post a comment as
   both "authors", confirm the unseen dot behavior).
3. **`prisma/seed.ts` placeholder email** — `harshi@example.com` is a
   placeholder. Flagged to the user already; worth confirming a real address
   before this goes anywhere with email features (not built yet, but the field
   exists).
4. **Not yet re-verified end-to-end on the user's actual machine** — all
   build/test verification above was done in the agent's sandbox on copies of
   the code, not on the user's Mac. Once the DB issue is resolved, confirm
   `npm run dev` actually renders correctly in their browser (screenshot or
   description), since fonts/prisma-generate behave differently there (in a
   good way — real internet access) but haven't been visually confirmed.
5. **Deployment (Vercel) not yet done for the redesigned version.** Original
   HANDOFF.md covered Vercel setup for the old build; same steps apply
   (import repo, add env vars via "Import .env", deploy), but hasn't been
   walked again since the redesign. GitHub repo `harshi-goofy/fitpact` was
   created and pushed once already (pre-redesign, or possibly still empty —
   confirm) — will need a fresh commit/push once the app is confirmed working
   locally.

## Not built (still open, matches original PRD's "not built yet" list plus new items)

- Email nudges / reminders / weekly recap (Resend) — explicitly deferred this
  session.
- Web push nudges — explicitly deferred this session.
- Milestone celebration animations (confetti/banner) — badges are derived
  live but nothing "fires" an event; would need a `Milestone` shown-tracking
  mechanism if added.
- Photo proof upload UI (schema/API support exists from the original build,
  no UI wired to it in the redesigned screens).
- Settings screen (targets/weight-plan are currently only editable by hand-
  editing the block at the top of `prisma/seed.ts` and re-running
  `npm run db:seed`).
