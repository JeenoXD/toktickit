import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { loginCookie } from "../helpers.js";

let ownerCookie: string;
let otherCookie: string;
let ticketId: number;

beforeAll(async () => {
  ownerCookie = await loginCookie("michael.brown@example.com");
  otherCookie = await loginCookie("jennifer.anderson@example.com");
  const cat = await request(app).get("/api/categories");
  const sys = await request(app).get("/api/related-systems");

  const created = await request(app).post("/api/tickets").set("Cookie", ownerCookie).send({
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
    const res = await request(app).get(`/api/tickets/${ticketId}`).set("Cookie", ownerCookie);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(ticketId);
  });

  it("returns 404 when a different requester requests it (API-04)", async () => {
    const res = await request(app).get(`/api/tickets/${ticketId}`).set("Cookie", otherCookie);
    expect(res.status).toBe(404);
  });

  it("returns 401 without a session, even with ?requesterId=", async () => {
    const res = await request(app).get(`/api/tickets/${ticketId}?requesterId=1`);
    expect(res.status).toBe(401);
  });
});
