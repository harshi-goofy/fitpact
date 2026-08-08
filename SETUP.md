# FitPact — setup

A private accountability board for **swim, gym and diet**. One streak, a month
calendar, badges, a weight plan, and a shared tab where your partner can cheer
or comment.

There's no login — anyone with the URL can open and edit the board.

You need three things: Node, a free database, and a free host. About 20 minutes.

---

## 1. Install Node

Download the **LTS** version from [nodejs.org](https://nodejs.org) and run the installer.

Check it worked — open Terminal and run:

```bash
node --version
```

You should see something like `v22.x.x`.

## 2. Get a database

1. Go to [neon.com](https://neon.com) and sign up. The free tier is plenty.
2. Create a project.
3. On the dashboard find **Connection string** and copy the **pooled** one:
   `postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require`

## 3. Configure the app

In the `fitpact` folder, copy `.env.example` to `.env`, then paste your string in:

```
DATABASE_URL=postgresql://…
APP_TIMEZONE=Asia/Kolkata
```

## 4. Set up the database

```bash
cd ~/Desktop/fitpact
npm install
npm run db:push
npm run db:seed
```

`db:push` should say **"Your database is now in sync with your Prisma schema"**.

> **If you set the app up before the redesign**, `db:push` will warn that it is
> dropping the `walkDone`, `runDone`, `isRestDay` and `isCheatDay` columns. That
> is expected — walk and run were removed, and rest and cheat days are now read
> off the calendar instead of being stored. Say yes.

`db:seed` prints the two accounts, your monthly targets and your weight pace.

## 5. Run it

```bash
npm run dev
```

Open <http://localhost:3000>. Tap **Gym** → the tile turns lime and reads
"Logged" → refresh → still logged. That means the database is wired up.

---

## Changing your targets

Everything personal lives in one block at the top of `prisma/seed.ts`:

```ts
const TRACKER = { name: "Harshi", email: "harshi@example.com" };
const PARTNER = { name: "Manoj",  email: "kadiyalasaimanoj@gmail.com" };

const START_WEIGHT_KG = 88;
const GOAL_WEIGHT_KG  = 78;
const GOAL_DATE       = "2027-01-01";

const MONTHLY_SWIM_TARGET = 16;
const MONTHLY_GYM_TARGET  = 20;
const MONTHLY_DIET_TARGET = 28;
```

Edit it and run `npm run db:seed` again. Targets and the weight plan update;
your logged days are never touched.

---

## The rules, in one place

- **The streak** needs **diet plus either swim or gym** on the same day.
- **Every Sunday is a rest day** — the streak survives it whatever you did.
- **The 2nd and 4th Sunday** of each month are **cheat meals**, afternoon only.
  Two per month, every month. Nothing to spend, nothing to run out of.
- **Today never breaks the streak.** An unlogged today shows as still open, not
  as a zero, because the evening hasn't happened yet.
- **Today and yesterday are editable.** Older days are locked — you can catch up
  after falling asleep, but you can't rewrite last week to protect a streak.
- **Comments are never locked.** Your partner can say something about any day.

## The weight plan

88 kg → 78 kg by 1 Jan 2027 is **0.48 kg/week** over 146 days. The straight line
gives each month a checkpoint, shown under "Monthly plan" on the Today screen:

| End of | Target |
|---|---|
| Aug | 86.4 kg |
| Sep | 84.4 kg |
| Oct | 82.3 kg |
| Nov | 80.2 kg |
| Dec | 78.1 kg |
| 1 Jan | 78.0 kg |

"Needed per week" is recalculated from wherever you actually are, so it goes up
if you fall behind rather than quietly keeping the original promise.

---

## Deploying

1. Push to GitHub.
2. Import the repo at [vercel.com](https://vercel.com).
3. Add the environment variables — the **Import .env** button takes your `.env`
   file as-is.
4. Deploy. Use the **same Neon database** for local and production; with two
   people there's no reason to keep them apart.

## Running the tests

```bash
npx tsx src/lib/stats.test.ts
```

25 tests covering the streak rule, rest Sundays, cheat-day scheduling, month
targets, the weight back-calculation and the year boundary. Every rule in the
app lives in `src/lib/stats.ts` as pure functions — if you change a rule, change
it there and nowhere else.
