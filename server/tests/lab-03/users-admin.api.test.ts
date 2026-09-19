import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { generateToken } from "../../src/authMiddleware.js";

function extractCookie(res: request.Response): string {
  const raw = res.headers["set-cookie"];
  if (!raw) throw new Error("Expected a Set-Cookie header");
  const cookies = Array.isArray(raw) ? raw : [raw];
  const tokenCookie = cookies.find((c) => c.startsWith("token="));
  if (!tokenCookie) throw new Error("Expected token cookie");
  return tokenCookie.split(";")[0];
}

describe("Administrator user management", () => {
  let adminCookie: string;

  beforeEach(async () => {
    const adminLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@example.com", password: "TempPass123!" });
    adminCookie = extractCookie(adminLogin);
  });

  it("lists users with search and role filters for administrators", async () => {
    const createRes = await request(app)
      .post("/api/users")
      .set("Cookie", adminCookie)
      .send({
        name: "Alpha Admin User",
        email: "alpha.user@example.com",
        role: "REQUESTER",
        isActive: true,
        initialPassword: "TempPass123!",
      });

    expect(createRes.status).toBe(201);

    const listRes = await request(app)
      .get("/api/users")
      .set("Cookie", adminCookie)
      .query({ search: "alpha" });

    expect(listRes.status).toBe(200);
    expect(listRes.body.some((user: { email: string }) => user.email === "alpha.user@example.com")).toBe(true);

    const roleRes = await request(app)
      .get("/api/users")
      .set("Cookie", adminCookie)
      .query({ role: "REQUESTER" });

    expect(roleRes.status).toBe(200);
    expect(roleRes.body.some((user: { email: string }) => user.email === "alpha.user@example.com")).toBe(true);
  });

  it("creates a valid user, rejects duplicate emails, and rejects invalid roles", async () => {
    const createRes = await request(app)
      .post("/api/users")
      .set("Cookie", adminCookie)
      .send({
        name: "New Ticket User",
        email: "new.ticket.user@example.com",
        role: "REQUESTER",
        isActive: true,
        initialPassword: "TempPass123!",
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.email).toBe("new.ticket.user@example.com");
    expect(createRes.body.requiresPasswordChange).toBe(true);

    const duplicateRes = await request(app)
      .post("/api/users")
      .set("Cookie", adminCookie)
      .send({
        name: "Duplicate User",
        email: "new.ticket.user@example.com",
        role: "REQUESTER",
        isActive: true,
        initialPassword: "TempPass123!",
      });

    expect(duplicateRes.status).toBe(409);
    expect(duplicateRes.body.error).toBe("DUPLICATE_EMAIL");

    const invalidRoleRes = await request(app)
      .post("/api/users")
      .set("Cookie", adminCookie)
      .send({
        name: "Bad Role User",
        email: "bad.role.user@example.com",
        role: "INVALID_ROLE",
        isActive: true,
        initialPassword: "TempPass123!",
      });

    expect(invalidRoleRes.status).toBe(400);
    expect(invalidRoleRes.body.error).toBe("INVALID_ROLE");
  });

  it("updates a user and prevents self deactivation and last admin deactivation", async () => {
    const created = await request(app)
      .post("/api/users")
      .set("Cookie", adminCookie)
      .send({
        name: "Editable User",
        email: "editable.user@example.com",
        role: "IT_STAFF",
        isActive: true,
        initialPassword: "TempPass123!",
      });

    const updateRes = await request(app)
      .patch(`/api/users/${created.body.id}`)
      .set("Cookie", adminCookie)
      .send({ name: "Editable User Updated", email: "editable.user.updated@example.com", role: "IT_STAFF", isActive: true });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.name).toBe("Editable User Updated");
    expect(updateRes.body.email).toBe("editable.user.updated@example.com");

    const meRes = await request(app).get("/api/auth/me").set("Cookie", adminCookie);
    const adminId = meRes.body.user.id;

    const selfDeactivateRes = await request(app)
      .patch(`/api/users/${adminId}`)
      .set("Cookie", adminCookie)
      .send({ name: meRes.body.user.name, email: meRes.body.user.email, role: "ADMINISTRATOR", isActive: false });

    expect(selfDeactivateRes.status).toBe(400);
    expect(selfDeactivateRes.body.error).toBe("SELF_DEACTIVATION_FORBIDDEN");

    const inactiveAdmin = await request(app)
      .post("/api/users")
      .set("Cookie", adminCookie)
      .send({
        name: "Inactive Admin",
        email: "inactive.admin@example.com",
        role: "ADMINISTRATOR",
        isActive: false,
        initialPassword: "TempPass123!",
      });

    const inactiveAdminToken = generateToken({
      id: inactiveAdmin.body.id,
      email: inactiveAdmin.body.email,
      role: "ADMINISTRATOR",
      requiresPasswordChange: false,
    });

    const lastAdminRes = await request(app)
      .patch(`/api/users/${adminId}`)
      .set("Cookie", `token=${inactiveAdminToken}`)
      .send({ name: meRes.body.user.name, email: meRes.body.user.email, role: "ADMINISTRATOR", isActive: false });

    expect(lastAdminRes.status).toBe(400);
    expect(lastAdminRes.body.error).toBe("LAST_ACTIVE_ADMIN_FORBIDDEN");
  });

  it("resets user passwords and rejects non-admin access", async () => {
    const created = await request(app)
      .post("/api/users")
      .set("Cookie", adminCookie)
      .send({
        name: "Password Reset User",
        email: "reset.password.user@example.com",
        role: "REQUESTER",
        isActive: true,
        initialPassword: "TempPass123!",
      });

    const resetRes = await request(app)
      .post(`/api/users/${created.body.id}/reset-password`)
      .set("Cookie", adminCookie)
      .send({ newPassword: "NewStrongPass1" });

    expect(resetRes.status).toBe(200);
    expect(resetRes.body.requiresPasswordChange).toBe(true);

    const requesterLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "reset.password.user@example.com", password: "NewStrongPass1" });

    expect(requesterLogin.status).toBe(200);
    expect(requesterLogin.body.user.requiresPasswordChange).toBe(true);

    const forbiddenRes = await request(app)
      .get("/api/users")
      .set("Cookie", requesterLogin.headers["set-cookie"][0].split(";")[0]);

    expect(forbiddenRes.status).toBe(403);
  });
});
