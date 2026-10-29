import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { loginCookie } from "../helpers.js";

// Lab 4 hardening: requests authenticate with a session cookie instead of ?requesterId=.
let cookie: string;
let otherCookie: string;
let requesterId: number;

beforeAll(async () => {
  cookie = await loginCookie("jennifer.anderson@example.com");
  otherCookie = await loginCookie("michael.brown@example.com");
  requesterId = (await request(app).get("/api/auth/me").set("Cookie", cookie)).body.user.id;
  const cat = await request(app).get("/api/categories");
  const sys = await request(app).get("/api/related-systems");

  // seed a couple of tickets for this requester to search/filter/sort against
  for (const [summary, description, requestedPriority] of [
    ["Laptop battery drains quickly", "Battery drains much faster than usual since last update.", "MEDIUM"],
    ["Cannot connect to VPN", "VPN client fails to authenticate on campus network.", "HIGH"],
  ]) {
    await request(app).post("/api/tickets").set("Cookie", cookie).send({
      categoryId: cat.body[0].id, relatedSystemId: sys.body[0].id, summary, description, requestedPriority,
    });
  }
});

describe("GET /api/tickets", () => {
  it("returns a paginated list scoped to the requester (API-05)", async () => {
    const res = await request(app).get("/api/tickets?page=1&pageSize=10").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body.pagination.page).toBe(1);
    expect(res.body.data.every((t: { requesterId: number }) => t.requesterId === requesterId)).toBe(true);
  });

  it("searches by summary text (API-06)", async () => {
    const res = await request(app).get("/api/tickets?search=VPN").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data.every((t: { summary: string }) => t.summary.toLowerCase().includes("vpn"))).toBe(true);
  });

  it("filters by requestedPriority (API-07)", async () => {
    const res = await request(app).get("/api/tickets?requestedPriority=HIGH").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.every((t: { requestedPriority: string }) => t.requestedPriority === "HIGH")).toBe(true);
  });

  it("sorts by createdAt descending by default (API-08)", async () => {
    const res = await request(app).get("/api/tickets").set("Cookie", cookie);
    const dates = res.body.data.map((t: { createdAt: string }) => new Date(t.createdAt).getTime());
    const sorted = [...dates].sort((a, b) => b - a);
    expect(dates).toEqual(sorted);
  });

  it("returns an empty array with totalItems 0 for a search with no matches (API-09)", async () => {
    const res = await request(app).get("/api/tickets?search=zzzznomatch").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.pagination.totalItems).toBe(0);
  });

  it("does not return another requester's tickets", async () => {
    const res = await request(app).get("/api/tickets").set("Cookie", otherCookie);
    expect(res.body.data.some((t: { requesterId: number }) => t.requesterId === requesterId)).toBe(false);
  });

  it("requires a session; ?requesterId= alone is rejected", async () => {
    const res = await request(app).get(`/api/tickets?requesterId=${requesterId}`);
    expect(res.status).toBe(401);
  });
});
