# FitPact — Product Requirements Document

**A private, two-person accountability board for gym and diet.**

Version 1.0 · Owner: Manoj · Status: Ready to build

---

## 1. Summary

FitPact is a small private web app shared by two people: **Manoj** (the one tracking gym and diet) and **his husband** (the accountability partner). Manoj checks in each day. His husband sees the board, comments, and nudges when a day goes unchecked.

The whole product is one page you open on your phone every evening. Everything else exists to make that one page worth opening.

### Why this shape

- **Visibility beats willpower.** A blank square that someone else can see is a stronger motivator than a private reminder.
- **Every day has a move in it.** Movement is a daily streak, but the bar on a tired day is a walk, not a workout. A streak only survives if the floor is reachable on your worst day.
- **Intensity is a weekly quota, not a daily demand.** Gym has to happen ≥5 days a week; walking or running covers the rest. The daily streak protects consistency, the weekly quota protects effort.
- **Planned indulgence beats failed restriction.** Cheat days and rest days are budgeted resources you spend, not failures you hide.

### Success criteria

| Metric | Target |
|---|---|
| Days checked in, first 30 days | ≥ 25 / 30 |
| Partner engagement | ≥ 1 comment or nudge per week |
| Still in use after 90 days | Yes — this is the real test |

---

## 2. Users

| User | Role | What they do |
|---|---|---|
| Manoj | `TRACKER` | Checks in daily, logs weight, uploads proof photos, reads comments |
| Husband | `PARTNER` | Views the board, comments on days, sends nudges, gets the weekly recap |

There are exactly two accounts. There is no signup, no user management, no invites. Accounts are seeded once at setup.

The data model is user-scoped (`DayEntry.userId`) so a second tracker can be enabled later without a migration. **v1 UI shows one tracker only.**

---

## 3. Non-goals

Explicitly out of scope for v1. Do not build these:

- Calorie counting, macro tracking, or a food database
- Workout logging (sets, reps, weights, exercise library)
- Wearable / Apple Health / Google Fit integration
- Native mobile apps
- More than two users, or any social feed
- Public sharing or profile pages

---

## 4. Core concepts and rules

These rules are the product. Get them exactly right.

### 4.1 What a "day" is

- A day is a **calendar date in a single fixed timezone**, set by the `APP_TIMEZONE` env var. Default `Asia/Kolkata`.
- Never use the browser's timezone or the server's local time for date logic. Always resolve "today" through `APP_TIMEZONE`.
- All dates are stored as a date-only value (no time component).

### 4.2 Edit window

- **Today and yesterday are editable.** Anything older is read-only.
- Rationale: you can catch up after falling asleep, but you cannot retroactively rewrite last week to protect a streak. This is the difference between a tracker and an accountability tool.
- Read-only days render greyed with a lock icon; the API rejects writes with `403`.
- Comments are **not** subject to the edit window — the partner can comment on any past day.

### 4.3 The three daily streaks

FitPact tracks **three independent daily streaks**. Each is computed the same way — consecutive days where the condition holds — and each is displayed as its own number.

| Streak | Condition for the day to count |
|---|---|
| **Movement** | `gymDone` **or** `walkDone` **or** `runDone` **or** `isRestDay` |
| **Swim** | `swimDone` **or** `isRestDay` |
| **Diet** | `dietDone` **or** `isCheatDay` |

Universal rules for all three:

- A day failing the condition breaks that streak to `0`. Streaks are independent — breaking Swim does not touch Movement.
- **Today never breaks a streak until the day is over.** An unchecked today renders as *pending*, not as a break. A streak shown mid-afternoon must not read `0` because the evening has not happened yet.
- Streak math is computed backwards from **yesterday**, then today is added if already satisfied.

### 4.4 Movement — daily floor, weekly gym quota

This is the central mechanic. Two rules operating on the same data at different timescales:

**Daily (the streak).** Every day needs gym, a walk, or a run. Any one of the three satisfies it. The floor is deliberately low — on a bad day a 20-minute walk keeps the streak alive, which is the entire point of having a floor.

