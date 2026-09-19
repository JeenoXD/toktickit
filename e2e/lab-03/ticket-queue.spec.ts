import { test, expect, request as playwrightRequest, APIRequestContext } from "@playwright/test";
import { loginAsUser, apiLoginWithStandardPassword } from "../support/auth.js";

const API_URL = "http://localhost:3000";
const REQUESTER_EMAIL = "jennifer.anderson@example.com";
const IT_EMAIL = "it.staff@example.com";

let api: APIRequestContext;
const HIGH_PRIORITY_SUMMARY = "Queue Test Ticket 3";
const RESOLVED_SUMMARY = "Queue Test Ticket 5";

// The queue renders two parallel layouts (a desktop <table> and a mobile
// card list) and hides one via CSS depending on viewport width; both stay
// in the DOM. This finds whichever copy of the given text is actually
// visible at the current viewport, rather than assuming the table exists.
function visibleSummary(page: import("@playwright/test").Page, text: string | RegExp) {
  return page.getByText(text, { exact: typeof text === "string" }).and(page.locator(":visible"));
}

test.describe("Lab 3 IT Staff ticket queue", () => {
  test.beforeAll(async () => {
    api = await playwrightRequest.newContext({ baseURL: API_URL });

    await apiLoginWithStandardPassword(api, API_URL, REQUESTER_EMAIL);

    const categories = await (await api.get("/api/categories")).json();
    const systems = await (await api.get("/api/related-systems")).json();

    const ticketIds: number[] = [];
    for (let i = 1; i <= 12; i++) {
      const res = await api.post("/api/tickets", {
        data: {
          categoryId: categories[0].id,
          relatedSystemId: systems[0].id,
          summary: `Queue Test Ticket ${i}`,
          description: `Seeded ticket ${i} for queue E2E coverage, long enough to pass validation.`,
          requestedPriority: "MEDIUM",
        },
      });
      expect(res.status()).toBe(201);
      ticketIds.push((await res.json()).id);
    }

    await apiLoginWithStandardPassword(api, API_URL, IT_EMAIL);

    const priorityRes = await api.patch(`/api/tickets/${ticketIds[2]}/priority`, {
      data: { itPriority: "HIGH" },
    });
    expect(priorityRes.ok()).toBeTruthy();

    for (const status of ["OPEN", "IN_PROGRESS", "RESOLVED"]) {
      const statusRes = await api.patch(`/api/tickets/${ticketIds[4]}/status`, { data: { status } });
      expect(statusRes.ok()).toBeTruthy();
    }
  });

  test.beforeEach(async ({ page }) => {
    await loginAsUser(page, IT_EMAIL);
    await page.getByRole("button", { name: /ticket queue/i }).click();
    await expect(page.getByRole("heading", { name: /ticket queue/i })).toBeVisible();
  });

  test("searches by summary text", async ({ page }) => {
    await page.getByLabel("Search").fill("Queue Test Ticket 7");
    await expect(visibleSummary(page, "Queue Test Ticket 7")).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("button", { name: /^open ticket$/i })).toHaveCount(1);
  });

    test("filters by IT priority", async ({ page }) => {
    await page.getByLabel("Search").fill("Queue Test Ticket");
    await page.getByLabel("IT Priority").selectOption("HIGH");
    await expect(visibleSummary(page, HIGH_PRIORITY_SUMMARY)).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("button", { name: /^open ticket$/i })).toHaveCount(1);
  });

  test("filters by status", async ({ page }) => {
    await page.getByLabel("Search").fill("Queue Test Ticket");
    await page.getByLabel("Status").selectOption("RESOLVED");
    await expect(visibleSummary(page, RESOLVED_SUMMARY)).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("button", { name: /^open ticket$/i })).toHaveCount(1);
  });

  test("sorts by updated date in both directions", async ({ page }, testInfo) => {
    // Sorting is only reachable by clicking a table column header, and that
    // header only exists in the desktop <table> layout (d-none below the lg
    // breakpoint). The mobile/tablet card layout has no sort control at all,
    // this isn't a test gap, the app genuinely doesn't offer sorting there.
    test.skip(testInfo.project.name !== "desktop", "No sort control exists outside the desktop table layout.");

    await page.getByLabel("Search").fill("Queue Test Ticket");
    const firstVisible = visibleSummary(page, /^Queue Test Ticket \d+$/).first();
    await expect(firstVisible).toHaveText("Queue Test Ticket 5", { timeout: 10000 });

    await page.getByRole("columnheader", { name: /updated/i }).click();
    await expect(firstVisible).toHaveText("Queue Test Ticket 1");
  });

  test("paginates through more than one page of results", async ({ page }) => {
    await page.getByLabel("Search").fill("Queue Test Ticket");
    await expect(page.getByText(/page 1 of 2/i)).toBeVisible({ timeout: 20000 });
    // Counting the (role-based, so layout-safe) "Open Ticket" buttons instead
    // of table rows, since only the desktop layout has an actual <table>.
    await expect(page.getByRole("button", { name: /^open ticket$/i })).toHaveCount(10, { timeout: 20000 });

    await page.getByRole("button", { name: /^next$/i }).click();
    await expect(page.getByText(/page 2 of 2/i)).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole("button", { name: /^open ticket$/i })).toHaveCount(2, { timeout: 20000 });

    await page.getByRole("button", { name: /^previous$/i }).click();
    await expect(page.getByText(/page 1 of 2/i)).toBeVisible({ timeout: 20000 });
  });
});