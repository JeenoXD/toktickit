// MIG-01 and MIG-02: Lab 4 migration and seed (docs/lab-04/tests.md).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { getPrisma } from "../../src/prisma.js";
import { resetAndSeed } from "../../prisma/seedData.js";

const migrationSql = readFileSync(
  new URL("../../prisma/migrations/20261020120000_lab4_actions_taken/migration.sql", import.meta.url),
  "utf8",
);
const rollbackSql = readFileSync(new URL("../../prisma/rollback/lab4_rollback.sql", import.meta.url), "utf8");

describe("Lab 4 migration", () => {
  it("MIG-01: is additive only (no DROP or RENAME of Lab 1 to 3 objects)", () => {
    expect(migrationSql).not.toMatch(/\bDROP\b/i);
    expect(migrationSql).not.toMatch(/\bRENAME\b/i);
    expect(migrationSql).toMatch(/INSERT INTO "TicketStatusHistory"/);
  });

  it("MIG-01: rollback removes only the Lab 4 objects", () => {
    expect(rollbackSql).toMatch(/DROP TABLE IF EXISTS "ActionTaken"/);
    expect(rollbackSql).toMatch(/DROP TABLE IF EXISTS "TicketStatusHistory"/);
    expect(rollbackSql).not.toMatch(/DROP TABLE IF EXISTS "(Ticket|User|Attachment|PublicComment|InternalNote)"/);
  });

  it("MIG-01: backfill gives a legacy ticket one history row and keeps its data", async () => {
    const prisma = getPrisma();
    const requester = await prisma.user.findUniqueOrThrow({ where: { email: "david.lee@example.com" } });
    const category = await prisma.category.findFirstOrThrow();
    const system = await prisma.relatedSystem.findFirstOrThrow();

    // Simulate a Lab 3 row: inserted without any Lab 4 data.
    const legacy = await prisma.ticket.create({
      data: {
        ticketNumber: `TKT-LEGACY-${Date.now()}`,
        requesterId: requester.id,
        categoryId: category.id,
        relatedSystemId: system.id,
        summary: "Legacy ticket",
        description: "Created before Lab 4",
        requestedPriority: "LOW",
        currentStatus: "CLOSED",
      },
    });

    // Run the same backfill statements the migration runs, scoped to this ticket.
    await prisma.$executeRawUnsafe(
      `INSERT INTO "TicketStatusHistory" ("ticketId", "fromStatus", "toStatus", "changedById", "changedAt")
       SELECT "id", NULL, "currentStatus", "requesterId", "createdAt" FROM "Ticket" WHERE "id" = ${legacy.id}`,
    );
    await prisma.$executeRawUnsafe(
      `UPDATE "Ticket" SET "resolvedAt" = "updatedAt" WHERE "currentStatus" IN ('RESOLVED', 'CLOSED') AND "id" = ${legacy.id}`,
    );

    const after = await prisma.ticket.findUniqueOrThrow({
      where: { id: legacy.id },
      include: { statusHistory: true, actionsTaken: true },
    });
    expect(after.version).toBe(1);
    expect(after.requesterResolvedAt).toBeNull();
    expect(after.resolvedAt).not.toBeNull();
    expect(after.actionsTaken).toHaveLength(0);
    expect(after.statusHistory).toHaveLength(1);
    expect(after.statusHistory[0]).toMatchObject({ fromStatus: null, toStatus: "CLOSED", changedById: requester.id });
  });
});

describe("Lab 4 seed", () => {
  it("MIG-02: is safe to run twice and covers the required data", async () => {
    await resetAndSeed();
    const prisma = getPrisma();
    const first = {
      users: await prisma.user.count(),
      tickets: await prisma.ticket.count(),
      actions: await prisma.actionTaken.count(),
      history: await prisma.ticketStatusHistory.count(),
    };
    await resetAndSeed();
    const second = {
      users: await prisma.user.count(),
      tickets: await prisma.ticket.count(),
      actions: await prisma.actionTaken.count(),
      history: await prisma.ticketStatusHistory.count(),
    };
    expect(second).toEqual(first);

    // All 8 statuses present.
    const statuses = await prisma.ticket.groupBy({ by: ["currentStatus"], _count: true });
    expect(statuses.map((s) => s.currentStatus).sort()).toEqual(
      ["CANCELLED", "CLOSED", "IN_PROGRESS", "NEW", "OPEN", "REOPENED", "RESOLVED", "WAITING_FOR_REQUESTER"],
    );

    // All IT priorities, including unset.
    const priorities = await prisma.ticket.groupBy({ by: ["itPriority"], _count: true });
    expect(priorities.map((p) => p.itPriority ?? "UNSET").sort()).toEqual(["HIGH", "LOW", "MEDIUM", "UNSET"]);

    // Assigned and unassigned.
    expect(await prisma.ticket.count({ where: { ownerId: null } })).toBeGreaterThan(0);
    expect(await prisma.ticket.count({ where: { ownerId: { not: null } } })).toBeGreaterThan(0);

    // Tickets with 0, 1 and many actions.
    const tickets = await prisma.ticket.findMany({ include: { _count: { select: { actionsTaken: true } } } });
    const counts = tickets.map((t) => t._count.actionsTaken);
    expect(counts).toContain(0);
    expect(counts).toContain(1);
    expect(Math.max(...counts)).toBeGreaterThanOrEqual(3);

    // All action statuses, a follow-up, attachment notes, and a performer who is not the owner.
    const actions = await prisma.actionTaken.findMany({ include: { ticket: true } });
    expect(new Set(actions.map((a) => a.status))).toEqual(new Set(["PLANNED", "COMPLETED", "CANCELLED"]));
    expect(actions.some((a) => a.followUpRequired && a.followUpNote)).toBe(true);
    expect(actions.some((a) => a.attachmentNotes)).toBe(true);
    expect(actions.some((a) => a.ticket.ownerId !== null && a.performedById !== a.ticket.ownerId)).toBe(true);

    // Every ticket has history; a requester with no tickets exists for zero dashboards.
    const withoutHistory = await prisma.ticket.count({ where: { statusHistory: { none: {} } } });
    expect(withoutHistory).toBe(0);
    const emptyRequester = await prisma.user.findUniqueOrThrow({
      where: { email: "emily.carter@example.com" },
      include: { _count: { select: { requesterTickets: true } } },
    });
    expect(emptyRequester._count.requesterTickets).toBe(0);
    expect(await prisma.ticket.count({ where: { requesterResolvedAt: { not: null } } })).toBeGreaterThan(0);
  });
});
