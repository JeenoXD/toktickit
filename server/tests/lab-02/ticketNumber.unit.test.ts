import { describe, it, expect } from "vitest";
import { generateTicketNumber } from "../../src/ticketNumber.js";

describe("generateTicketNumber", () => {
  it("returns the required TKT-YYYY-NNNNNN format", () => {
    const year = new Date().getFullYear();
    expect(generateTicketNumber(101)).toBe(`TKT-${year}-000101`);
  });
});