**Weekly (the quota).** `weeklyGymTarget` (default `5`) gym days per week, Monday–Sunday in `APP_TIMEZONE`. Walking and running satisfy the daily streak but **do not** count toward the gym quota — they are what the remaining ≤2 days look like.

- The board shows both, always together: `Gym 3/5 this week` alongside `Movement 12 days`.
- A week is **met** when gym days ≥ target. Met weeks accumulate into a *weekly* streak ("4 good weeks in a row").
- Gym, walk, and run are **independent booleans, not a single choice.** A day can be both a gym day and a walk. Do not model this as one enum — it silently discards real activity.
- **Live quota pressure.** From Thursday onward, if the remaining days in the week are fewer than the gym days still needed, show the quota in a warning state: *"2 gym days left, 2 days remaining — no slack."* This is the nudge that actually changes behavior, and it must appear before the week is already lost.

### 4.5 Swim — daily streak

- `swimDone` is its own toggle and its own daily streak, independent of movement.
- `weeklySwimTarget` defaults to `7`, and the board shows `Swim 6/7 this week` alongside the streak.
- Swimming does **not** satisfy the Movement streak, and movement does not satisfy Swim. They are separate commitments and blending them would let one hide the other's misses.

> **A flag, not a blocker.** Gym 5×/week *plus* a daily swim *plus* a daily walk-or-run is a genuinely demanding load — the most likely failure mode for this app is the Swim streak breaking in week two and the whole board starting to feel like a record of failure. Rest tokens (§4.6) are sized to absorb that. If Swim keeps breaking after a month, the fix is to drop `weeklySwimTarget` to 4 or 5 and show it as a weekly quota like gym, rather than to abandon the board. The schema supports that change without a migration.

### 4.6 Rest days and cheat days — the grace mechanics

Two budgets, each mapping to a real-world thing. Both reset on the 1st of the month in `APP_TIMEZONE`.

**Rest tokens** — `monthlyRestTokens`, default `4`.
- Marking a day `isRestDay` spends one token and preserves **both** the Movement and Swim streaks for that day. A rest day is a whole rest day; that is what makes it one decision instead of two.
- A rest day does **not** contribute to the weekly gym quota.
- It does **not** affect the Diet streak — you still eat on a rest day.

**Cheat tokens** — `monthlyCheatTokens`, default `4`.
- Marking a day `isCheatDay` spends one token and preserves the Diet streak.
- Independent of rest tokens; a day can be both.

Shared rules:
- At zero tokens the toggle is disabled with an explicit message — *"No rest days left this month"* — never silently inert.
- Un-marking within the edit window refunds the token.
- **Tokens are never a stored counter.** Remaining = `monthlyRestTokens − count(entries this month where isRestDay)`. A derived value cannot drift out of sync with the entries.
- There is no separate "streak freeze". These two budgets are the only grace mechanics — two rules that each mean something beat three that overlap.

### 4.7 Weight

- Optional, at most one entry per day, in kilograms, one decimal place.
- The chart shows **raw points plus a 7-day moving average**, with the average as the visually dominant line. Daily weight is noise; the trend is the signal.
- The moving average needs ≥ 3 points in the window to render.

---

## 5. Features

### F1 — Daily check-in (must have)

The top of the page, above the fold, is today. Five toggles, **grouped so the structure of the rules is visible in the layout**:

```
┌─ MOVEMENT ──────────── streak 12 ─┐
│   [  Gym  ] [ Walk ] [  Run  ]    │   ← one of three satisfies the day
│   Gym 3/5 this week               │   ← quota, always visible under the group
└───────────────────────────────────┘
┌─ SWIM ────────────────  streak 6 ─┐
│   [        Swim ✓        ]        │
└───────────────────────────────────┘
┌─ DIET ───────────────── streak 23 ┐
│   [        Diet ✓        ]        │
└───────────────────────────────────┘
      [ Rest day 3 left ] [ Cheat day 2 left ]
```

