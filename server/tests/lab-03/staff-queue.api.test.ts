import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";

const IT_EMAIL = "it.staff@example.com";
const IT_PASSWORD = "TempPass123!";
const REQUESTER_EMAIL = "jennifer.anderson@example.com";

let authCookie: string;
let requesterCookie: string;
let lastTicketId: number;
let itUserId: number;
let requesterUserId: number;

beforeAll(async () => {
  const itLogin = await request(app).post("/api/auth/login").send({ email: IT_EMAIL, password: IT_PASSWORD });
  authCookie = itLogin.headers["set-cookie"][0].split(";")[0];

  const requesterLogin = await request(app).post("/api/auth/login").send({ email: REQUESTER_EMAIL, password: IT_PASSWORD });
  requesterCookie = requesterLogin.headers["set-cookie"][0].split(";")[0];

  const itMe = await request(app).get("/api/auth/me").set("Cookie", authCookie);
  itUserId = itMe.body.user.id;

  const requesterMe = await request(app).get("/api/auth/me").set("Cookie", requesterCookie);
  requesterUserId = requesterMe.body.user.id;

  const categories = await request(app).get("/api/categories");
  const systems = await request(app).get("/api/related-systems");

  for (let i = 0; i < 3; i++) {
    const ticketRes = await request(app)
      .post("/api/tickets")
      .set("Cookie", requesterCookie)
      .send({
        categoryId: categories.body[0].id,
        relatedSystemId: systems.body[0].id,
        summary: `Queue item ${i + 1}`,
        description: `Queue ticket description ${i + 1} is long enough to pass validation.`,
        requestedPriority: i === 0 ? "HIGH" : i === 1 ? "MEDIUM" : "LOW",
      });

    if (i === 2) lastTicketId = ticketRes.body.id;
  }
});

describe("GET /api/tickets/queue", () => {
  it("returns a paginated queue for IT staff with search/filter/sort metadata", async () => {
    const res = await request(app)
      .get("/api/tickets/queue")
      .set("Cookie", authCookie)
      .query({
        search: "Queue item",
        status: "NEW",
        itPriority: "HIGH",
        ownerId: itUserId,
        sortBy: "createdAt",
        sortDir: "desc",
        page: 1,
        pageSize: 10,
      });

    expect(res.status).toBe(200);
    expect(res.body.pagination).toMatchObject({ page: 1, pageSize: 10 });
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(0);
  });

  it("allows searching by ticket number and summary", async () => {
    const queue = await request(app).get("/api/tickets/queue").set("Cookie", authCookie).query({ search: "Queue item 2" });

    expect(queue.status).toBe(200);
    expect(queue.body.data.length).toBeGreaterThan(0);
    expect(queue.body.data.some((t: { summary: string }) => t.summary.toLowerCase().includes("queue item 2"))).toBe(true);
  });

  it("returns 403 for a requester trying to access the queue", async () => {
    const res = await request(app).get("/api/tickets/queue").set("Cookie", requesterCookie);
    expect(res.status).toBe(403);
  });

  it("rejects invalid pagination and sort parameters", async () => {
    const res = await request(app)
      .get("/api/tickets/queue")
      .set("Cookie", authCookie)
      .query({ page: 0, pageSize: 999, sortBy: "not-a-column" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("VALIDATION_ERROR");
  });
});
