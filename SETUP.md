# FitPact — setup

M1 (the core loop) is built: daily check-in, three streaks, weekly gym quota, rest/cheat tokens, and the 90-day calendar. No login — anyone with the URL can open and edit the board.

You need three things: Node, a free database, and a free host. About 20 minutes.

---

## 1. Install Node

Download the **LTS** version from [nodejs.org](https://nodejs.org) and run the installer.

Check it worked — open Terminal (Mac) or PowerShell (Windows) and run:

```bash
node --version
```

You should see something like `v22.x.x`.

## 2. Get a database

1. Go to [neon.com](https://neon.com) and sign up (free tier is plenty — this app uses a few MB).
2. Create a project. Name it `fitpact`.
3. On the project dashboard find **Connection string** and copy the **pooled** one. It looks like:
   `postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require`

## 3. Configure the app

In the `fitpact` folder, make a copy of `.env.example` and name it `.env`. Open it and paste your connection string:

```
DATABASE_URL=postgresql://...the string you copied...
APP_TIMEZONE=Asia/Kolkata
```

You can leave `SESSION_SECRET`, `CRON_SECRET` and `RESEND_API_KEY` as-is for now — nothing in M1 uses them.

Open `prisma/seed.ts` and set the two names and emails at the top:

```ts
const TRACKER = { name: "Manoj", email: "kadiyalasaimanoj@gmail.com" };
const PARTNER = { name: "...",   email: "..." };
```

## 4. Run it

In Terminal, `cd` into the `fitpact` folder, then:

```bash
npm install
npm run db:push    # creates the tables
npm run db:seed    # creates the two people + settings
npm run dev
```

Open <http://localhost:3000>. Tap Gym. The Movement number should go to 1.

## 5. Put it online

1. Push the folder to a **private** GitHub repo.
2. Go to [vercel.com](https://vercel.com), sign in with GitHub, **Add New → Project**, pick the repo.
3. Before deploying, add the environment variables — same `DATABASE_URL` and `APP_TIMEZONE` from your `.env`.
4. Deploy. You get a URL like `fitpact-abc.vercel.app`. Add it to your home screen on both phones.

Use the **same Neon database** for local and production. With two people there's no real risk and it removes a whole class of "works on my machine" problems.

---

## About there being no login

Anyone who has the URL can open the board and change the check-ins. Vercel URLs aren't guessable and the app sends `noindex` so it won't appear in search results, but treat the link like a password: don't post it anywhere, and be aware anyone you send it to keeps access.

If that stops feeling okay, PIN login is roughly an afternoon's work and the PRD already specifies it (§9).

---

## What's in each file

```
prisma/schema.prisma      The data model. Change targets/defaults here.
prisma/seed.ts            Creates the two people. Run once.

src/lib/timezone.ts       Every date decision. Days are "YYYY-MM-DD" strings
                          resolved through APP_TIMEZONE, never browser time.
src/lib/stats.ts          All streak, quota and token math. Pure functions —
                          the API, the UI and (later) the emails all call this
                          one module so they can never disagree.
src/lib/board.ts          Loads everything the page needs in one query.

src/app/page.tsx          The board (server-rendered).
src/app/api/board         Refetch endpoint.
src/app/api/day/[date]    PATCH one day. Enforces the edit window and the
                          token budgets server-side.

src/components/CheckIn.tsx        Today's toggles, grouped by rule.
src/components/StreakCalendar.tsx The 90-day grid.
src/components/StatHeader.tsx     The three big numbers.
```

## Changing the rules

Targets live in the `Settings` row, not in code. The settings screen is M4, so for now edit them directly:

```bash
npm run db:studio
```

That opens a table browser. Open `Settings`, change `weeklySwimTarget` or `monthlyRestTokens`, save.

The PRD flags this one specifically: if the Swim streak keeps breaking after a month, drop `weeklySwimTarget` to 4 or 5 rather than abandoning the board. No migration needed.

## Common problems

**"No TRACKER user found"** — you skipped `npm run db:seed`.

**"Can't reach database server"** — the `DATABASE_URL` in `.env` is wrong or wrapped in quotes it shouldn't have. Copy it again from Neon.

**Yesterday's toggle does nothing** — that's correct behaviour for anything older than yesterday. Today and yesterday are editable; older days are locked.

**The streak says 0 but I did it today** — check the toggle actually saved (the header shows "Saving…"). If today is unchecked the streak shows the count through yesterday and marks today pending; it doesn't zero out until the day is over.

---

## What's not built yet

M2 comments, photos, nudge · M3 reminder emails, weekly recap, weight chart · M4 milestones, why-note editor, settings screen.

The schema and `stats.ts` already cover all of them — the weight field saves today, it just has no chart yet.
