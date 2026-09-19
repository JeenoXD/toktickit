import { test, expect } from "@playwright/test";
import { loginAsUser } from "../support/auth.js";

const REQUESTER_EMAIL = "david.lee@example.com";
const SUMMARY = "Requester Regression Test Ticket";
const DESCRIPTION = "This description is long enough to pass validation for the requester regression E2E test.";

test.describe("Lab 3 Requester regression", () => {
  test("creates a ticket, finds it in My Tickets, and adds a public comment", async ({ page }) => {
    await loginAsUser(page, REQUESTER_EMAIL);

    // Create Ticket
    await page.getByRole("button", { name: /create ticket/i }).click();
    await page.locator("#categoryId").selectOption({ index: 1 });
    await page.locator("#relatedSystemId").selectOption({ index: 1 });
    await page.locator("#summary").fill(SUMMARY);
    await page.locator("#description").fill(DESCRIPTION);
    await page.getByRole("button", { name: /submit ticket/i }).click();

    await expect(page.getByText(/TKT-\d{4}-\d{6}/)).toBeVisible({ timeout: 10000 });
    const ticketNumberText = (await page.getByText(/TKT-\d{4}-\d{6}/).textContent())!.match(/TKT-\d{4}-\d{6}/)![0];

    // My Tickets: the ticket number is unique and sufficient on its own.
    // (David may have other tickets from earlier runs sharing this same
    // summary text, so we don't also assert on SUMMARY here.)
    await page.getByRole("button", { name: /my tickets/i }).click();
    await expect(page.getByText(ticketNumberText)).toBeVisible();

    await page.getByText(ticketNumberText).click();

    // Ticket Detail: add a public comment.
    await expect(page.getByRole("heading", { name: `Ticket ${ticketNumberText}` })).toBeVisible();
    await expect(page.getByText("No public comments yet.")).toBeVisible();

    const commentText = "Following up, this is still happening as of this morning.";
    await page.getByPlaceholder("Add a public update for the support team").fill(commentText);
    await page.getByRole("button", { name: /post comment/i }).click();

    await expect(page.getByText(commentText)).toBeVisible();
    await expect(page.getByText("No public comments yet.")).not.toBeVisible();
  });
});