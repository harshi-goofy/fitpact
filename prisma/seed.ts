import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ---- Edit these two lines, then run: npm run db:seed ----
const TRACKER = { name: "Manoj", email: "kadiyalasaimanoj@gmail.com" };
const PARTNER = { name: "Partner", email: "partner@example.com" };
// ---------------------------------------------------------

function todayInTz(tz: string): Date {
  // "en-CA" formats as YYYY-MM-DD, which is exactly what we want.
  const key = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
  return new Date(`${key}T00:00:00.000Z`);
}

async function main() {
  const tz = process.env.APP_TIMEZONE ?? "Asia/Kolkata";

  const tracker = await prisma.user.upsert({
    where: { email: TRACKER.email },
    update: { name: TRACKER.name, role: "TRACKER" },
    create: { name: TRACKER.name, email: TRACKER.email, role: "TRACKER" },
  });

  const partner = await prisma.user.upsert({
    where: { email: PARTNER.email },
    update: { name: PARTNER.name, role: "PARTNER" },
    create: { name: PARTNER.name, email: PARTNER.email, role: "PARTNER" },
  });

  const settings = await prisma.settings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton", timezone: tz, startDate: todayInTz(tz) },
  });

  console.log("Seeded:");
  console.log("  tracker :", tracker.name, `(${tracker.email})`);
  console.log("  partner :", partner.name, `(${partner.email})`);
  console.log("  settings:", `tz=${settings.timezone}`, `gym=${settings.weeklyGymTarget}/wk`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
