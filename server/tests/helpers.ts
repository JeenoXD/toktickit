// Shared test helper: log in with a seeded account and return the session cookie.
import request from "supertest";
import { app } from "../src/app.js";

export const SEED_PASSWORD = "TempPass123!";

export async function loginCookie(email: string): Promise<string> {
  const res = await request(app).post("/api/auth/login").send({ email, password: SEED_PASSWORD });
  const raw = res.headers["set-cookie"];
  const cookies = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const token = cookies.find((c) => c.startsWith("token="));
  if (!token) throw new Error(`Login failed for ${email}: ${res.status}`);
  return token.split(";")[0];
}
