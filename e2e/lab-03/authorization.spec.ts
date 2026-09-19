import { test, expect } from "@playwright/test";
import { loginAsUser } from "../support/auth.js";

const REQUESTER_EMAIL = "sarah.johnson@example.com";
const API_URL = "http://localhost:3000";

test.describe("Lab 3 authorization: requester cannot access IT/Admin features", () => {
  test("hides IT/Admin navigation and blocks direct API access for a requester", async ({ page }) => {
    await loginAsUser(page, REQUESTER_EMAIL);

    // UI: IT Staff and Administrator-only nav items must not render for a requester.
    await expect(page.getByRole("button", { name: /ticket queue/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /user management/i })).toHaveCount(0);

    // API: hiding the buttons isn't real security on its own, the backend
    // must also reject these requests directly for this role. page.request
    // shares the same authenticated cookie as the page itself.
    const queueRes = await page.request.get(`${API_URL}/api/tickets/queue`);
    expect(queueRes.status()).toBe(403);

    const usersRes = await page.request.get(`${API_URL}/api/users`);
    expect(usersRes.status()).toBe(403);
  });
});