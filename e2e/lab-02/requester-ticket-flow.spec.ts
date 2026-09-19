import { test, expect } from "@playwright/test";
import { loginAsUser } from "../support/auth.js";

const REQUESTER_A_EMAIL = "jennifer.anderson@example.com";
const REQUESTER_B_EMAIL = "michael.brown@example.com";
const PRIVATE_SUMMARY = "Requester A Private Ticket";
const ATTACHMENT_TICKET_SUMMARY = "Ticket for attachment E2E test";

test.describe("Cross-requester access and attachment lifecycle", () => {
  test("Requester B cannot view Requester A's ticket (E2E-03)", async ({ page }) => {
    await loginAsUser(page, REQUESTER_A_EMAIL);
    await page.getByRole("button", { name: "Create Ticket" }).click();
    await page.locator("#categoryId").selectOption({ index: 1 });
    await page.locator("#relatedSystemId").selectOption({ index: 1 });
    await page.locator("#summary").fill(PRIVATE_SUMMARY);
    await page.locator("#description").fill("This ticket should not be visible to Requester B at all.");
    await page.getByText("Submit Ticket").click();
    await expect(page.getByText(/TKT-\d{4}-\d{6}/)).toBeVisible({ timeout: 10000 });

    await page.getByRole("button", { name: /logout/i }).click();
    await expect(page.locator("#email")).toBeVisible({ timeout: 15000 });

    await loginAsUser(page, REQUESTER_B_EMAIL);
    await page.getByRole("button", { name: "My Tickets" }).click();
    await expect(page.getByRole("heading", { name: /my tickets/i })).toBeVisible();
    await expect(page.getByText(PRIVATE_SUMMARY)).not.toBeVisible();
  });

  test("My Tickets and Ticket Detail responsive screenshots (RESP-02, RESP-03)", async ({ page }, testInfo) => {
    // Requester A already has at least one ticket from the previous test in
    // this file (the shared database isn't reset between tests within a
    // single project run), so a real ticket exists here for the screenshot.
    await loginAsUser(page, REQUESTER_A_EMAIL);

    await page.getByRole("button", { name: "My Tickets" }).click();
    await expect(page.getByRole("heading", { name: /my tickets/i })).toBeVisible();
    await page.screenshot({
      path: `../artifacts/lab-02/screenshots/my-tickets/${testInfo.project.name}.png`,
      fullPage: true,
    });

    const firstRow = page.locator("tbody tr").first();
    if ((await firstRow.count()) > 0) {
      await firstRow.click();
      await page.waitForSelector("text=/Ticket TKT-/", { timeout: 10000 });
      await page.screenshot({
        path: `../artifacts/lab-02/screenshots/ticket-detail/${testInfo.project.name}.png`,
        fullPage: true,
      });
    }
  });
});

test("adds and soft-removes an attachment end-to-end (E2E-04)", async ({ page }) => {
  await loginAsUser(page, REQUESTER_A_EMAIL);
  await page.getByRole("button", { name: "Create Ticket" }).click();
  await page.locator("#categoryId").selectOption({ index: 1 });
  await page.locator("#relatedSystemId").selectOption({ index: 1 });
  await page.locator("#summary").fill(ATTACHMENT_TICKET_SUMMARY);
  await page.locator("#description").fill("This ticket exists to test the attachment lifecycle end to end.");
  await page.getByText("Submit Ticket").click();
  await expect(page.getByText(/TKT-\d{4}-\d{6}/)).toBeVisible({ timeout: 10000 });

  await page.getByRole("button", { name: "My Tickets" }).click();
  // Click by this test's own known summary rather than "first row", since
  // Requester A may already have other tickets from earlier tests in this file.
  await page.getByText(ATTACHMENT_TICKET_SUMMARY).click();
  await page.waitForSelector("text=/Ticket TKT-/", { timeout: 10000 });

  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles("fixtures/test-attachment.png");
  await expect(page.getByText("test-attachment.png", { exact: false })).toBeVisible({ timeout: 10000 });

  await page.getByText("Remove").click();
  await page.getByPlaceholder("Reason for removal").fill("Testing soft removal end to end");
  await page.getByText("Confirm").click();

  await expect(page.getByText("Removed")).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(/Testing soft removal end to end/)).toBeVisible();
});