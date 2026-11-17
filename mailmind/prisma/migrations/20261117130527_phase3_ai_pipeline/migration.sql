-- AlterTable
ALTER TABLE "Email" ADD COLUMN     "aiCostUsd" DECIMAL(12,6) NOT NULL DEFAULT 0,
ADD COLUMN     "aiModels" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "categoryConfidence" DOUBLE PRECISION,
ADD COLUMN     "needsReview" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "priorityConfidence" DOUBLE PRECISION,
ADD COLUMN     "reviewReason" TEXT;

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "aiDailyEmailLimit" INTEGER NOT NULL DEFAULT 500;

-- AlterTable
ALTER TABLE "Thread" ADD COLUMN     "summarizedUntil" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ClassificationCorrection" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "emailId" TEXT,
    "userId" TEXT,
    "field" TEXT NOT NULL,
    "fromValue" TEXT,
    "toValue" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "senderDomain" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassificationCorrection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClassificationCorrection_organizationId_createdAt_idx" ON "ClassificationCorrection"("organizationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AiUsageLog_emailId_idx" ON "AiUsageLog"("emailId");

-- CreateIndex
CREATE INDEX "Email_organizationId_needsReview_idx" ON "Email"("organizationId", "needsReview");

-- CreateIndex
CREATE INDEX "Email_organizationId_aiStatus_idx" ON "Email"("organizationId", "aiStatus");

-- AddForeignKey
ALTER TABLE "ClassificationCorrection" ADD CONSTRAINT "ClassificationCorrection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassificationCorrection" ADD CONSTRAINT "ClassificationCorrection_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "Email"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassificationCorrection" ADD CONSTRAINT "ClassificationCorrection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
