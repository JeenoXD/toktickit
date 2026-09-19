import { test, expect } from "@playwright/test";
import { loginAsUser } from "../support/auth.js";

const REQUESTER_EMAIL = "jennifer.anderson@example.com";
const SUMMARY = "Playwright test ticket summary";
const DESCRIPTION = "This description is long enough to pass validation rules.";

test.describe("Ticket creation flow", () => {
  test("completes ticket creation and finds it in My Tickets (E2E-01, E2E-02)", async ({ page }) => {
    await loginAsUser(page, REQUESTER_EMAIL);

    await page.getByRole("button", { name: "Create Ticket" }).click();
    await page.locator("#categoryId").selectOption({ index: 1 });
    await page.locator("#relatedSystemId").selectOption({ index: 1 });
    await page.locator("#summary").fill(SUMMARY);
    await page.locator("#description").fill(DESCRIPTION);
    await page.getByText("Submit Ticket").click();

    await expect(page.getByText(/TKT-\d{4}-\d{6}/)).toBeVisible({ timeout: 10000 });
    const ticketNumberText = (await page.getByText(/TKT-\d{4}-\d{6}/).textContent())!.match(/TKT-\d{4}-\d{6}/)![0];

    await page.getByRole("button", { name: "My Tickets" }).click();
    await expect(page.getByText(ticketNumberText)).toBeVisible();
  });

  test("Create Ticket screenshot for responsive check (RESP-01)", async ({ page }, testInfo) => {
    await loginAsUser(page, REQUESTER_EMAIL);
    await page.getByRole("button", { name: "Create Ticket" }).click();

    await page.screenshot({
      path: `../artifacts/lab-02/screenshots/create-ticket/${testInfo.project.name}.png`,
      fullPage: true,
    });
  });
});