import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, validatePasswordStrength } from "../../src/password.js";

describe("hashPassword", () => {
  it("returns a bcrypt hash, never the plaintext password (UNIT-01)", async () => {
    const plain = "TempPass123!";
    const hash = await hashPassword(plain);

    expect(hash).not.toBe(plain);
    expect(hash).toMatch(/^\$2[aby]\$\d{2}\$/); // bcrypt hash format
  });

  it("produces a different hash each time due to salting", async () => {
    const hash1 = await hashPassword("SamePassword1!");
    const hash2 = await hashPassword("SamePassword1!");
    expect(hash1).not.toBe(hash2);
  });
});

describe("verifyPassword", () => {
  it("returns true for the correct plaintext against its hash", async () => {
    const hash = await hashPassword("CorrectHorse1!");
    const result = await verifyPassword("CorrectHorse1!", hash);
    expect(result).toBe(true);
  });

  it("returns false for an incorrect plaintext", async () => {
    const hash = await hashPassword("CorrectHorse1!");
    const result = await verifyPassword("WrongPassword1!", hash);
    expect(result).toBe(false);
  });
});

describe("validatePasswordStrength", () => {
  it("accepts a password meeting all requirements", () => {
    const result = validatePasswordStrength("ValidPass123");
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("rejects a password shorter than 8 characters", () => {
    const result = validatePasswordStrength("Ab1");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Password must be at least 8 characters long");
  });

  it("rejects a password with no uppercase letter", () => {
    const result = validatePasswordStrength("lowercase123");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Password must contain at least one uppercase letter");
  });

  it("rejects a password with no lowercase letter", () => {
    const result = validatePasswordStrength("UPPERCASE123");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Password must contain at least one lowercase letter");
  });

  it("rejects a password with no number", () => {
    const result = validatePasswordStrength("NoNumbersHere");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Password must contain at least one number");
  });

  it("returns multiple errors when several rules fail at once", () => {
    const result = validatePasswordStrength("bad");
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(1);
  });
});