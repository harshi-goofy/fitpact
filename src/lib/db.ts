import { PrismaClient } from "@prisma/client";

// Next.js hot-reloads modules in dev, which would otherwise open a new
// connection pool on every save until Neon refuses them.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
