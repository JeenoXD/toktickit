-- Repairs schema drift left by the hand-written Lab 2/Lab 3 migrations so the
-- database matches schema.prisma. Written to be safe to run on any Lab 3 database.
-- No data is changed or removed.

-- 1. Names still using the Lab 2 "RequesterUser" table name.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RequesterUser_pkey') THEN
    ALTER TABLE "User" RENAME CONSTRAINT "RequesterUser_pkey" TO "User_pkey";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'RequesterUser_email_key') THEN
    ALTER INDEX "RequesterUser_email_key" RENAME TO "User_email_key";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'RequesterUser_id_seq') THEN
    ALTER SEQUENCE "RequesterUser_id_seq" RENAME TO "User_id_seq";
  END IF;
END $$;

-- 2. Column defaults schema.prisma does not declare (password has no default; updatedAt is set by Prisma).
ALTER TABLE "User" ALTER COLUMN "password" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- 3. Indexes declared in schema.prisma but never created.
CREATE INDEX IF NOT EXISTS "Ticket_ownerId_idx" ON "Ticket"("ownerId");
CREATE UNIQUE INDEX IF NOT EXISTS "PublicComment_ticketId_authorId_content_key" ON "PublicComment"("ticketId", "authorId", "content");
CREATE UNIQUE INDEX IF NOT EXISTS "InternalNote_ticketId_authorId_content_key" ON "InternalNote"("ticketId", "authorId", "content");

-- 4. Foreign keys recreated with the referential actions schema.prisma declares.
ALTER TABLE "Ticket" DROP CONSTRAINT IF EXISTS "Ticket_ownerId_fkey";
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Attachment" DROP CONSTRAINT IF EXISTS "Attachment_ticketId_fkey";
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PublicComment" DROP CONSTRAINT IF EXISTS "PublicComment_ticketId_fkey";
ALTER TABLE "PublicComment" ADD CONSTRAINT "PublicComment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PublicComment" DROP CONSTRAINT IF EXISTS "PublicComment_authorId_fkey";
ALTER TABLE "PublicComment" ADD CONSTRAINT "PublicComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InternalNote" DROP CONSTRAINT IF EXISTS "InternalNote_ticketId_fkey";
ALTER TABLE "InternalNote" ADD CONSTRAINT "InternalNote_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InternalNote" DROP CONSTRAINT IF EXISTS "InternalNote_authorId_fkey";
ALTER TABLE "InternalNote" ADD CONSTRAINT "InternalNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;