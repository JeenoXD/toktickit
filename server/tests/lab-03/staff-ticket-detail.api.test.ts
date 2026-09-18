import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";

function extractCookie(res: request.Response): string {
  const raw = res.headers["set-cookie"];
  if (!raw) throw new Error("Expected a Set-Cookie header");
  const cookies = Array.isArray(raw) ? raw : [raw];
  const tokenCookie = cookies.find((c) => c.startsWith("token="));
  if (!tokenCookie) throw new Error("Expected token cookie");
  return tokenCookie.split(";")[0];
}

describe("IT staff ticket operations", () => {
  let requesterCookie: string;
  let staffCookie: string;
  let adminCookie: string;
  let ticketId: number;

  beforeEach(async () => {
    const requesterLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "michael.brown@example.com", password: "TempPass123!" });
    requesterCookie = extractCookie(requesterLogin);

    const staffLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "it.staff@example.com", password: "TempPass123!" });
    staffCookie = extractCookie(staffLogin);

    const adminLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@example.com", password: "TempPass123!" });
    adminCookie = extractCookie(adminLogin);

    const categories = await request(app).get("/api/categories");
    const systems = await request(app).get("/api/related-systems");

    const created = await request(app)
      .post("/api/tickets")
      .set("Cookie", requesterCookie)
      .send({
        categoryId: categories.body[0].id,
        relatedSystemId: systems.body[0].id,
        summary: "Staff ops ticket",
        description: "A detailed description for the staff ticket operations test.",
        requestedPriority: "MEDIUM",
      });

    ticketId = created.body.id;
  });

  it("allows IT staff to claim and reassign a ticket", async () => {
    const claimRes = await request(app)
      .patch(`/api/tickets/${ticketId}/claim`)
      .set("Cookie", staffCookie);

    expect(claimRes.status).toBe(200);
    expect(claimRes.body.ownerId).toBeTruthy();

    const adminUser = await request(app)
      .get("/api/auth/me")
      .set("Cookie", adminCookie);

    const reassignRes = await request(app)
      .patch(`/api/tickets/${ticketId}/reassign`)
      .set("Cookie", staffCookie)
      .send({ ownerId: adminUser.body.user.id });

    expect(reassignRes.status).toBe(200);
    expect(reassignRes.body.ownerId).toBe(adminUser.body.user.id);
  });

  it("updates the IT priority and validates allowed status transitions", async () => {
    const priorityRes = await request(app)
      .patch(`/api/tickets/${ticketId}/priority`)
      .set("Cookie", staffCookie)
      .send({ itPriority: "HIGH" });

    expect(priorityRes.status).toBe(200);
    expect(priorityRes.body.itPriority).toBe("HIGH");

    const validStatusRes = await request(app)
      .patch(`/api/tickets/${ticketId}/status`)
      .set("Cookie", staffCookie)
      .send({ status: "OPEN" });

    expect(validStatusRes.status).toBe(200);
    expect(validStatusRes.body.currentStatus).toBe("OPEN");

    const invalidStatusRes = await request(app)
      .patch(`/api/tickets/${ticketId}/status`)
      .set("Cookie", staffCookie)
      .send({ status: "CLOSED" });

    expect(invalidStatusRes.status).toBe(400);
    expect(invalidStatusRes.body.error).toBe("INVALID_STATUS_TRANSITION");
  });

  it("creates and retrieves internal notes, while blocking requesters", async () => {
    const noteRes = await request(app)
      .post(`/api/tickets/${ticketId}/notes`)
      .set("Cookie", staffCookie)
      .send({ content: "Investigating the reported issue." });

    expect(noteRes.status).toBe(201);
    expect(noteRes.body.content).toBe("Investigating the reported issue.");

    const notesRes = await request(app)
      .get(`/api/tickets/${ticketId}/notes`)
      .set("Cookie", staffCookie);

    expect(notesRes.status).toBe(200);
    expect(notesRes.body.some((n: { content: string }) => n.content === "Investigating the reported issue.")).toBe(true);

    const requesterNoteRes = await request(app)
      .get(`/api/tickets/${ticketId}/notes`)
      .set("Cookie", requesterCookie);

    expect(requesterNoteRes.status).toBe(403);
  });
});
