-- 1. Create the Role enum (if it doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Role') THEN
        CREATE TYPE "Role" AS ENUM ('REQUESTER', 'IT_STAFF', 'ADMINISTRATOR');
    END IF;
END $$;

-- 2. Add new values to the existing TicketStatus enum
ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'OPEN';
ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'IN_PROGRESS';
ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'WAITING_FOR_REQUESTER';
ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'RESOLVED';
ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'CLOSED';
ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'REOPENED';
ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

-- 3. Rename the RequesterUser table to User
ALTER TABLE "RequesterUser" RENAME TO "User";

-- 4. Add the new Lab 3 columns to the User table
-- Note: The password is a dummy bcrypt hash of "TempPass123!". The seed script will overwrite this.
ALTER TABLE "User" 
ADD COLUMN "password" TEXT NOT NULL DEFAULT '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGfa3ZlW',
ADD COLUMN "role" "Role" NOT NULL DEFAULT 'REQUESTER',
ADD COLUMN "requiresPasswordChange" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- 5. Add the ownerId column to Ticket for IT Staff assignment
ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "ownerId" INTEGER;

-- 6. Create the new PublicComment and InternalNote tables
CREATE TABLE "PublicComment" (
    "id" SERIAL NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ticketId" INTEGER NOT NULL,
    "authorId" INTEGER NOT NULL,
    CONSTRAINT "PublicComment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InternalNote" (
    "id" SERIAL NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ticketId" INTEGER NOT NULL,
    "authorId" INTEGER NOT NULL,
    CONSTRAINT "InternalNote_pkey" PRIMARY KEY ("id")
);

-- 7. Add foreign key constraints
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL;

ALTER TABLE "PublicComment" ADD CONSTRAINT "PublicComment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE;
ALTER TABLE "PublicComment" ADD CONSTRAINT "PublicComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT;

ALTER TABLE "InternalNote" ADD CONSTRAINT "InternalNote_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE;
ALTER TABLE "InternalNote" ADD CONSTRAINT "InternalNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT;