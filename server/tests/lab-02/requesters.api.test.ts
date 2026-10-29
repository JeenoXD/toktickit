import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../../src/app.js";
import { loginCookie } from "../helpers.js";

describe("GET /api/requesters", () => {
  it("returns only active requesters to IT Staff", async () => {
    const res = await request(app).get("/api/requesters").set("Cookie", await loginCookie("it.staff@example.com"));
    expect(res.status).toBe(200);
    expect(res.body.some((r: { email: string }) => r.email === "inactive.user@example.com")).toBe(false);
  });

  // Lab 4 hardening: names and emails are no longer public.
  it("is not available without a session or to Requesters", async () => {
    expect((await request(app).get("/api/requesters")).status).toBe(401);
    const asRequester = await request(app).get("/api/requesters").set("Cookie", await loginCookie("michael.brown@example.com"));
    expect(asRequester.status).toBe(403);
  });
});
