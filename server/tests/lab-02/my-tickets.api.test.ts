import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";

let requesterId: number;
let categoryId: number;
let relatedSystemId: number;

beforeAll(async () => {
  const req = await request(app).get("/api/requesters");
  requesterId = req.body[0].id;
  const cat = await request(app).get("/api/categories");
  categoryId = cat.body[0].id;
  const sys = await request(app).get("/api/related-systems");
  relatedSystemId = sys.body[0].id;

  // seed a couple of tickets for this requester to search/filter/sort against
  await request(app).post("/api/tickets").send({
    requesterId, categoryId, relatedSystemId,
    summary: "Laptop battery drains quickly",
    description: "Battery drains much faster than usual since last update.",
    requestedPriority: "MEDIUM",
  });
  await request(app).post("/api/tickets").send({
    requesterId, categoryId, relatedSystemId,
    summary: "Cannot connect to VPN",
    description: "VPN client fails to authenticate on campus network.",
    requestedPriority: "HIGH",
  });
});

describe("GET /api/tickets", () => {
  it("returns a paginated list scoped to the requester (API-05)", async () => {
    const res = await request(app).get(`/api/tickets?requesterId=${requesterId}&page=1&pageSize=10`);
    expect(res.status).toBe(200);
    expect(res.body.pagination.page).toBe(1);
    expect(res.body.data.every((t: { requesterId: number }) => t.requesterId === requesterId)).toBe(true);
  });

  it("searches by summary text (API-06)", async () => {
    const res = await request(app).get(`/api/tickets?requesterId=${requesterId}&search=VPN`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data.every((t: { summary: string }) => t.summary.toLowerCase().includes("vpn"))).toBe(true);
  });

  it("filters by requestedPriority (API-07)", async () => {
    const res = await request(app).get(`/api/tickets?requesterId=${requesterId}&requestedPriority=HIGH`);
    expect(res.status).toBe(200);
    expect(res.body.data.every((t: { requestedPriority: string }) => t.requestedPriority === "HIGH")).toBe(true);
  });

  it("sorts by createdAt descending by default (API-08)", async () => {
    const res = await request(app).get(`/api/tickets?requesterId=${requesterId}`);
    const dates = res.body.data.map((t: { createdAt: string }) => new Date(t.createdAt).getTime());
    const sorted = [...dates].sort((a, b) => b - a);
    expect(dates).toEqual(sorted);
  });

  it("returns an empty array with totalItems 0 for a search with no matches (API-09)", async () => {
    const res = await request(app).get(`/api/tickets?requesterId=${requesterId}&search=zzzznomatch`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.pagination.totalItems).toBe(0);
  });

  it("does not return another requester's tickets", async () => {
    const allRequesters = await request(app).get("/api/requesters");
    const otherRequester = allRequesters.body.find((r: { id: number }) => r.id !== requesterId);
    if (otherRequester) {
      const res = await request(app).get(`/api/tickets?requesterId=${otherRequester.id}`);
      expect(res.body.data.every((t: { requesterId: number }) => t.requesterId === otherRequester.id)).toBe(true);
    }
  });
});