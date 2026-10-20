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
    await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: /ticket queue/i }).click();
    await page.getByLabel("Search").fill(TICKET_SUMMARY);
    await expect(page.getByText(TICKET_SUMMARY, { exact: true }).and(page.locator(":visible"))).toBeVisible({ timeout: 10000 });
    await page.getByRole("button", { name: /open ticket/i }).click();

    // Lab 4: the select only lists permitted next statuses (BR-14), In Progress needs
    // an owner (BR-17), and Resolved needs a completed Action Taken (BR-15).
    const statusSelect = page.getByLabel("Status", { exact: true });
    const saveStatusButton = page.getByRole("button", { name: /save status/i });
    const allowedHint = page.getByText(/^Allowed:/);

    await expect(allowedHint).toHaveText("Allowed: Open, Cancelled");
    await expect(statusSelect.locator("option", { hasText: "Resolved" })).toHaveCount(0);

    await statusSelect.selectOption("OPEN");
    await saveStatusButton.click();
    await expect(allowedHint).toHaveText("Allowed: In Progress, Waiting for Requester, Cancelled");
    await expect(page.getByText("In Progress: needs an owner.")).toBeVisible();

    await page.getByRole("button", { name: /^claim$/i }).click();
    await expect(page.getByText("In Progress: needs an owner.")).not.toBeVisible();
    await statusSelect.selectOption("IN_PROGRESS");
    await saveStatusButton.click();
    await expect(allowedHint).toHaveText("Allowed: Open, Waiting for Requester, Resolved");
    await expect(page.getByText("Resolved: needs at least one completed action.")).toBeVisible();

    const actions = page.locator("section", { has: page.getByRole("heading", { name: /Actions Taken/ }) });
    await actions.getByRole("button", { name: "+ Add Action" }).click();
    await actions.getByLabel(/Action Description/).fill("Restarted the affected service");
    await actions.getByLabel("Result").fill("Service is responding again");
    await actions.getByRole("button", { name: "Save and Complete" }).click();
    await expect(actions.getByText("Action saved and completed.")).toBeVisible();
    await expect(page.getByText("Resolved: needs at least one completed action.")).not.toBeVisible();

    await statusSelect.selectOption("RESOLVED");
    await saveStatusButton.click();
    await expect(allowedHint).toHaveText("Allowed: Closed, Reopened");

    await statusSelect.selectOption("CLOSED");
    await saveStatusButton.click();
    await expect(allowedHint).toHaveText("Allowed: Reopened");
  });
});