import { PrismaClient } from "@prisma/client";

/**
 * Prisma-Singleton. Im Dev-Modus würde Hot-Reload sonst bei jedem Neuladen
 * einen neuen Connection-Pool öffnen.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
