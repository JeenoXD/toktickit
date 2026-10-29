// SEC-01: every protected endpoint rejects requests without a session, including
// the removed Lab 2 "?requesterId=" shortcut (BR-03, hardening).
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import * as prismaModule from "../../src/prisma.js";

const PROTECTED: Array<[method: "get" | "post" | "patch" | "delete", path: string]> = [
  ["get", "/api/tickets?requesterId=1"],
  ["post", "/api/tickets?requesterId=1"],
  ["get", "/api/tickets/1?requesterId=1"],
  ["get", "/api/tickets/queue"],
  ["get", "/api/tickets/1/comments?requesterId=1"],
  ["post", "/api/tickets/1/comments?requesterId=1"],
  ["get", "/api/tickets/1/notes"],
  ["post", "/api/tickets/1/notes"],
  ["post", "/api/tickets/1/attachments?requesterId=1"],
  ["get", "/api/attachments/1/download?requesterId=1"],
  ["delete", "/api/attachments/1?requesterId=1"],
  ["get", "/api/tickets/1/actions"],
  ["post", "/api/tickets/1/actions"],
  ["patch", "/api/tickets/1/actions/1"],
  ["patch", "/api/tickets/1/actions/1/status"],
  ["patch", "/api/tickets/1/status"],
  ["patch", "/api/tickets/1/claim"],
  ["patch", "/api/tickets/1/reassign"],
  ["patch", "/api/tickets/1/priority"],
  ["patch", "/api/tickets/1/requester-resolved?requesterId=1"],
  ["get", "/api/tickets/1/status-history"],
  ["get", "/api/tickets/1/allowed-transitions"],
  ["get", "/api/dashboard/requester?requesterId=1"],
  ["get", "/api/dashboard/staff"],
  ["get", "/api/staff-users"],
  ["get", "/api/requesters"],
  ["get", "/api/users"],
  ["post", "/api/users"],
  ["patch", "/api/users/1"],
  ["post", "/api/users/1/reset-password"],
  ["get", "/api/auth/me"],
];

describe("SEC-01: no session, no access", () => {
  it.each(PROTECTED)("%s %s returns 401", async (method, path) => {
    const res = await request(app)[method](path).send({ requesterId: 1, content: "x", description: "x" });
    expect(res.status).toBe(401);
  });

  it("rejects a forged token", async () => {
    const res = await request(app).get("/api/tickets").set("Cookie", "token=not-a-real-token");
    expect(res.status).toBe(401);
  });
});

describe("health check", () => {
  it("reports 503 without leaking details when the database is down", async () => {
    const spy = vi.spyOn(prismaModule, "getPrisma").mockReturnValue({
      $queryRaw: () => Promise.reject(new Error("connection refused at 10.0.0.5")),
    } as unknown as ReturnType<typeof prismaModule.getPrisma>);
    const res = await request(app).get("/api/health");
    spy.mockRestore();
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: "degraded", service: "TokTickIT API", database: "unavailable" });
    expect(JSON.stringify(res.body)).not.toContain("10.0.0.5");
  });
});
