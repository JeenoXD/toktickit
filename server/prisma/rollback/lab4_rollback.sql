-- Lab 4 rollback: returns the database to the Lab 3 schema without touching Lab 3 data.
-- Take a backup first:  pg_dump -U toktickit toktickit > lab3_backup.sql
-- Run:                  psql -U toktickit toktickit -f prisma/rollback/lab4_rollback.sql
BEGIN;
DROP TABLE IF EXISTS "ActionTaken";
DROP TABLE IF EXISTS "TicketStatusHistory";
DROP TYPE IF EXISTS "ActionStatus";
DROP INDEX IF EXISTS "Ticket_ownerId_currentStatus_idx";
DROP INDEX IF EXISTS "Ticket_itPriority_currentStatus_idx";
ALTER TABLE "Ticket" DROP COLUMN IF EXISTS "version",
  DROP COLUMN IF EXISTS "requesterResolvedAt",
  DROP COLUMN IF EXISTS "resolvedAt";
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261020120000_lab4_actions_taken';
COMMIT;
