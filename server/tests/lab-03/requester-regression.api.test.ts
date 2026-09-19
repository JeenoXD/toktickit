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

describe("Requester session-based ticket access and public comments", () => {
  let ownerCookie: string;
  let otherCookie: string;
  let ticketId: number;

  beforeEach(async () => {
    const ownerLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "michael.brown@example.com", password: "TempPass123!" });
    ownerCookie = extractCookie(ownerLogin);

    const otherLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "jennifer.anderson@example.com", password: "TempPass123!" });
    otherCookie = extractCookie(otherLogin);

    const cat = await request(app).get("/api/categories");
    const sys = await request(app).get("/api/related-systems");

    const created = await request(app)
      .post("/api/tickets")
      .set("Cookie", ownerCookie)
      .send({
        categoryId: cat.body[0].id,
        relatedSystemId: sys.body[0].id,
        summary: "Repro ticket for issue 3",
        description: "This description is long enough to pass validation.",
        requestedPriority: "MEDIUM",
      });

    ticketId = created.body.id;
  });

  it("uses the authenticated requester identity instead of a client-supplied requesterId", async () => {
    const listRes = await request(app).get("/api/tickets").set("Cookie", ownerCookie);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.some((t: { id: number }) => t.id === ticketId)).toBe(true);

    const otherTicketRes = await request(app)
      .get(`/api/tickets/${ticketId}`)
      .set("Cookie", otherCookie);
    expect(otherTicketRes.status).toBe(404);
  });

  it("creates and retrieves a public comment for the owning requester", async () => {
    const commentRes = await request(app)
      .post(`/api/tickets/${ticketId}/comments`)
      .set("Cookie", ownerCookie)
      .send({ content: "The issue is still happening." });

    expect(commentRes.status).toBe(201);
    expect(commentRes.body.content).toBe("The issue is still happening.");

    const listRes = await request(app)
      .get(`/api/tickets/${ticketId}/comments`)
      .set("Cookie", ownerCookie);

    expect(listRes.status).toBe(200);
    expect(listRes.body.some((item: { content: string }) => item.content === "The issue is still happening.")).toBe(true);
  });

  it("allows a requester to flag a ticket as appearing resolved", async () => {
    const res = await request(app)
      .patch(`/api/tickets/${ticketId}/requester-resolved`)
      .set("Cookie", ownerCookie);

    expect(res.status).toBe(200);
    expect(res.body.currentStatus).toBe("IN_PROGRESS");
  });

      it("rejects marking a resolved ticket as appears resolved", async () => {
    const staffLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "it.staff@example.com", password: "TempPass123!" });
    const staffCookie = extractCookie(staffLogin);

    await request(app).patch(`/api/tickets/${ticketId}/status`).set("Cookie", staffCookie).send({ status: "OPEN" });
    await request(app).patch(`/api/tickets/${ticketId}/status`).set("Cookie", staffCookie).send({ status: "IN_PROGRESS" });
    const resolveRes = await request(app).patch(`/api/tickets/${ticketId}/status`).set("Cookie", staffCookie).send({ status: "RESOLVED" });
    expect(resolveRes.status).toBe(200);

    const res = await request(app)
      .patch(`/api/tickets/${ticketId}/requester-resolved`)
      .set("Cookie", ownerCookie);

    expect(res.status).toBe(400);
  });
});
