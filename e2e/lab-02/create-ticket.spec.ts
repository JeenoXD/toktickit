import { test, expect } from "@playwright/test";

test.describe("Ticket creation flow", () => {
  test("completes ticket creation and finds it in My Tickets (E2E-01, E2E-02)", async ({ page }) => {
    await page.goto("/");
    
    await page.getByText("Select Development Requester").click();
    await page.waitForSelector("text=Select Development Requester");
    await page.getByText("Continue").click();

    
    await page.getByRole("button", { name: "Create Ticket" }).click();
    await page.locator("#categoryId").selectOption({ index: 1 });
    await page.locator("#relatedSystemId").selectOption({ index: 1 });
    await page.locator("#summary").fill("Playwright test ticket summary");
    await page.locator("#description").fill("This description is long enough to pass validation rules.");
    await page.getByText("Submit Ticket").click();

    await expect(page.getByText(/TKT-\d{4}-\d{6}/)).toBeVisible({ timeout: 10000 });
    const ticketNumberText = await page.getByText(/TKT-\d{4}-\d{6}/).textContent();

    await page.getByRole("button", { name: "My Tickets" }).click();
    await expect(page.getByText(ticketNumberText!.match(/TKT-\d{4}-\d{6}/)![0])).toBeVisible();
  });

  test("Create Ticket screenshot for responsive check (RESP-01)", async ({ page }, testInfo) => {
    await page.goto("/");
    await page.getByText("Select Development Requester").click();
    await page.getByText("Continue").click();
    await page.getByRole("button", { name: "Create Ticket" }).click();

    await page.screenshot({
      path: `../artifacts/lab-02/screenshots/create-ticket/${testInfo.project.name}.png`,
      fullPage: true,
    });
  });
});