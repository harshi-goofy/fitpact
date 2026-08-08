import "dotenv/config";
import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const hashPin = (pin: string) => createHash("sha256").update(pin).digest("hex");

/* ---- Edit this block, then run: npm run db:seed ------------------- */
// PINs are how the app tells Harshi from Manoj. Change these to whatever you
// both want, re-run the seed, and log in again on each phone.
const TRACKER = { name: "Harshi", email: "harshi@example.com", pin: "1111" };
const PARTNER = { name: "Manoj", email: "kadiyalasaimanoj@gmail.com", pin: "2222" };

const START_WEIGHT_KG = 88;
const GOAL_WEIGHT_KG = 78;
const GOAL_DATE = "2027-01-01";

// Weekly targets — the app multiplies by weeks-in-month to get the monthly number.
const WEEKLY_SWIM_TARGET = 4;
const WEEKLY_GYM_TARGET = 5;
const WEEKLY_DIET_TARGET = 7;
/* ------------------------------------------------------------------ */

function todayInTz(tz: string): Date {
  // "en-CA" formats as YYYY-MM-DD, which is exactly what we want.
  const key = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
  return new Date(`${key}T00:00:00.000Z`);
}

async function main() {
  const tz = process.env.APP_TIMEZONE ?? "Asia/Kolkata";
  const start = todayInTz(tz);
  const goal = new Date(`${GOAL_DATE}T00:00:00.000Z`);

  const tracker = await prisma.user.upsert({
    where: { email: TRACKER.email },
    update: { name: TRACKER.name, role: "TRACKER", pinHash: hashPin(TRACKER.pin) },
    create: {
      name: TRACKER.name,
      email: TRACKER.email,
      role: "TRACKER",
      pinHash: hashPin(TRACKER.pin),
    },
  });

  const partner = await prisma.user.upsert({
    where: { email: PARTNER.email },
    update: { name: PARTNER.name, role: "PARTNER", pinHash: hashPin(PARTNER.pin) },
    create: {
      name: PARTNER.name,
      email: PARTNER.email,
      role: "PARTNER",
      pinHash: hashPin(PARTNER.pin),
    },
  });

  // Targets and the weight plan are updated on every seed so they can be
  // changed by editing the block above and re-running. startDate is only set
  // on first create — moving it later would rewrite history.
  const settings = await prisma.settings.upsert({
    where: { id: "singleton" },
    update: {
      timezone: tz,
      monthlySwimTarget: WEEKLY_SWIM_TARGET,
      monthlyGymTarget: WEEKLY_GYM_TARGET,
      monthlyDietTarget: WEEKLY_DIET_TARGET,
      startWeightKg: START_WEIGHT_KG,
      goalWeightKg: GOAL_WEIGHT_KG,
      goalDate: goal,
    },
    create: {
      id: "singleton",
      timezone: tz,
      monthlySwimTarget: WEEKLY_SWIM_TARGET,
      monthlyGymTarget: WEEKLY_GYM_TARGET,
      monthlyDietTarget: WEEKLY_DIET_TARGET,
      startWeightKg: START_WEIGHT_KG,
      goalWeightKg: GOAL_WEIGHT_KG,
      goalDate: goal,
      startDate: start,
    },
  });

  const days = Math.round((goal.getTime() - settings.startDate.getTime()) / 86_400_000);
  const perWeek = days > 0 ? ((START_WEIGHT_KG - GOAL_WEIGHT_KG) / days) * 7 : 0;

  console.log("Seeded:");
  console.log("  tracker :", tracker.name, `(${tracker.email})  PIN ${TRACKER.pin}`);
  console.log("  partner :", partner.name, `(${partner.email})  PIN ${PARTNER.pin}`);
  console.log("  targets :", `swim ${WEEKLY_SWIM_TARGET} · gym ${WEEKLY_GYM_TARGET} · diet ${WEEKLY_DIET_TARGET} per week`);
  console.log("  weight  :", `${START_WEIGHT_KG}kg -> ${GOAL_WEIGHT_KG}kg by ${GOAL_DATE}`);
  console.log("  pace    :", `${perWeek.toFixed(2)} kg/week over ${days} days`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
