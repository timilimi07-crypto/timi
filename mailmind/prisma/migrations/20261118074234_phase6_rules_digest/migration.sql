-- AlterTable
ALTER TABLE "Email" ADD COLUMN     "rulesAppliedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "digestWeekdaysOnly" BOOLEAN NOT NULL DEFAULT true;
