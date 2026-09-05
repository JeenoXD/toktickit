import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";

let ownerId: number;
let otherId: number;
let ticketId: number;

beforeAll(async () => {
  const requesters = await request(app).get("/api/requesters");
  ownerId = requesters.body[0].id;
  otherId = requesters.body.find((r: { id: number }) => r.id !== ownerId)?.id ?? requesters.body[1].id;

  const cat = await request(app).get("/api/categories");
  const sys = await request(app).get("/api/related-systems");

  const created = await request(app).post("/api/tickets").send({
    requesterId: ownerId,
    categoryId: cat.body[0].id,
    relatedSystemId: sys.body[0].id,
    summary: "Test ticket for detail access",
    description: "Description long enough to pass validation.",
    requestedPriority: "LOW",
  });
  ticketId = created.body.id;
});

describe("GET /api/tickets/:id", () => {
  it("returns the ticket for its owner", async () => {
    const res = await request(app).get(`/api/tickets/${ticketId}?requesterId=${ownerId}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(ticketId);
  });

  it("returns 404 when a different requester requests it (API-04)", async () => {
    const res = await request(app).get(`/api/tickets/${ticketId}?requesterId=${otherId}`);
    expect(res.status).toBe(404);
  });
});