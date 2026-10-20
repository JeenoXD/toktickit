-- Lab 4: Actions Taken, Ticket status history, optimistic concurrency.
-- Additive only: no existing column is dropped or renamed, so all Lab 1-3 data stays valid.

-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('PLANNED', 'COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "requesterResolvedAt" TIMESTAMP(3),
ADD COLUMN     "resolvedAt" TIMESTAMP(3),
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "ActionTaken" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "actionAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT NOT NULL,
    "result" TEXT,
    "status" "ActionStatus" NOT NULL DEFAULT 'PLANNED',
    "performedById" INTEGER NOT NULL,
    "createdById" INTEGER NOT NULL,
    "followUpRequired" BOOLEAN NOT NULL DEFAULT false,
    "followUpNote" TEXT,
    "attachmentNotes" TEXT,
    "clientRequestId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActionTaken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketStatusHistory" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "fromStatus" "TicketStatus",
    "toStatus" "TicketStatus" NOT NULL,
    "changedById" INTEGER NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActionTaken_ticketId_actionAt_id_idx" ON "ActionTaken"("ticketId", "actionAt", "id");

-- CreateIndex
CREATE INDEX "ActionTaken_performedById_status_idx" ON "ActionTaken"("performedById", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ActionTaken_ticketId_clientRequestId_key" ON "ActionTaken"("ticketId", "clientRequestId");

-- CreateIndex
CREATE INDEX "TicketStatusHistory_ticketId_changedAt_id_idx" ON "TicketStatusHistory"("ticketId", "changedAt", "id");

-- CreateIndex
CREATE INDEX "Ticket_ownerId_currentStatus_idx" ON "Ticket"("ownerId", "currentStatus");

-- CreateIndex
CREATE INDEX "Ticket_itPriority_currentStatus_idx" ON "Ticket"("itPriority", "currentStatus");

-- AddForeignKey
ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketStatusHistory" ADD CONSTRAINT "TicketStatusHistory_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketStatusHistory" ADD CONSTRAINT "TicketStatusHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill 1: every existing Ticket gets one starting history row so history is never empty.
INSERT INTO "TicketStatusHistory" ("ticketId", "fromStatus", "toStatus", "changedById", "changedAt")
SELECT "id", NULL, "currentStatus", "requesterId", "createdAt" FROM "Ticket";

-- Backfill 2: Tickets already Resolved or Closed get a best-known resolvedAt.
UPDATE "Ticket" SET "resolvedAt" = "updatedAt" WHERE "currentStatus" IN ('RESOLVED', 'CLOSED');

-- Legacy Tickets get no invented Actions Taken; requesterResolvedAt stays NULL (see docs/lab-04/specification.md Section 7).
