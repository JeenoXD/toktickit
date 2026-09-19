import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";

// Seeded accounts (see server/prisma/seed.ts):
// jennifer.anderson@example.com — REQUESTER, active, password "TempPass123!"
// inactive.user@example.com     — REQUESTER, isActive: false
const ACTIVE_EMAIL = "jennifer.anderson@example.com";
const INACTIVE_EMAIL = "inactive.user@example.com";
const SEEDED_PASSWORD = "TempPass123!";

function extractCookie(res: request.Response): string {
  const raw = res.headers["set-cookie"];
  if (!raw) throw new Error("Expected a Set-Cookie header on the response");
  const cookies = Array.isArray(raw) ? raw : [raw];
  const tokenCookie = cookies.find((c) => c.startsWith("token="));
  if (!tokenCookie) throw new Error("Expected a token cookie in Set-Cookie");
  return tokenCookie.split(";")[0]; // strip attributes, keep "token=..."
}

describe("POST /api/auth/login", () => {
  it("logs in with valid credentials, sets an HTTP-only cookie, and returns safe user data (API-01)", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: ACTIVE_EMAIL, password: SEEDED_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({
      email: ACTIVE_EMAIL,
      role: "REQUESTER",
    });
    expect(res.body.user.password).toBeUndefined();

    const cookieHeader = res.headers["set-cookie"];
    expect(cookieHeader).toBeDefined();
    const cookies = Array.isArray(cookieHeader) ? cookieHeader : [cookieHeader];
    expect(cookies.some((c: string) => c.startsWith("token="))).toBe(true);
    expect(cookies.some((c: string) => /HttpOnly/i.test(c))).toBe(true);
  });

  it("reflects requiresPasswordChange: true for a freshly seeded user (API-02)", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: ACTIVE_EMAIL, password: SEEDED_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.user.requiresPasswordChange).toBe(true);
  });

  it("rejects an incorrect password with a safe, generic message", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: ACTIVE_EMAIL, password: "WrongPassword1!" });

    expect(res.status).toBe(401);
    expect(res.body.message).not.toMatch(/exist/i); // no user-enumeration hint
  });

  it("rejects a nonexistent email with the same generic message as a wrong password", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: "Whatever123!" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("INVALID_CREDENTIALS");
  });

  it("rejects login for an inactive account without revealing it exists", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: INACTIVE_EMAIL, password: SEEDED_PASSWORD });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("INVALID_CREDENTIALS");
    expect(res.body.message).not.toMatch(/inactive/i); // don't leak account state
  });

  it("returns 400 when email or password is missing", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: ACTIVE_EMAIL });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("VALIDATION_ERROR");
  });
});

describe("GET /api/auth/me", () => {
  it("returns the current user when a valid session cookie is present", async () => {
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: ACTIVE_EMAIL, password: SEEDED_PASSWORD });
    const cookie = extractCookie(loginRes);

    const meRes = await request(app).get("/api/auth/me").set("Cookie", cookie);

    expect(meRes.status).toBe(200);
    expect(meRes.body.user.email).toBe(ACTIVE_EMAIL);
  });

  it("returns 401 when no cookie is present", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("returns 401 for a malformed or tampered token", async () => {
    const res = await request(app).get("/api/auth/me").set("Cookie", "token=not-a-real-jwt");
    expect(res.status).toBe(401);
  });
});

describe("POST /api/auth/logout", () => {
  it("clears the session cookie", async () => {
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: ACTIVE_EMAIL, password: SEEDED_PASSWORD });
    const cookie = extractCookie(loginRes);

    const logoutRes = await request(app).post("/api/auth/logout").set("Cookie", cookie);
    expect(logoutRes.status).toBe(200);

    const clearHeader = logoutRes.headers["set-cookie"];
    expect(clearHeader).toBeDefined();
    const cleared = Array.isArray(clearHeader) ? clearHeader : [clearHeader];
    // clearCookie sends an expired/empty token cookie
    expect(cleared.some((c: string) => c.startsWith("token=;") || /Expires=Thu, 01 Jan 1970/i.test(c))).toBe(true);
  });
});

describe("POST /api/auth/change-password", () => {
  async function loginAndGetCookie(email: string, password: string) {
    const res = await request(app).post("/api/auth/login").send({ email, password });
    return extractCookie(res);
  }

  it("changes the password on the correct current password and a valid new one, clearing requiresPasswordChange", async () => {
    // Use a dedicated flow: login, change password, then verify old password no longer works
    // and requiresPasswordChange flips to false. Uses a throwaway strong password to avoid
    // colliding with other tests relying on the seeded default.
    const cookie = await loginAndGetCookie(ACTIVE_EMAIL, SEEDED_PASSWORD);

    const changeRes = await request(app)
      .post("/api/auth/change-password")
      .set("Cookie", cookie)
      .send({ currentPassword: SEEDED_PASSWORD, newPassword: "NewStrongPass1" });

    expect(changeRes.status).toBe(200);
    expect(changeRes.body.requiresPasswordChange).toBe(false);

    // Old password should no longer work
    const oldLoginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: ACTIVE_EMAIL, password: SEEDED_PASSWORD });
    expect(oldLoginRes.status).toBe(401);

    // New password should work, and requiresPasswordChange should now be false
    const newLoginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: ACTIVE_EMAIL, password: "NewStrongPass1" });
    expect(newLoginRes.status).toBe(200);
    expect(newLoginRes.body.user.requiresPasswordChange).toBe(false);

    // Restore original password so other tests / re-runs aren't affected
    const restoreCookie = extractCookie(newLoginRes);
    await request(app)
      .post("/api/auth/change-password")
      .set("Cookie", restoreCookie)
      .send({ currentPassword: "NewStrongPass1", newPassword: SEEDED_PASSWORD });
  });

  it("rejects the wrong current password", async () => {
    const cookie = await loginAndGetCookie(ACTIVE_EMAIL, SEEDED_PASSWORD);

    const res = await request(app)
      .post("/api/auth/change-password")
      .set("Cookie", cookie)
      .send({ currentPassword: "TotallyWrong1!", newPassword: "AnotherStrong1" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("INVALID_PASSWORD");
  });

  it("rejects a weak new password", async () => {
    const cookie = await loginAndGetCookie(ACTIVE_EMAIL, SEEDED_PASSWORD);

    const res = await request(app)
      .post("/api/auth/change-password")
      .set("Cookie", cookie)
      .send({ currentPassword: SEEDED_PASSWORD, newPassword: "weak" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("WEAK_PASSWORD");
  });

  it("requires authentication", async () => {
    const res = await request(app)
      .post("/api/auth/change-password")
      .send({ currentPassword: SEEDED_PASSWORD, newPassword: "AnotherStrong1" });

    expect(res.status).toBe(401);
  });
});