- Gym / Walk / Run sit in one visually bounded group because they are **alternatives for the same daily goal**. Swim and Diet are separate groups because they are separate commitments. A flat row of five equal buttons would hide the rule structure and is wrong.
- Primary toggles minimum **56px** tall, thumb-reachable. Multiple selections allowed — gym *and* a walk is a normal day.
- Tap toggles. Optimistic UI: state flips instantly, reverts with a toast on failure.
- Secondary row: `Rest day` and `Cheat day`, each showing remaining tokens inline. Visually lighter than the primary toggles — they are escape hatches, not goals.
- Below: note field (280 chars), optional photo, weight field.
- A day is *logged* if any of gym / walk / run / swim / diet / rest / cheat / note / photo / weight is set.

**Acceptance criteria**
- Tapping Gym at 11:58pm logs against today; at 12:02am it logs against the new day (per `APP_TIMEZONE`).
- Marking `Rest day` immediately shows Movement and Swim as satisfied for today, and decrements both counters shown in the secondary row.
- Marking `Walk` satisfies Movement but leaves `Gym 3/5 this week` unchanged.
- With 0 rest tokens left, the Rest day toggle is disabled and reads *"No rest days left this month"*.
- Toggling while offline shows an error and reverts — it never silently drops the write.
- Re-tapping the same toggle twice within a second does not create duplicate rows (`@@unique([userId, date])`).

### F2 — Streak calendar (must have)

A GitHub-style grid of the last **90 days** — columns are weeks (≈13), rows are Mon–Sun, most recent at the right.

**Each cell carries all three streaks as three vertical slivers**, left to right: **Movement · Swim · Diet**. Sliver order is fixed and never varies — the eye learns the position, and a horizontal band of gaps in the middle column instantly reads as "swimming is the problem."

| Sliver state | Meaning |
|---|---|
| Filled | That habit was satisfied |
| Filled, muted tone | Satisfied via a rest or cheat token |
| Empty | Missed |
| Whole cell muted outline | Future date, not interactive |

- **Sizing:** 90 days over 13 columns fits a 375px viewport at ~22px cells with 4px gaps, giving ~7px slivers. This is comfortably above the legibility floor — do not shrink the cell to fit more history. Must not scroll horizontally at 375px.
- Movement, Swim and Diet each get a distinct hue, reused consistently everywhere in the app (check-in groups, stats, recap email).
- Token-satisfied days use a **muted tone of the same hue, never a failure color.** A rest day is a day the plan worked, and it must not look like a miss.
- Tapping a cell opens that day's detail (read-only outside the edit window).
- **Stat header above the grid**, the highest-contrast type on the page: `Movement 12` · `Swim 6` · `Diet 23` · `Gym 3/5 this week` · tokens remaining.
- A legend is required. Three unlabeled slivers are not self-evident on first view.

### F3 — Photo proof (must have)

- Optional photo per day — gym selfie or a meal.
- **Compressed client-side before upload:** max 1200px on the long edge, JPEG quality 0.7, target ≤ 150KB. Reject > 500KB after compression.
- v1 stores bytes in Postgres (`Bytes` column) — zero external services, ~70MB/year. Served via `GET /api/day/[date]/photo` with `Cache-Control: private, max-age=31536000, immutable`.
- **v2 migration path:** move to Vercel Blob when the DB passes 300MB. Keep all photo access behind the API route so the storage swap touches one file.
- Strip EXIF on upload (location data does not need to be in the database).

### F4 — Comments (must have)

- A thread per day. Either user can post. Plain text, 500 chars, newest last.
- Shows author name and relative time ("2h ago").
- Author can delete their own comment. No editing.
- This is what makes the app a shared thing rather than surveillance — it should feel prominent, not buried.

### F5 — Nudge (must have)

- Partner-only button, visible when **today is unlogged and it is past 7pm** in `APP_TIMEZONE`.
- Sends an email to the tracker: *"[Partner] nudged you — no check-in yet today."*
- **Rate limit: one nudge per calendar day.** After sending, the button shows "Nudged ✓" and disables.

### F6 — Reminders and weekly recap (must have)

Vercel Cron jobs. Every cron route validates the `Authorization: Bearer $CRON_SECRET` header and returns `401` otherwise.

