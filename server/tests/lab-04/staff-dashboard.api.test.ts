// API-22, API-23, API-24, PERF-01: IT Staff / Administrator dashboard (BR-23 to BR-25).
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { resetAndSeed } from "../../prisma/seedData.js";

function extractCookie(res: request.Response): string {
  const raw = res.headers["set-cookie"];
  const cookies = Array.isArray(raw) ? raw : [raw];
  return (cookies.find((c) => c?.startsWith("token=")) as string).split(";")[0];
}

async function login(email: string): Promise<string> {
  return extractCookie(await request(app).post("/api/auth/login").send({ email, password: "TempPass123!" }));
}

const ACTIVE = "('NEW','OPEN','IN_PROGRESS','WAITING_FOR_REQUESTER','REOPENED')";

async function sqlCount(sql: string, ...params: unknown[]): Promise<number> {
  const rows = await getPrisma().$queryRawUnsafe<{ n: bigint }[]>(sql, ...params);
  return Number(rows[0].n);
}

describe("Staff dashboard API", () => {
  let staffCookie: string;
  let adminCookie: string;
  let staffId: number;

  beforeAll(async () => {
    await resetAndSeed();
    staffCookie = await login("it.staff@example.com");
    adminCookie = await login("admin@example.com");
    staffId = (await getPrisma().user.findUniqueOrThrow({ where: { email: "it.staff@example.com" } })).id;
  });

  it("API-22: every metric equals an independent SQL query", async () => {
    const res = await request(app).get("/api/dashboard/staff").set("Cookie", staffCookie);
    expect(res.status).toBe(200);
    const m = res.body.metrics;
    const t = `SELECT count(*) AS n FROM "Ticket" WHERE`;

    expect(m.unassigned.count).toBe(await sqlCount(`${t} "currentStatus"::text IN ${ACTIVE} AND "ownerId" IS NULL`));
    expect(m.myAssigned.count).toBe(await sqlCount(`${t} "currentStatus"::text IN ${ACTIVE} AND "ownerId" = $1`, staffId));
    expect(m.waitingForRequester.count).toBe(await sqlCount(`${t} "currentStatus" = 'WAITING_FOR_REQUESTER'`));
    expect(m.appearsResolved.count).toBe(await sqlCount(`${t} "currentStatus"::text IN ${ACTIVE} AND "requesterResolvedAt" IS NOT NULL`));
    expect(m.myPlannedActions.count).toBe(
      await sqlCount(`SELECT count(*) AS n FROM "ActionTaken" WHERE "performedById" = $1 AND "status" = 'PLANNED'`, staffId),
    );
    expect(m.myFollowUps.count).toBe(
      await sqlCount(
        `SELECT count(*) AS n FROM "ActionTaken" a JOIN "Ticket" k ON k.id = a."ticketId"
         WHERE a."performedById" = $1 AND a."status" = 'COMPLETED' AND a."followUpRequired" AND k."currentStatus"::text IN ${ACTIVE}`,
        staffId,
      ),
    );

    for (const [status, count] of Object.entries(res.body.byStatus)) {
      expect(count, status).toBe(await sqlCount(`${t} "currentStatus"::text = $1`, status));
    }
    expect(Object.keys(res.body.byStatus)).toHaveLength(8);
    expect(res.body.byItPriority.UNSET).toBe(await sqlCount(`${t} "currentStatus"::text IN ${ACTIVE} AND "itPriority" IS NULL`));
    expect(res.body.byItPriority.HIGH).toBe(await sqlCount(`${t} "currentStatus"::text IN ${ACTIVE} AND "itPriority" = 'HIGH'`));

    // Seed gives non-zero examples for the main cards.
    expect(m.unassigned.count).toBeGreaterThan(0);
    expect(m.myAssigned.count).toBeGreaterThan(0);
    expect(m.appearsResolved.count).toBeGreaterThan(0);
    expect(m.myPlannedActions.count).toBeGreaterThan(0);
  });

  it("API-22: urgent lists active High tickets, unassigned first; recent lists are bounded", async () => {
    const res = await request(app).get("/api/dashboard/staff").set("Cookie", staffCookie);
    expect(res.body.urgent.length).toBeLessThanOrEqual(5);
    expect(res.body.urgent.every((x: { itPriority: string }) => x.itPriority === "HIGH")).toBe(true);
    const owners = res.body.urgent.map((x: { owner: unknown }) => x.owner === null);
    expect(owners).toEqual([...owners].sort((a, b) => Number(b) - Number(a)));
    expect(res.body.recentlyUpdated.length).toBeLessThanOrEqual(5);
    expect(res.body.metrics.myPlannedActions.items[0]).toHaveProperty("ticketNumber");
  });

  it("API-23: Requesters get 403; IT Staff get no user counts; Administrators do", async () => {
    const requester = await request(app).get("/api/dashboard/staff").set("Cookie", await login("michael.brown@example.com"));
    expect(requester.status).toBe(403);

    const staff = await request(app).get("/api/dashboard/staff").set("Cookie", staffCookie);
    expect(staff.body.users).toBeUndefined();

    const admin = await request(app).get("/api/dashboard/staff").set("Cookie", adminCookie);
    expect(admin.status).toBe(200);
    expect(admin.body.users.active.IT_STAFF).toBe(
      await sqlCount(`SELECT count(*) AS n FROM "User" WHERE "isActive" AND "role" = 'IT_STAFF'`),
    );
    expect(admin.body.users.inactive).toBe(await sqlCount(`SELECT count(*) AS n FROM "User" WHERE NOT "isActive"`));
  });

  it("API-24: queue drill-down totals equal the dashboard counts", async () => {
    const dash = await request(app).get("/api/dashboard/staff").set("Cookie", staffCookie);
    for (const key of ["unassigned", "myAssigned", "waitingForRequester", "appearsResolved"]) {
      const { filters } = dash.body.metrics[key].drillDown;
      const list = await request(app).get("/api/tickets/queue").query(filters).set("Cookie", staffCookie);
      expect(list.status, key).toBe(200);
      expect(list.body.pagination.totalItems, key).toBe(dash.body.metrics[key].count);
    }
    for (const [status, count] of Object.entries(dash.body.byStatus)) {
      const list = await request(app).get("/api/tickets/queue").query({ status }).set("Cookie", staffCookie);
      expect(list.body.pagination.totalItems, status).toBe(count);
    }
    const unset = await request(app).get("/api/tickets/queue").query({ statusGroup: "active", itPriority: "UNSET" }).set("Cookie", staffCookie);
    expect(unset.body.pagination.totalItems).toBe(dash.body.byItPriority.UNSET);

    const bad = await request(app).get("/api/tickets/queue?owner=everyone").set("Cookie", staffCookie);
    expect(bad.status).toBe(400);
  });

  it("BR-25: zero metrics are 0, never missing", async () => {
    const res = await request(app).get("/api/dashboard/staff").set("Cookie", await login("it.staff3@example.com"));
    expect(res.status).toBe(200);
    expect(typeof res.body.metrics.myFollowUps.count).toBe("number");
    expect(res.body.metrics.myFollowUps.count).toBe(0);
    expect(res.body.metrics.myFollowUps.items).toEqual([]);
  });

  it("PERF-01: dashboards respond quickly with 500 extra tickets", async () => {
    const prisma = getPrisma();
    const requester = await prisma.user.findUniqueOrThrow({ where: { email: "david.lee@example.com" } });
    const category = await prisma.category.findFirstOrThrow();
    const system = await prisma.relatedSystem.findFirstOrThrow();
    const statuses = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"] as const;
    await prisma.ticket.createMany({
      data: Array.from({ length: 500 }, (_, i) => ({
        ticketNumber: `TKT-PERF-${i}-${Date.now()}`,
        requesterId: requester.id,
        categoryId: category.id,
        relatedSystemId: system.id,
        summary: `Perf ticket ${i}`,
        description: "Load test ticket for dashboard performance smoke.",
        requestedPriority: "LOW",
        itPriority: i % 3 === 0 ? "HIGH" : "LOW",
        currentStatus: statuses[i % statuses.length],
      })),
    });

    for (const [path, cookie] of [
      ["/api/dashboard/staff", adminCookie],
      ["/api/dashboard/requester", await login("david.lee@example.com")],
    ] as const) {
      const start = performance.now();
      const res = await request(app).get(path).set("Cookie", cookie);
      const elapsed = performance.now() - start;
      expect(res.status).toBe(200);
      expect(elapsed, `${path} took ${elapsed.toFixed(0)} ms`).toBeLessThan(500);
    }
    await resetAndSeed();
  });
});
