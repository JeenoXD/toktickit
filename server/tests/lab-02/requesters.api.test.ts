import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../../src/app.js";

describe("GET /api/requesters", () => {
  it("returns only active requesters", async () => {
    const res = await request(app).get("/api/requesters");
    expect(res.status).toBe(200);
    expect(res.body.some((r: { email: string }) => r.email === "inactive.user@example.com")).toBe(false);
  });
});