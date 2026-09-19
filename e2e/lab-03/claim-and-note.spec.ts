import { test, expect, request as playwrightRequest, APIRequestContext } from "@playwright/test";
import { loginAsUser, apiLoginWithStandardPassword } from "../support/auth.js";

const API_URL = "http://localhost:3000";
const REQUESTER_EMAIL = "michael.brown@example.com";
const IT_EMAIL = "it.staff@example.com";
const IT_STAFF_USER_ID = 6; // seed order: jennifer(1) michael(2) sarah(3) david(4) inactive(5) it.staff(6) admin(7)

let api: APIRequestContext;
const TICKET_SUMMARY = "Claim And Note Test Ticket";

test.describe("Lab 3 IT Staff claim ticket and internal note", () => {
  test.beforeAll(async () => {
    api = await playwrightRequest.newContext({ baseURL: API_URL });

    await apiLoginWithStandardPassword(api, API_URL, REQUESTER_EMAIL);

    const categories = await (await api.get("/api/categories")).json();
    const systems = await (await api.get("/api/related-systems")).json();

    const ticketRes = await api.post("/api/tickets", {
      data: {
        categoryId: categories[0].id,
        relatedSystemId: systems[0].id,
        summary: TICKET_SUMMARY,
        description: "Ticket created for the claim-and-internal-note E2E coverage, long enough to pass validation.",
        requestedPriority: "MEDIUM",
      },
    });
    expect(ticketRes.status()).toBe(201);

    await apiLoginWithStandardPassword(api, API_URL, IT_EMAIL);
  });

  test("claims an unassigned ticket and adds an internal note", async ({ page }) => {
    await loginAsUser(page, IT_EMAIL);
    await page.getByRole("button", { name: /ticket queue/i }).click();
    await page.getByLabel("Search").fill(TICKET_SUMMARY);
    // Both the desktop table and the mobile card layout render this text;
    // only one is visible at a time (the other stays in the DOM, CSS-hidden).
    await expect(page.getByText(TICKET_SUMMARY, { exact: true }).and(page.locator(":visible"))).toBeVisible({ timeout: 10000 });
    await page.getByRole("button", { name: /open ticket/i }).click();

    await expect(page.getByRole("heading", { level: 2 })).toContainText("Ticket");

    const currentOwnerValue = page.locator('strong:has-text("Current owner") + div');
    await expect(currentOwnerValue).toHaveText("Unassigned");

    await page.getByRole("button", { name: /^claim$/i }).click();
    await expect(currentOwnerValue).toHaveText(String(IT_STAFF_USER_ID));

    await expect(page.getByText("No internal notes yet.")).toBeVisible();

    const noteText = "Checked the affected device, escalating to hardware team.";
    await page.locator("#internal-note").fill(noteText);
    await page.getByRole("button", { name: /add note/i }).click();

    await expect(page.getByText(noteText)).toBeVisible();
    await expect(page.getByText("No internal notes yet.")).not.toBeVisible();
  });
});