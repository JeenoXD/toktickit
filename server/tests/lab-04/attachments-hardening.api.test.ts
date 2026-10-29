// SEC-03: attachments are authenticated before upload, rejected uploads leave no
// file behind, and IT Staff can open attachments that Actions Taken refer to.
import { describe, it, expect, beforeAll } from "vitest";
import { readdirSync } from "node:fs";
import request from "supertest";
import { app } from "../../src/app.js";
import { loginCookie } from "../helpers.js";

const fileCount = () => readdirSync("uploads").length;

describe("Attachment hardening", () => {
  let ownerCookie: string;
  let otherCookie: string;
  let staffCookie: string;
  let ticketId: number;
  let attachmentId: number;

  beforeAll(async () => {
    ownerCookie = await loginCookie("michael.brown@example.com");
    otherCookie = await loginCookie("jennifer.anderson@example.com");
    staffCookie = await loginCookie("it.staff@example.com");
    const cat = await request(app).get("/api/categories");
    const sys = await request(app).get("/api/related-systems");
    const created = await request(app).post("/api/tickets").set("Cookie", ownerCookie).send({
      categoryId: cat.body[0].id,
      relatedSystemId: sys.body[0].id,
      summary: "Attachment hardening ticket",
      description: "Ticket for attachment hardening tests.",
      requestedPriority: "LOW",
    });
    ticketId = created.body.id;
    const upload = await request(app)
      .post(`/api/tickets/${ticketId}/attachments`)
      .set("Cookie", ownerCookie)
      .attach("file", Buffer.from("screenshot"), { filename: "error.png", contentType: "image/png" });
    expect(upload.status).toBe(201);
    attachmentId = upload.body.id;
  });

  it("rejects an anonymous upload without writing a file", async () => {
    const before = fileCount();
    const res = await request(app)
      .post(`/api/tickets/${ticketId}/attachments`)
      .attach("file", Buffer.from("anonymous"), { filename: "anon.png", contentType: "image/png" });
    expect(res.status).toBe(401);
    expect(fileCount()).toBe(before);
  });

  it("removes the stored file when a non-owner's upload is rejected", async () => {
    const before = fileCount();
    const res = await request(app)
      .post(`/api/tickets/${ticketId}/attachments`)
      .set("Cookie", otherCookie)
      .attach("file", Buffer.from("not yours"), { filename: "other.png", contentType: "image/png" });
    expect(res.status).toBe(404);
    // unlink is asynchronous; give it a moment.
    await new Promise((r) => setTimeout(r, 100));
    expect(fileCount()).toBe(before);
  });

  it("lets IT Staff download, but not another requester", async () => {
    const staff = await request(app).get(`/api/attachments/${attachmentId}/download`).set("Cookie", staffCookie);
    expect(staff.status).toBe(200);
    const other = await request(app).get(`/api/attachments/${attachmentId}/download`).set("Cookie", otherCookie);
    expect(other.status).toBe(404);
  });

  it("includes attachments in the staff ticket detail", async () => {
    const res = await request(app).get(`/api/tickets/${ticketId}`).set("Cookie", staffCookie);
    expect(res.body.attachments.map((a: { filename: string }) => a.filename)).toContain("error.png");
  });
});
