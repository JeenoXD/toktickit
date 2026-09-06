import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";

describe("POST /api/tickets", () => {
  it("creates a valid ticket and returns 201 with a ticketNumber", async () => {
    const catRes = await request(app).get("/api/categories");
    const sysRes = await request(app).get("/api/related-systems");

    expect(catRes.body.length).toBeGreaterThan(0);
    expect(sysRes.body.length).toBeGreaterThan(0);

    const res = await request(app).post("/api/tickets").send({
      requesterId: 1,
      categoryId: catRes.body[0].id,
      relatedSystemId: sysRes.body[0].id,
      summary: "Laptop battery drains quickly",
      description: "Battery drains much faster than usual since the last update.",
      requestedPriority: "MEDIUM",
    });

    expect(res.status).toBe(201);
    expect(res.body.ticketNumber).toMatch(/^TKT-\d{4}-\d{6}$/);
    expect(res.body.summary).toBe("Laptop battery drains quickly");
    expect(res.body.currentStatus).toBe("NEW");
  });

  it("rejects an empty summary with a field-level error", async () => {
    const catRes = await request(app).get("/api/categories");
    const sysRes = await request(app).get("/api/related-systems");

    const res = await request(app).post("/api/tickets").send({
      requesterId: 1,
      categoryId: catRes.body[0].id,
      relatedSystemId: sysRes.body[0].id,
      summary: "",
      description: "Valid description text here that is long enough.",
      requestedPriority: "MEDIUM",
    });

    expect(res.status).toBe(400);
    expect(res.body.fields.summary).toBeDefined();
  });

  it("rejects an invalid requestedPriority", async () => {
    const catRes = await request(app).get("/api/categories");
    const sysRes = await request(app).get("/api/related-systems");

    const res = await request(app).post("/api/tickets").send({
      requesterId: 1,
      categoryId: catRes.body[0].id,
      relatedSystemId: sysRes.body[0].id,
      summary: "Valid summary here",
      description: "Valid description text here that is long enough.",
      requestedPriority: "URGENT",
    });

    expect(res.status).toBe(400);
    expect(res.body.fields.requestedPriority).toBeDefined();
  });

  it("returns 404 for a nonexistent category", async () => {
    const sysRes = await request(app).get("/api/related-systems");

    const res = await request(app).post("/api/tickets").send({
      requesterId: 1,
      categoryId: 999999,
      relatedSystemId: sysRes.body[0].id,
      summary: "Valid summary here",
      description: "Valid description text here that is long enough.",
      requestedPriority: "LOW",
    });

    expect(res.status).toBe(404);
  });
});