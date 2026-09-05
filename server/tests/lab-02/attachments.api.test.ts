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
    summary: "Test ticket for attachments",
    description: "Description long enough to pass validation.",
    requestedPriority: "LOW",
  });
  ticketId = created.body.id;
});

describe("Attachment lifecycle", () => {
  it("uploads a valid attachment", async () => {
    const res = await request(app)
      .post(`/api/tickets/${ticketId}/attachments`)
      .field("requesterId", String(ownerId))
      .attach("file", Buffer.from("fake image content"), { filename: "test.png", contentType: "image/png" });

    expect(res.status).toBe(201);
    expect(res.body.filename).toBe("test.png");
  });

  it("rejects an oversized attachment (API-03)", async () => {
    const bigBuffer = Buffer.alloc(6 * 1024 * 1024);
    const res = await request(app)
      .post(`/api/tickets/${ticketId}/attachments`)
      .field("requesterId", String(ownerId))
      .attach("file", bigBuffer, { filename: "big.png", contentType: "image/png" });

    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("rejects adding an attachment as a non-owner (API-12)", async () => {
    const res = await request(app)
      .post(`/api/tickets/${ticketId}/attachments`)
      .field("requesterId", String(otherId))
      .attach("file", Buffer.from("fake"), { filename: "test.png", contentType: "image/png" });

    expect(res.status).toBe(404);
  });

  it("soft-removes an attachment and blocks its download (API-10, API-11)", async () => {
    const uploadRes = await request(app)
      .post(`/api/tickets/${ticketId}/attachments`)
      .field("requesterId", String(ownerId))
      .attach("file", Buffer.from("removable"), { filename: "remove-me.png", contentType: "image/png" });

    const attachmentId = uploadRes.body.id;

    const removeRes = await request(app)
      .delete(`/api/attachments/${attachmentId}`)
      .send({ requesterId: ownerId, reason: "Uploaded wrong file" });

    expect(removeRes.status).toBe(200);
    expect(removeRes.body.removedAt).not.toBeNull();

    const downloadRes = await request(app).get(`/api/attachments/${attachmentId}/download?requesterId=${ownerId}`);
    expect(downloadRes.status).toBe(410);
  });
});