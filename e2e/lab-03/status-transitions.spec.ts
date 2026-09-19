import { test, expect, request as playwrightRequest, APIRequestContext } from "@playwright/test";
import { loginAsUser, apiLoginWithStandardPassword } from "../support/auth.js";

const API_URL = "http://localhost:3000";
const REQUESTER_EMAIL = "sarah.johnson@example.com";
const IT_EMAIL = "it.staff@example.com";

let api: APIRequestContext;
const TICKET_SUMMARY = "Status Transition Test Ticket";

test.describe("Lab 3 IT Staff status transition workflow", () => {
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
        description: "Ticket created for the status-transition E2E coverage, long enough to pass validation.",
        requestedPriority: "MEDIUM",
      },
    });
    expect(ticketRes.status()).toBe(201);

    await apiLoginWithStandardPassword(api, API_URL, IT_EMAIL);
  });

  test("rejects an invalid transition and walks a ticket through the valid chain", async ({ page }) => {
    await loginAsUser(page, IT_EMAIL);
    await page.getByRole("button", { name: /ticket queue/i }).click();
    await page.getByLabel("Search").fill(TICKET_SUMMARY);
    await expect(page.getByText(TICKET_SUMMARY, { exact: true }).and(page.locator(":visible"))).toBeVisible({ timeout: 10000 });
    await page.getByRole("button", { name: /open ticket/i }).click();

    const statusSelect = page.getByLabel("Status");
    const saveStatusButton = page.getByRole("button", { name: /save status/i });
    const allowedHint = page.getByText(/^Allowed:/);

    await expect(allowedHint).toHaveText("Allowed: OPEN, CANCELLED");

    await statusSelect.selectOption("RESOLVED");
    await saveStatusButton.click();
    await expect(page.getByText(/cannot change/i)).toBeVisible();

    await statusSelect.selectOption("OPEN");
    await saveStatusButton.click();
    await expect(page.getByText(/cannot change/i)).not.toBeVisible();
    await expect(allowedHint).toHaveText("Allowed: IN_PROGRESS, CANCELLED");

    await statusSelect.selectOption("IN_PROGRESS");
    await saveStatusButton.click();
    await expect(allowedHint).toHaveText("Allowed: WAITING_FOR_REQUESTER, RESOLVED, OPEN");

    await statusSelect.selectOption("RESOLVED");
    await saveStatusButton.click();
    await expect(allowedHint).toHaveText("Allowed: CLOSED, REOPENED");

    await statusSelect.selectOption("CLOSED");
    await saveStatusButton.click();
    await expect(allowedHint).toHaveText("Allowed: REOPENED");
  });
});