-- AlterTable
ALTER TABLE "Mailbox" ADD COLUMN     "config" JSONB,
ADD COLUMN     "initialSyncDays" INTEGER,
ADD COLUMN     "syncStartedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "aiModelFast" TEXT,
ADD COLUMN     "initialSyncDays" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "maxEmailsPerSync" INTEGER NOT NULL DEFAULT 100;
