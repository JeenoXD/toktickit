// API-20, API-21: Requester dashboard (BR-22, BR-25).
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

describe("Requester dashboard API", () => {
  let jenniferCookie: string;
  let jenniferId: number;

  beforeAll(async () => {
    await resetAndSeed();
    jenniferCookie = await login("jennifer.anderson@example.com");
    jenniferId = (await getPrisma().user.findUniqueOrThrow({ where: { email: "jennifer.anderson@example.com" } })).id;
  });

  it("API-20: every count equals an independent SQL query over the requester's own tickets", async () => {
    const res = await request(app).get("/api/dashboard/requester").set("Cookie", jenniferCookie);
    expect(res.status).toBe(200);
    const m = res.body.metrics;

    const base = `SELECT count(*) AS n FROM "Ticket" WHERE "requesterId" = $1`;
    expect(m.openTickets.count).toBe(await sqlCount(`${base} AND "currentStatus"::text IN ${ACTIVE}`, jenniferId));
    expect(m.waitingForMe.count).toBe(await sqlCount(`${base} AND "currentStatus" = 'WAITING_FOR_REQUESTER'`, jenniferId));
    expect(m.resolved.count).toBe(await sqlCount(`${base} AND "currentStatus" = 'RESOLVED'`, jenniferId));
    expect(m.closed.count).toBe(await sqlCount(`${base} AND "currentStatus" = 'CLOSED'`, jenniferId));
    expect(m.openTickets.count).toBeGreaterThan(0); // seeded data gives a non-zero example

    expect(m.openTickets.drillDown).toEqual({ view: "myTickets", filters: { statusGroup: "active" } });
    expect(m.waitingForMe.drillDown.filters).toEqual({ status: "WAITING_FOR_REQUESTER" });
  });

  it("API-20: recent lists contain only the requester's tickets, newest first, at most 5", async () => {
    const res = await request(app).get("/api/dashboard/requester").set("Cookie", jenniferCookie);
    const ids: number[] = res.body.recentlyUpdated.map((t: { id: number }) => t.id);
    expect(ids.length).toBeLessThanOrEqual(5);
    const owned = await getPrisma().ticket.findMany({ where: { id: { in: ids } }, select: { requesterId: true } });
    expect(owned.every((t) => t.requesterId === jenniferId)).toBe(true);
    const times = res.body.recentlyUpdated.map((t: { updatedAt: string }) => Date.parse(t.updatedAt));
    expect([...times].sort((a, b) => b - a)).toEqual(times);
    expect(res.body.recentlyUpdated[0]).toHaveProperty("ticketNumber");
    expect(res.body.recentlyUpdated[0]).not.toHaveProperty("description");
  });

  it("API-20: recently resolved uses status history inside the Bangkok 7-day window", async () => {
    const res = await request(app).get("/api/dashboard/requester").set("Cookie", jenniferCookie);
    // Seed: Jennifer's "Docking station not detected" was resolved a few days ago.
    expect(res.body.recentlyResolved.map((t: { summary: string }) => t.summary)).toContain("Docking station not detected");
    for (const t of res.body.recentlyResolved) expect(t.resolvedAt).toBeTruthy();
  });

  it("API-20, BR-25: a requester with no tickets gets zeros and empty lists", async () => {
    const res = await request(app).get("/api/dashboard/requester").set("Cookie", await login("emily.carter@example.com"));
    expect(res.status).toBe(200);
    for (const key of ["openTickets", "waitingForMe", "resolved", "closed"]) expect(res.body.metrics[key].count).toBe(0);
    expect(res.body.recentlyUpdated).toEqual([]);
    expect(res.body.recentlyResolved).toEqual([]);
  });

  it("API-21: staff get 403, and a requesterId query parameter is ignored", async () => {
    const staff = await request(app).get("/api/dashboard/requester").set("Cookie", await login("it.staff@example.com"));
    expect(staff.status).toBe(403);

    const own = await request(app).get("/api/dashboard/requester").set("Cookie", jenniferCookie);
    const spoofed = await request(app).get(`/api/dashboard/requester?requesterId=999`).set("Cookie", jenniferCookie);
    expect(spoofed.body.metrics).toEqual(own.body.metrics);

    const anonymous = await request(app).get("/api/dashboard/requester");
    expect(anonymous.status).toBe(401);
  });

  it("FR-10: My Tickets drill-down totals equal the dashboard counts", async () => {
    const dash = await request(app).get("/api/dashboard/requester").set("Cookie", jenniferCookie);
    for (const key of ["openTickets", "waitingForMe", "resolved", "closed"]) {
      const { filters } = dash.body.metrics[key].drillDown;
      const list = await request(app).get("/api/tickets").query(filters).set("Cookie", jenniferCookie);
      expect(list.status, key).toBe(200);
      expect(list.body.pagination.totalItems, key).toBe(dash.body.metrics[key].count);
    }
    const bad = await request(app).get("/api/tickets?status=DONE").set("Cookie", jenniferCookie);
    expect(bad.status).toBe(400);
  });
});