| Job | Schedule (UTC, adjusted for `APP_TIMEZONE`) | Behavior |
|---|---|---|
| Evening reminder | Daily 8:00pm local | Email tracker only **if** today is unlogged |
| Weekly recap | Sunday 8:00pm local | Email **both** users |

Recap contents: all three current streaks, `Gym n/5` and `Swim n/7` for the week, rest and cheat tokens used vs. remaining for the month, weight change vs. last week (7-day average delta), and a per-day breakdown showing which of the three was missed on each incomplete day.

The recap must make it obvious **which single habit is the weak one** — three streak numbers side by side does that better than a total score, which averages the failure away.

### F7 — Weight trend (should have)

- Line chart, last 90 days, raw dots + 7-day moving average.
- Hand-rolled SVG. Do not add a charting library for one chart.
- Y-axis auto-scaled to data range with 10% padding — never anchored to zero, which flattens the trend into a meaningless line.

### F8 — Milestones (should have)

- Confetti + a full-width banner at **7, 30, 60, 100** on *each* of the three streaks (`Milestone.kind` = `movement_30`, `swim_7`, `diet_100`, …), and at **4 consecutive met gym weeks**.
- A separate, louder milestone for a **perfect day** — movement + swim + diet with no tokens spent — at 7 and 30 consecutive perfect days. This is the hardest thing the app asks for and should be the biggest celebration in it.
- Fires once per milestone. Persist which have been shown; do not re-fire on refresh.
- Emails the partner: *"Manoj just hit a 30-day swim streak."*

### F9 — The "why" note (should have)

- A single free-text note written once at setup, stored in `Settings.whyNote`.
- Surfaces automatically when the diet streak is `0` and the previous day was missed. This is the moment it matters.
- Editable from settings.

---

## 6. Screens

```
/login          PIN entry. Two name buttons → 6-digit PIN pad.
/               The board. Today's check-in, streak stats, heatmap,
                weight chart, today's comments.
/day/[date]     Day detail. Full check-in, photo, comments.
                Read-only outside the edit window.
/settings       Weekly gym target, monthly cheat tokens, timezone,
                the "why" note, change PIN.
```

**Design direction:** mobile-first, dark mode by default (it is used at night), one accent color, large type for the numbers that matter. Every primary action reachable with one thumb. No hamburger menu — four routes do not need navigation chrome.

---

## 7. Data model

Prisma 7 + PostgreSQL.

```prisma
enum Role {
  TRACKER
  PARTNER
}

model User {
  id        String     @id @default(cuid())
  name      String
  email     String     @unique
  role      Role
  pinHash   String                          // scrypt, see §9
  createdAt DateTime   @default(now())
  entries   DayEntry[]
  comments  Comment[]
}

model DayEntry {
  id         String   @id @default(cuid())
  userId     String
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  date       DateTime @db.Date              // date-only, in APP_TIMEZONE

  // movement — any one satisfies the daily streak; only gymDone counts toward the weekly quota
  gymDone    Boolean  @default(false)
  walkDone   Boolean  @default(false)
  runDone    Boolean  @default(false)

  swimDone   Boolean  @default(false)      // its own daily streak
  dietDone   Boolean  @default(false)      // its own daily streak

  isRestDay  Boolean  @default(false)      // spends a rest token; preserves movement + swim
  isCheatDay Boolean  @default(false)      // spends a cheat token; preserves diet

  note       String?  @db.VarChar(280)
  photo      Bytes?
  photoMime  String?
  weightKg   Float?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@unique([userId, date])
  @@index([userId, date])
}

model Comment {
  id        String   @id @default(cuid())
  date      DateTime @db.Date              // the day being commented on
  authorId  String
  author    User     @relation(fields: [authorId], references: [id], onDelete: Cascade)
  body      String   @db.VarChar(500)
  createdAt DateTime @default(now())

  @@index([date])
}

model Nudge {
  id         String   @id @default(cuid())
  fromUserId String
  date       DateTime @db.Date
  sentAt     DateTime @default(now())

  @@unique([fromUserId, date])            // enforces one nudge per day
}

model Settings {
  id                 String  @id @default("singleton")
  timezone           String  @default("Asia/Kolkata")
  weeklyGymTarget    Int     @default(5)
  weeklySwimTarget   Int     @default(7)
  monthlyRestTokens  Int     @default(4)
  monthlyCheatTokens Int     @default(4)
  whyNote            String?
  startDate          DateTime @db.Date
}

model Milestone {
  id       String   @id @default(cuid())
  kind     String                          // "diet_streak_30", "gym_weeks_4"
  shownAt  DateTime @default(now())

  @@unique([kind])
}
```

