// Lab 4 Actions Taken API tests: API-01 to API-12 in docs/lab-04/tests.md.
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

async function userId(email: string): Promise<number> {
  return (await getPrisma().user.findUniqueOrThrow({ where: { email } })).id;
}

async function ticketIdBySummary(summary: string): Promise<number> {
  return (await getPrisma().ticket.findFirstOrThrow({ where: { summary } })).id;
}

describe("Lab 4 Actions Taken API", () => {
  let requesterCookie: string;
  let otherRequesterCookie: string;
  let staffCookie: string;
  let adminCookie: string;
  let staffId: number;
  let staff2Id: number;
  let ticketId: number;

  beforeAll(async () => {
    requesterCookie = await login("michael.brown@example.com");
    otherRequesterCookie = await login("sarah.johnson@example.com");
    staffCookie = await login("it.staff@example.com");
    adminCookie = await login("admin@example.com");
    staffId = await userId("it.staff@example.com");
    staff2Id = await userId("it.staff2@example.com");
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
        summary: "Lab 4 actions ticket",
        description: "Ticket used by the Lab 4 Actions Taken API tests.",
        requestedPriority: "MEDIUM",
      });
    expect(created.status).toBe(201);
    ticketId = created.body.id;
  });

  async function createAction(body: Record<string, unknown> = {}, cookie = staffCookie) {
    return request(app)
      .post(`/api/tickets/${ticketId}/actions`)
      .set("Cookie", cookie)
      .send({ description: "Checked the cable", ...body });
  }

  it("API-01: IT Staff creates an action with the authenticated user as creator and performer", async () => {
    const res = await createAction({ createdById: 999, status: "COMPLETED", ticketId: 1 });
    expect(res.status).toBe(201);
    expect(res.body.ticketId).toBe(ticketId);
    expect(res.body.status).toBe("PLANNED");
    expect(res.body.createdBy.id).toBe(staffId);
    expect(res.body.performedBy.id).toBe(staffId);
    expect(res.body.version).toBe(1);
    expect(res.body.followUpRequired).toBe(false);
  });

  it("API-02: an action may be performed by a different active IT Staff member (BR-02)", async () => {
    const res = await createAction({ performedById: staff2Id });
    expect(res.status).toBe(201);
    expect(res.body.performedBy.id).toBe(staff2Id);
    expect(res.body.createdBy.id).toBe(staffId);

    const adminRes = await createAction({ description: "Admin can record work too" }, adminCookie);
    expect(adminRes.status).toBe(201);
  });

  it("API-03: rejects an inactive or Requester performer and saves nothing", async () => {
    const inactive = await createAction({ performedById: await userId("it.staff.inactive@example.com") });
    expect(inactive.status).toBe(400);
    expect(inactive.body.fields.performedById).toMatch(/active/i);

    const requester = await createAction({ performedById: await userId("michael.brown@example.com") });
    expect(requester.status).toBe(400);

    const missing = await createAction({ performedById: 999999 });
    expect(missing.status).toBe(400);

    expect(await getPrisma().actionTaken.count({ where: { ticketId } })).toBe(0);
  });

  it("API-04: Requesters cannot create or change actions", async () => {
    const create = await createAction({}, requesterCookie);
    expect(create.status).toBe(403);

    const action = (await createAction()).body;
    const edit = await request(app)
      .patch(`/api/tickets/${ticketId}/actions/${action.id}`)
      .set("Cookie", requesterCookie)
      .send({ version: 1, description: "Hacked" });
    expect(edit.status).toBe(403);

    const complete = await request(app)
      .patch(`/api/tickets/${ticketId}/actions/${action.id}/status`)
      .set("Cookie", requesterCookie)
      .send({ version: 1, status: "COMPLETED", result: "x" });
    expect(complete.status).toBe(403);

    const unauthenticated = await request(app).post(`/api/tickets/${ticketId}/actions`).send({ description: "x" });
    expect(unauthenticated.status).toBe(401);
  });

  it("API-05: the owning Requester reads all actions; another Requester gets 404", async () => {
    await createAction({ description: "First" });
    await createAction({ description: "Second", performedById: staff2Id });

    const own = await request(app).get(`/api/tickets/${ticketId}/actions`).set("Cookie", requesterCookie);
    expect(own.status).toBe(200);
    expect(own.body.data).toHaveLength(2);
    expect(own.body.data[0].performedBy.name).toBeTruthy();

    const other = await request(app).get(`/api/tickets/${ticketId}/actions`).set("Cookie", otherRequesterCookie);
    expect(other.status).toBe(404);
    expect(other.body.data).toBeUndefined();

    const missing = await request(app).get(`/api/tickets/99999999/actions`).set("Cookie", staffCookie);
    expect(missing.status).toBe(404);
  });

  it("API-05: legacy tickets without actions return an empty list", async () => {
    const res = await request(app).get(`/api/tickets/${ticketId}/actions`).set("Cookie", staffCookie);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it("API-06: validates description, follow-up note, and result to complete", async () => {
    const blank = await createAction({ description: "   " });
    expect(blank.status).toBe(400);
    expect(blank.body.error).toBe("VALIDATION_ERROR");
    expect(blank.body.fields.description).toBeTruthy();

    const followUp = await createAction({ followUpRequired: true, followUpNote: "" });
    expect(followUp.status).toBe(400);
    expect(followUp.body.fields.followUpNote).toBeTruthy();

    const action = (await createAction()).body;
    const noResult = await request(app)
      .patch(`/api/tickets/${ticketId}/actions/${action.id}/status`)
      .set("Cookie", staffCookie)
      .send({ version: 1, status: "COMPLETED" });
    expect(noResult.status).toBe(400);
    expect(noResult.body.fields.result).toBeTruthy();
  });

  it("API-07: rejects an action dated before the ticket, and a completed action dated in the future", async () => {
    const before = await createAction({ actionAt: "2000-01-01T00:00:00.000Z" });
    expect(before.status).toBe(400);
    expect(before.body.fields.actionAt).toBeTruthy();

    const futureDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const planned = await createAction({ actionAt: futureDate });
    expect(planned.status).toBe(201);

    const complete = await request(app)
      .patch(`/api/tickets/${ticketId}/actions/${planned.body.id}/status`)
      .set("Cookie", staffCookie)
      .send({ version: 1, status: "COMPLETED", result: "Done" });
    expect(complete.status).toBe(400);
    expect(complete.body.fields.actionAt).toBeTruthy();
  });

  it("API-08: edits a Planned action, completes it, and then it is read only", async () => {
    const action = (await createAction()).body;

    const edit = await request(app)
      .patch(`/api/tickets/${ticketId}/actions/${action.id}`)
      .set("Cookie", staffCookie)
      .send({
        version: 1,
        description: "Replaced the network cable",
        performedById: staff2Id,
        followUpRequired: true,
        followUpNote: "Check link speed next week",
        attachmentNotes: "See cable-photo.jpg",
      });
    expect(edit.status).toBe(200);
    expect(edit.body.version).toBe(2);
    expect(edit.body.description).toBe("Replaced the network cable");
    expect(edit.body.performedBy.id).toBe(staff2Id);
    expect(edit.body.createdBy.id).toBe(staffId);

    const complete = await request(app)
      .patch(`/api/tickets/${ticketId}/actions/${action.id}/status`)
      .set("Cookie", staffCookie)
      .send({ version: 2, status: "COMPLETED", result: "Link is stable at 1 Gbps" });
    expect(complete.status).toBe(200);
    expect(complete.body.status).toBe("COMPLETED");
    expect(complete.body.completedAt).toBeTruthy();
    expect(complete.body.version).toBe(3);

    const editAfter = await request(app)
      .patch(`/api/tickets/${ticketId}/actions/${action.id}`)
      .set("Cookie", staffCookie)
      .send({ version: 3, description: "Changed later" });
    expect(editAfter.status).toBe(400);
    expect(editAfter.body.error).toBe("ACTION_NOT_EDITABLE");

    const cancelAfter = await request(app)
      .patch(`/api/tickets/${ticketId}/actions/${action.id}/status`)
      .set("Cookie", staffCookie)
      .send({ version: 3, status: "CANCELLED" });
    expect(cancelAfter.status).toBe(400);
    expect(cancelAfter.body.error).toBe("INVALID_ACTION_TRANSITION");
  });

  it("API-08: cancels a Planned action and keeps the row (BR-11)", async () => {
    const action = (await createAction()).body;
    const cancel = await request(app)
      .patch(`/api/tickets/${ticketId}/actions/${action.id}/status`)
      .set("Cookie", staffCookie)
      .send({ version: 1, status: "CANCELLED" });
    expect(cancel.status).toBe(200);
    expect(cancel.body.status).toBe("CANCELLED");
    expect(cancel.body.cancelledAt).toBeTruthy();
    expect(await getPrisma().actionTaken.count({ where: { id: action.id } })).toBe(1);
  });

  it("API-08: rejects changing the performer of an existing action to an inactive user", async () => {
    const action = (await createAction()).body;
    const res = await request(app)
      .patch(`/api/tickets/${ticketId}/actions/${action.id}`)
      .set("Cookie", staffCookie)
      .send({ version: 1, performedById: await userId("it.staff.inactive@example.com") });
    expect(res.status).toBe(400);
    expect(res.body.fields.performedById).toBeTruthy();
  });

  it("API-08: an action id on a different ticket is not found", async () => {
    const action = (await createAction()).body;
    const otherTicket = await ticketIdBySummary("Cannot connect to VPN");
    const res = await request(app)
      .patch(`/api/tickets/${otherTicket}/actions/${action.id}`)
      .set("Cookie", staffCookie)
      .send({ version: 1, description: "Wrong ticket" });
    expect(res.status).toBe(404);
  });

  it("API-09: Closed and Cancelled tickets are locked", async () => {
    for (const summary of ["Software installation request", "Duplicate request for second monitor"]) {
      const lockedId = await ticketIdBySummary(summary);
      const create = await request(app)
        .post(`/api/tickets/${lockedId}/actions`)
        .set("Cookie", staffCookie)
        .send({ description: "Should not be saved" });
      expect(create.status).toBe(409);
      expect(create.body.error).toBe("TICKET_LOCKED");
    }

    const closedId = await ticketIdBySummary("Software installation request");
    const existing = await getPrisma().actionTaken.findFirstOrThrow({ where: { ticketId: closedId } });
    const edit = await request(app)
      .patch(`/api/tickets/${closedId}/actions/${existing.id}`)
      .set("Cookie", staffCookie)
      .send({ version: existing.version, description: "Changed" });
    expect(edit.status).toBe(409);
    expect(edit.body.error).toBe("TICKET_LOCKED");
  });

  it("API-10: a stale version is rejected and the first change is kept", async () => {
    const action = (await createAction()).body;

    const first = await request(app)
      .patch(`/api/tickets/${ticketId}/actions/${action.id}`)
      .set("Cookie", staffCookie)
      .send({ version: 1, description: "First editor wins" });
    expect(first.status).toBe(200);

    const second = await request(app)
      .patch(`/api/tickets/${ticketId}/actions/${action.id}`)
      .set("Cookie", adminCookie)
      .send({ version: 1, description: "Second editor is stale" });
    expect(second.status).toBe(409);
    expect(second.body.error).toBe("STALE_UPDATE");
    expect(second.body.current.description).toBe("First editor wins");
    expect(second.body.current.version).toBe(2);

    const missingVersion = await request(app)
      .patch(`/api/tickets/${ticketId}/actions/${action.id}`)
      .set("Cookie", staffCookie)
      .send({ description: "No version" });
    expect(missingVersion.status).toBe(400);
  });

  it("API-10: concurrent completes with the same version only succeed once", async () => {
    const action = (await createAction()).body;
    const send = () =>
      request(app)
        .patch(`/api/tickets/${ticketId}/actions/${action.id}/status`)
        .set("Cookie", staffCookie)
        .send({ version: 1, status: "COMPLETED", result: "Done" });
    const results = await Promise.all([send(), send()]);
    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([200, 409]);
  });

  it("API-11: the same clientRequestId creates only one action", async () => {
    const key = `retry-${ticketId}`;
    const first = await createAction({ clientRequestId: key });
    const retry = await createAction({ clientRequestId: key });
    expect(first.status).toBe(201);
    expect(retry.status).toBe(200);
    expect(retry.body.id).toBe(first.body.id);
    expect(await getPrisma().actionTaken.count({ where: { ticketId } })).toBe(1);
  });

  it("API-12: actions are ordered by actionAt, then id", async () => {
    const t = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const late = await createAction({ description: "Later", actionAt: t });
    const sameA = await createAction({ description: "Same time A", actionAt: new Date().toISOString() });
    const sameTime = sameA.body.actionAt;
    const sameB = await createAction({ description: "Same time B", actionAt: sameTime });

    const res = await request(app).get(`/api/tickets/${ticketId}/actions`).set("Cookie", staffCookie);
    expect(res.body.data.map((a: { id: number }) => a.id)).toEqual([sameA.body.id, sameB.body.id, late.body.id]);
  });

  it("lists only active IT Staff and Administrators for the performer picker", async () => {
    const res = await request(app).get("/api/staff-users").set("Cookie", staffCookie);
    expect(res.status).toBe(200);
    const roles = new Set(res.body.data.map((u: { role: string }) => u.role));
    expect([...roles].every((r) => r === "IT_STAFF" || r === "ADMINISTRATOR")).toBe(true);
    expect(res.body.data.some((u: { name: string }) => u.name === "Former IT Staff")).toBe(false);

    const forbidden = await request(app).get("/api/staff-users").set("Cookie", requesterCookie);
    expect(forbidden.status).toBe(403);
  });
});
