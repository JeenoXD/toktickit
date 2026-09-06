import { test, expect } from "@playwright/test";

test.describe("Cross-requester access and attachment lifecycle", () => {
  test("Requester B cannot view Requester A's ticket (E2E-03)", async ({ page }) => {
    await page.goto("/");
    await page.getByText("Select Development Requester").click();
    await page.locator("select").selectOption({ index: 0 });
    await page.getByText("Continue").click();
    await page.getByRole("button", { name: "Create Ticket" }).click();
    await page.locator("#categoryId").selectOption({ index: 1 });
    await page.locator("#relatedSystemId").selectOption({ index: 1 });
    await page.locator("#summary").fill("Requester A private ticket");
    await page.locator("#description").fill("This ticket should not be visible to Requester B at all.");
    await page.getByText("Submit Ticket").click();
    await expect(page.getByText(/TKT-\d{4}-\d{6}/)).toBeVisible({ timeout: 10000 });

    await page.getByText("Change Requester").click();
    await page.locator("select").selectOption({ index: 1 });
    await page.getByText("Continue").click();

    await page.getByRole("button", { name: "My Tickets" }).click();
    await expect(page.getByText("Requester A private ticket")).not.toBeVisible();
  });

  test("My Tickets and Ticket Detail responsive screenshots (RESP-02, RESP-03)", async ({ page }, testInfo) => {
    await page.goto("/");
    await page.getByText("Select Development Requester").click();
    await page.getByText("Continue").click();

    await page.getByRole("button", { name: "My Tickets" }).click();
    await page.screenshot({
      path: `../artifacts/lab-02/screenshots/my-tickets/${testInfo.project.name}.png`,
      fullPage: true,
    });

    const firstRow = page.locator("tbody tr").first();
        if (await firstRow.count() > 0) {
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
  await page.goto("/");
  await page.getByText("Select Development Requester").click();
  await page.getByText("Continue").click();
  await page.getByRole("button", { name: "Create Ticket" }).click();
  await page.locator("#categoryId").selectOption({ index: 1 });
  await page.locator("#relatedSystemId").selectOption({ index: 1 });
  await page.locator("#summary").fill("Ticket for attachment E2E test");
  await page.locator("#description").fill("This ticket exists to test the attachment lifecycle end to end.");
  await page.getByText("Submit Ticket").click();
  await expect(page.getByText(/TKT-\d{4}-\d{6}/)).toBeVisible({ timeout: 10000 });

  await page.getByRole("button", { name: "My Tickets" }).click();
  await page.locator("tbody tr").first().click();
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