**Note:** neither token type is a stored counter. Compute remaining as `monthlyRestTokens − count(entries this month where isRestDay)` and likewise for cheat. A derived value cannot drift out of sync with the entries.

**Note:** all seven booleans are nullable-free with `@default(false)`, so a day with no row and a day with an empty row are equivalent. `PATCH` upserts.

---

## 8. API

All routes require a valid session except `/api/auth/login`.

| Method | Route | Notes |
|---|---|---|
| `POST` | `/api/auth/login` | `{ userId, pin }` → sets session cookie. Rate limited (§9) |
| `POST` | `/api/auth/logout` | Clears cookie |
| `GET` | `/api/board?days=90` | Everything the home page needs, one call: entries, stats, settings, today's comments |
| `PATCH` | `/api/day/[date]` | Partial update. `403` outside edit window. `TRACKER` only |
| `POST` | `/api/day/[date]/photo` | multipart. `403` outside edit window |
| `GET` | `/api/day/[date]/photo` | Returns image bytes |
| `DELETE` | `/api/day/[date]/photo` | |
| `GET` | `/api/day/[date]/comments` | |
| `POST` | `/api/day/[date]/comments` | Either user, any date |
| `DELETE` | `/api/comments/[id]` | Author only |
| `POST` | `/api/nudge` | `PARTNER` only. `409` if already nudged today |
| `PATCH` | `/api/settings` | |
| `POST` | `/api/cron/reminder` | Bearer `CRON_SECRET` |
| `POST` | `/api/cron/recap` | Bearer `CRON_SECRET` |

**Streak, weekly, and token math lives in one module** — `src/lib/stats.ts` — consumed by both the API and the cron jobs. Do not reimplement it in the UI. It is pure functions over `DayEntry[]`, so it is directly unit-testable.

---

## 9. Auth and security

Two people, one private URL — this needs to be sound, not elaborate.

- **PIN:** 6 digits, hashed with Node's `crypto.scrypt` (N=16384, r=8, p=1, 16-byte random salt, stored `salt:hash`). Compare with `timingSafeEqual`. No bcrypt dependency needed.
- **Session:** HMAC-SHA256-signed cookie (`SESSION_SECRET`), payload `{ userId, exp }`. `httpOnly`, `secure`, `sameSite=lax`, 90-day expiry.
- **Rate limiting:** 5 failed PIN attempts per user locks login for 15 minutes. In-memory is acceptable for two users; note it resets on deploy.
- **Middleware** guards every route except `/login` and `/api/auth/login`.
- `noindex, nofollow` on all pages. This must never appear in a search result.
- **Role enforcement server-side.** `PATCH /api/day` rejects `PARTNER`. Hiding the button in the UI is not enforcement.
- Photos are served only through the authenticated API route — never a public static path.
- No analytics, no third-party scripts. Photos of your food and body should not leave your infrastructure.

---

## 10. Stack and deployment

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router), TypeScript | Already scaffolded |
| Styling | Tailwind 4 | Ships with the scaffold |
| ORM | Prisma 7 | |
| Database | **Neon** Postgres, free tier | Same connection string local and prod — one thing to configure, no Docker, no local/prod drift |
| Hosting | Vercel, free tier | Cron jobs included |
| Email | **Resend**, free tier (3k/month) | Nudges, reminders, recaps |
| Charts | Hand-rolled SVG | One chart does not justify a dependency |

**Environment variables**

```
DATABASE_URL=          # Neon pooled connection string
SESSION_SECRET=        # openssl rand -hex 32
CRON_SECRET=           # openssl rand -hex 32
RESEND_API_KEY=
APP_TIMEZONE=Asia/Kolkata
```

