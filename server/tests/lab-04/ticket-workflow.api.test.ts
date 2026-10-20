// Lab 4 Ticket workflow API tests: API-13 to API-19 in docs/lab-04/tests.md.
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

function extractCookie(res: request.Response): string {
  const raw = res.headers["set-cookie"];
  if (!raw) throw new Error("Expected a Set-Cookie header");
  const cookies = Array.isArray(raw) ? raw : [raw];
  const tokenCookie = cookies.find((c) => c.startsWith("token="));
  if (!tokenCookie) throw new Error("Expected token cookie");
  return tokenCookie.split(";")[0];
}

async function login(email: string): Promise<string> {
  const res = await request(app).post("/api/auth/login").send({ email, password: "TempPass123!" });
  return extractCookie(res);
}

describe("Lab 4 Ticket workflow API", () => {
  let requesterCookie: string;
  let otherRequesterCookie: string;
  let staffCookie: string;
  let adminCookie: string;
  let ticketId: number;

  beforeAll(async () => {
    requesterCookie = await login("michael.brown@example.com");
    otherRequesterCookie = await login("sarah.johnson@example.com");
    staffCookie = await login("it.staff@example.com");
    adminCookie = await login("admin@example.com");
  });

  beforeEach(async () => {
    const categories = await request(app).get("/api/categories");
    const systems = await request(app).get("/api/related-systems");
    const created = await request(app)
      .post("/api/tickets")
      .set("Cookie", requesterCookie)
      .send({
        categoryId: categories.body[0].id,
        relatedSystemId: systems.body[0].id,
        summary: "Lab 4 workflow ticket",
        description: "Ticket used by the Lab 4 workflow API tests.",
        requestedPriority: "HIGH",
      });
    expect(created.status).toBe(201);
    ticketId = created.body.id;
  });

  async function version(): Promise<number> {
    return (await getPrisma().ticket.findUniqueOrThrow({ where: { id: ticketId } })).version;
  }

  async function setStatus(status: string, cookie = staffCookie, v?: number) {
    return request(app)
      .patch(`/api/tickets/${ticketId}/status`)
      .set("Cookie", cookie)
      .send({ status, version: v ?? (await version()) });
  }

  async function claim(cookie = staffCookie) {
    return request(app).patch(`/api/tickets/${ticketId}/claim`).set("Cookie", cookie).send({ version: await version() });
  }

  async function addAction(status: "PLANNED" | "COMPLETED") {
    const created = await request(app)
      .post(`/api/tickets/${ticketId}/actions`)
      .set("Cookie", staffCookie)
      .send({ description: "Worked on it" });
    if (status === "COMPLETED") {
      await request(app)
        .patch(`/api/tickets/${ticketId}/actions/${created.body.id}/status`)
        .set("Cookie", staffCookie)
        .send({ status: "COMPLETED", version: created.body.version, result: "Fixed" });
    }
    return created.body.id as number;
  }

  it("new tickets copy Requested Priority into IT Priority and start history at New (Lab 3 BR-12, BR-18)", async () => {
    const ticket = await getPrisma().ticket.findUniqueOrThrow({ where: { id: ticketId }, include: { statusHistory: true } });
    expect(ticket.itPriority).toBe("HIGH");
    expect(ticket.version).toBe(1);
    expect(ticket.statusHistory).toHaveLength(1);
    expect(ticket.statusHistory[0]).toMatchObject({ fromStatus: null, toStatus: "NEW" });
  });

  it("API-13: walks the full happy path and rejects transitions outside the matrix", async () => {
    expect((await setStatus("RESOLVED")).status).toBe(400);
    expect((await setStatus("OPEN")).status).toBe(200);
    expect((await claim()).status).toBe(200);
    expect((await setStatus("IN_PROGRESS")).status).toBe(200);
    expect((await setStatus("WAITING_FOR_REQUESTER")).status).toBe(200);
    expect((await setStatus("IN_PROGRESS")).status).toBe(200);
    await addAction("COMPLETED");
    const resolved = await setStatus("RESOLVED");
    expect(resolved.status).toBe(200);
    expect(resolved.body.currentStatus).toBe("RESOLVED");
    expect(resolved.body.resolvedAt).toBeTruthy();
    expect((await setStatus("CLOSED")).status).toBe(200);

    const bad = await setStatus("OPEN");
    expect(bad.status).toBe(400);
    expect(bad.body.error).toBe("INVALID_STATUS_TRANSITION");
    expect((await getPrisma().ticket.findUniqueOrThrow({ where: { id: ticketId } })).currentStatus).toBe("CLOSED");

    const reopened = await setStatus("REOPENED");
    expect(reopened.status).toBe(200);
    expect(reopened.body.resolvedAt).toBeNull();
  });

  it("API-14: Requesters cannot change status; only Admins reopen a cancelled ticket", async () => {
    const requester = await setStatus("OPEN", requesterCookie);
    expect(requester.status).toBe(403);

    expect((await setStatus("CANCELLED")).status).toBe(200);
    const staffReopen = await setStatus("REOPENED");
    expect(staffReopen.status).toBe(403);
    const adminReopen = await setStatus("REOPENED", adminCookie);
    expect(adminReopen.status).toBe(200);
  });

  it("API-15: the resolution gate reports each unmet condition", async () => {
    // Get to In Progress with an owner, then remove the owner directly to test NO_OWNER too.
    await setStatus("OPEN");
    await claim();
    await setStatus("IN_PROGRESS");
    await getPrisma().ticket.update({ where: { id: ticketId }, data: { ownerId: null } });
    await addAction("PLANNED");

    const res = await setStatus("RESOLVED");
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("RESOLUTION_GATE_FAILED");
    expect(res.body.reasons).toEqual(["NO_OWNER", "NO_COMPLETED_ACTION", "PLANNED_ACTIONS_OPEN"]);
    expect((await getPrisma().ticket.findUniqueOrThrow({ where: { id: ticketId } })).currentStatus).toBe("IN_PROGRESS");
  });

  it("API-16: cannot cancel with planned actions; In Progress needs an owner", async () => {
    await setStatus("OPEN");
    const noOwner = await setStatus("IN_PROGRESS");
    expect(noOwner.status).toBe(400);
    expect(noOwner.body.error).toBe("OWNER_REQUIRED");

    await addAction("PLANNED");
    const cancel = await setStatus("CANCELLED");
    expect(cancel.status).toBe(409);
    expect(cancel.body.error).toBe("PLANNED_ACTIONS_OPEN");
  });

  it("API-17: every successful change appends exactly one history row, in order", async () => {
    await setStatus("RESOLVED"); // rejected, adds nothing
    await setStatus("OPEN");
    await setStatus("CANCELLED");

    const res = await request(app).get(`/api/tickets/${ticketId}/status-history`).set("Cookie", staffCookie);
    expect(res.status).toBe(200);
    expect(res.body.data.map((h: { fromStatus: string | null; toStatus: string }) => `${h.fromStatus}>${h.toStatus}`)).toEqual([
      "null>NEW",
      "NEW>OPEN",
      "OPEN>CANCELLED",
    ]);
    expect(res.body.data[1].changedBy.name).toBe("IT Support Staff");

    const own = await request(app).get(`/api/tickets/${ticketId}/status-history`).set("Cookie", requesterCookie);
    expect(own.status).toBe(200);
    const other = await request(app).get(`/api/tickets/${ticketId}/status-history`).set("Cookie", otherRequesterCookie);
    expect(other.status).toBe(404);

    // Append-only: there is no endpoint that edits or deletes history.
    const del = await request(app).delete(`/api/tickets/${ticketId}/status-history`).set("Cookie", adminCookie);
    expect(del.status).toBe(404);
  });

  it("API-18: a stale version is rejected and the first change wins", async () => {
    const v = await version();
    const first = await setStatus("OPEN", staffCookie, v);
    expect(first.status).toBe(200);
    expect(first.body.version).toBe(v + 1);

    const second = await setStatus("CANCELLED", adminCookie, v);
    expect(second.status).toBe(409);
    expect(second.body.error).toBe("STALE_UPDATE");
    expect(second.body.current.currentStatus).toBe("OPEN");

    const missing = await request(app).patch(`/api/tickets/${ticketId}/status`).set("Cookie", staffCookie).send({ status: "OPEN" });
    expect(missing.status).toBe(400);
  });

  it("API-18: concurrent status changes with the same version only apply once", async () => {
    const v = await version();
    const results = await Promise.all([setStatus("OPEN", staffCookie, v), setStatus("CANCELLED", adminCookie, v)]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const history = await getPrisma().ticketStatusHistory.count({ where: { ticketId } });
    expect(history).toBe(2);
  });

  it("API-18: claim, reassign, and priority also require the current version", async () => {
    const v = await version();
    expect((await request(app).patch(`/api/tickets/${ticketId}/priority`).set("Cookie", staffCookie).send({ itPriority: "LOW", version: v })).status).toBe(200);
    const stalePriority = await request(app).patch(`/api/tickets/${ticketId}/priority`).set("Cookie", staffCookie).send({ itPriority: "MEDIUM", version: v });
    expect(stalePriority.status).toBe(409);
    const staleClaim = await request(app).patch(`/api/tickets/${ticketId}/claim`).set("Cookie", staffCookie).send({ version: v });
    expect(staleClaim.status).toBe(409);
    const noVersion = await request(app).patch(`/api/tickets/${ticketId}/claim`).set("Cookie", staffCookie);
    expect(noVersion.status).toBe(400);
  });

  it("reassign rejects inactive users and Requesters", async () => {
    const prisma = getPrisma();
    const inactive = await prisma.user.findUniqueOrThrow({ where: { email: "it.staff.inactive@example.com" } });
    const requester = await prisma.user.findUniqueOrThrow({ where: { email: "michael.brown@example.com" } });
    const staff2 = await prisma.user.findUniqueOrThrow({ where: { email: "it.staff2@example.com" } });

    for (const ownerId of [inactive.id, requester.id]) {
      const res = await request(app).patch(`/api/tickets/${ticketId}/reassign`).set("Cookie", staffCookie).send({ ownerId, version: await version() });
      expect(res.status).toBe(400);
    }
    const ok = await request(app).patch(`/api/tickets/${ticketId}/reassign`).set("Cookie", staffCookie).send({ ownerId: staff2.id, version: await version() });
    expect(ok.status).toBe(200);
    expect(ok.body.owner.name).toBe("Carlos Mendez");
  });

  it("allowed-transitions lists options with blocking reasons", async () => {
    await setStatus("OPEN");
    await claim();
    await setStatus("IN_PROGRESS");
    const res = await request(app).get(`/api/tickets/${ticketId}/allowed-transitions`).set("Cookie", staffCookie);
    expect(res.status).toBe(200);
    expect(res.body.currentStatus).toBe("IN_PROGRESS");
    expect(res.body.allowed).toContainEqual({ status: "RESOLVED", blockedBy: ["NO_COMPLETED_ACTION"] });

    const forbidden = await request(app).get(`/api/tickets/${ticketId}/allowed-transitions`).set("Cookie", requesterCookie);
    expect(forbidden.status).toBe(403);
  });

  it("API-19: appears resolved is advisory, idempotent, and cleared when IT Staff act", async () => {
    await setStatus("OPEN");
    const first = await request(app).patch(`/api/tickets/${ticketId}/requester-resolved`).set("Cookie", requesterCookie);
    expect(first.status).toBe(200);
    expect(first.body.currentStatus).toBe("OPEN");
    expect(first.body.requesterResolvedAt).toBeTruthy();

    const again = await request(app).patch(`/api/tickets/${ticketId}/requester-resolved`).set("Cookie", requesterCookie);
    expect(again.status).toBe(200);
    expect(again.body.requesterResolvedAt).toBe(first.body.requesterResolvedAt);

    const other = await request(app).patch(`/api/tickets/${ticketId}/requester-resolved`).set("Cookie", otherRequesterCookie);
    expect(other.status).toBe(404);
    const staff = await request(app).patch(`/api/tickets/${ticketId}/requester-resolved`).set("Cookie", staffCookie);
    expect(staff.status).toBe(403);

    await claim();
    await setStatus("IN_PROGRESS");
    await addAction("COMPLETED");
    const resolved = await setStatus("RESOLVED");
    expect(resolved.body.requesterResolvedAt).toBeNull();

    const afterResolved = await request(app).patch(`/api/tickets/${ticketId}/requester-resolved`).set("Cookie", requesterCookie);
    expect(afterResolved.status).toBe(400);
  });

  it("ticket detail includes version, flags, and the action count", async () => {
    await addAction("PLANNED");
    const res = await request(app).get(`/api/tickets/${ticketId}`).set("Cookie", staffCookie);
    expect(res.status).toBe(200);
    expect(res.body.version).toBe(1);
    expect(res.body.requesterResolvedAt).toBeNull();
    expect(res.body._count.actionsTaken).toBe(1);
  });
});