**Setup order:** create the Neon project → paste `DATABASE_URL` → `npx prisma migrate dev` → run a seed script that creates both users, their PINs, and the `Settings` singleton → `npm run dev`.

Use the **same Neon database for local and production.** With two users there is no meaningful risk, and it removes an entire class of "works locally, breaks in prod" problems.

---

## 11. Build order

Ship each milestone in a usable state. Do not build all the schema-adjacent things first and the UI last.

| Milestone | Contents | Usable? |
|---|---|---|
| **M1 — Core loop** | Schema, seed, PIN login, F1 check-in, F2 heatmap | **Yes.** Start using it the day this lands |
| **M2 — Shared** | F4 comments, F3 photos, F5 nudge | Now it is an accountability tool |
| **M3 — Retention** | F6 reminders + recap, F7 weight chart | Now it survives week three |
| **M4 — Polish** | F8 milestones, F9 why-note, settings screen | |

---

## 12. Decisions already made

Recorded so they are not relitigated mid-build:

- **Three independent daily streaks: Movement, Swim, Diet.** Not one combined score. A single score lets a strong habit mask a collapsing one, which is exactly the information the board exists to surface.
- **Movement is daily, gym is a weekly quota of 5.** The daily streak has a low floor (a walk) so it survives a bad day; the weekly quota carries the intensity. Both operate on the same data.
- **Gym / walk / run are independent booleans, not one enum.** A day can be more than one thing.
- **Swimming does not satisfy Movement, and vice versa.** Separate commitments, separately visible.
- **Two token budgets — rest and cheat — and nothing else.** A rest day covers movement *and* swim together, because that is what a rest day is.
- **Yesterday is the edit limit.** Retroactive editing turns an accountability tool into a diary.
- **Same database local and prod.** Two users. The isolation is not worth the setup cost.
- **Photos in Postgres for v1.** Revisit at 300MB.
- **Weight chart never anchors the Y-axis to zero.** It hides the only thing the chart is for.

## 13. Appendix — Prisma 7 gotchas

The scaffold uses Prisma **7.9**, which moved several things that most tutorials and older model training data still get wrong. Verify against these before debugging:

- **Generator is `prisma-client`, not `prisma-client-js`.** It outputs to `src/generated/prisma`, so the import is `import { PrismaClient } from "@/generated/prisma"` — **not** `from "@prisma/client"`.
- **`datasource db` has no `url` field.** The connection string lives in `prisma.config.ts` under `datasource.url`. Adding `url = env("DATABASE_URL")` back into `schema.prisma` is a Prisma 6 pattern and will error.
- **`.env` is not auto-loaded.** `prisma.config.ts` does `import "dotenv/config"`, which means **`dotenv` must be installed as a devDependency** — it currently is not. Run `npm i -D dotenv` before the first migration.
- **Add `src/generated/` to `.gitignore`** and run `prisma generate` in a `postinstall` script, so Vercel builds regenerate the client.
- **npm 11 blocks install scripts by default.** Prisma's postinstall is already approved in this project's `package.json` under `allowScripts`. New packages with install scripts will need `npm approve-scripts <pkg>`.

## 14. Open questions

1. **Is a daily swim actually sustainable?** Review at 30 days against real data. If the Swim streak is repeatedly breaking, the fix is to drop `weeklySwimTarget` to 4–5 and present Swim as a weekly quota like gym — a settings change plus a display change, no migration. Decide from the data, not in advance.
2. **Do walks and runs need distance or duration?** Currently booleans only, consistent with the "no workout logging" non-goal. A single optional `km` field on walk/run and `meters` on swim would be cheap and would make the weight chart far more interpretable. Deferred, not rejected.
3. **Does the husband track too?** v1 assumes not. If yes, the heatmap needs a second column and the recap needs both — decide before M2, since it changes the board layout.
4. **Web push instead of email?** Email is v1 because it needs no service worker and no permission prompt. If the nudges get ignored in an inbox, web push is the v2 answer.
5. **What are the consequences?** The Contract concept (missed targets trigger an agreed penalty) was not chosen for v1, but the data to support it will all be there. Worth revisiting at 90 days if the board alone is not enough.
