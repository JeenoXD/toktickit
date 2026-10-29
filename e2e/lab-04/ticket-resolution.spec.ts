// E2E-02, E2E-03 (AC-08, AC-09, AC-10, AC-12): resolution gate, advisory
// "appears resolved", append-only history, and stale-update protection.
import { test, expect, request as playwrightRequest, APIRequestContext } from "@playwright/test";
import { loginAsUser, apiLoginWithStandardPassword } from "../support/auth.js";
import { openOwnTicket, openTicketFromQueue } from "../support/workflow.js";

const API_URL = "http://localhost:3000";
const REQUESTER_EMAIL = "sarah.johnson@example.com";
const IT_EMAIL = "it.staff@example.com";
const ADMIN_EMAIL = "admin@example.com";

let summary: string;

test.describe("Lab 4 ticket resolution", () => {
  test.beforeAll(async ({}, testInfo) => {
    summary = `Resolution flow ${testInfo.project.name} ${Date.now()}`;
    const api: APIRequestContext = await playwrightRequest.newContext({ baseURL: API_URL });
    await apiLoginWithStandardPassword(api, API_URL, REQUESTER_EMAIL);
    const categories = await (await api.get("/api/categories")).json();
    const systems = await (await api.get("/api/related-systems")).json();
    const res = await api.post("/api/tickets", {
      data: {
        categoryId: categories[0].id,
        relatedSystemId: systems[0].id,
        summary,
        description: "Ticket created for the Lab 4 resolution end-to-end flow.",
        requestedPriority: "HIGH",
      },
    });
    expect(res.status()).toBe(201);
    await api.dispose();
  });

  test("requester flag is advisory; staff must meet the gate before resolving", async ({ page }) => {
    // Requester says it looks fixed: status does not change.
    await loginAsUser(page, REQUESTER_EMAIL);
    await openOwnTicket(page, summary);
    await page.getByRole("button", { name: "Problem Appears Resolved" }).click();
    await expect(page.getByText(/You marked this as appearing resolved/)).toBeVisible();
    await expect(page.getByText("New", { exact: true }).first()).toBeVisible();
    await page.getByRole("button", { name: /logout/i }).click();

    // Staff see the flag, but cannot resolve until the gate is met.
    await loginAsUser(page, IT_EMAIL);
    await openTicketFromQueue(page, summary);
    await expect(page.getByText(/requester says this problem appears resolved/i)).toBeVisible();

    const status = page.getByLabel("Status", { exact: true });
    const save = page.getByRole("button", { name: "Save Status" });
    await status.selectOption("OPEN");
    await save.click();
    await expect(page.getByText("Status changed to Open.")).toBeVisible();
    // Moving back to Open clears the advisory flag (BR-19).
    await expect(page.getByText(/requester says this problem appears resolved/i)).not.toBeVisible();

    await page.getByRole("button", { name: /^claim$/i }).click();
    await expect(page.getByText("Ticket claimed.")).toBeVisible();
    await status.selectOption("IN_PROGRESS");
    await save.click();
    await expect(page.getByText("Status changed to In Progress.")).toBeVisible();

    // Resolved is listed but blocked, with the reason shown.
    await expect(status.locator("option", { hasText: "Resolved (blocked)" })).toBeDisabled();
    await expect(page.getByText("Resolved: needs at least one completed action.")).toBeVisible();

    const actions = page.locator("section", { has: page.getByRole("heading", { name: /Actions Taken/ }) });
    await actions.getByRole("button", { name: "+ Add Action" }).click();
    await actions.getByLabel(/Action Description/).fill("Reinstalled the VPN client");
    await actions.getByLabel("Result").fill("Connection stable for 30 minutes");
    await actions.getByRole("button", { name: "Save and Complete" }).click();
    await expect(actions.getByText("Action saved and completed.")).toBeVisible();

    await expect(page.getByText("Resolved: needs at least one completed action.")).not.toBeVisible();
    await status.selectOption("RESOLVED");
    await save.click();
    await expect(page.getByText("Status changed to Resolved.")).toBeVisible();
    await status.selectOption("CLOSED");
    await save.click();
    await expect(page.getByText("Status changed to Closed.")).toBeVisible();

    // History is append-only and in order.
    const history = page.locator("section", { has: page.getByRole("heading", { name: "Status History" }) });
    await expect(history.locator("li")).toHaveCount(5);
    await expect(history.locator("li").first()).toContainText("Created as New");
    await expect(history.locator("li").last()).toContainText("Resolved");
    await expect(history.locator("li").last()).toContainText("Closed");

    // Closed tickets lock their actions.
    await expect(actions.getByText(/closed or cancelled, so its actions are read only/)).toBeVisible();
    await expect(actions.getByRole("button", { name: "+ Add Action" })).toHaveCount(0);
  });

  test("a stale status change is rejected and can be reloaded", async ({ browser }) => {
    const staffContext = await browser.newContext();
    const adminContext = await browser.newContext();
    const staffPage = await staffContext.newPage();
    const adminPage = await adminContext.newPage();

    // Create a fresh ticket for this race.
    const api = await playwrightRequest.newContext({ baseURL: API_URL });
    await apiLoginWithStandardPassword(api, API_URL, REQUESTER_EMAIL);
    const categories = await (await api.get("/api/categories")).json();
    const systems = await (await api.get("/api/related-systems")).json();
    const raceSummary = `${summary} race`;
    await api.post("/api/tickets", {
      data: {
        categoryId: categories[0].id,
        relatedSystemId: systems[0].id,
        summary: raceSummary,
        description: "Ticket used to show stale-update protection.",
        requestedPriority: "LOW",
      },
    });
    await api.dispose();

    await loginAsUser(staffPage, IT_EMAIL);
    await openTicketFromQueue(staffPage, raceSummary);
    await loginAsUser(adminPage, ADMIN_EMAIL);
    await openTicketFromQueue(adminPage, raceSummary);

    // Admin changes the status first.
    await adminPage.getByLabel("Status", { exact: true }).selectOption("OPEN");
    await adminPage.getByRole("button", { name: "Save Status" }).click();
    await expect(adminPage.getByText("Status changed to Open.")).toBeVisible();

    // Staff still has the old version open.
    await staffPage.getByLabel("Status", { exact: true }).selectOption("CANCELLED");
    await staffPage.getByRole("button", { name: "Save Status" }).click();
    await expect(staffPage.getByText(/changed by someone else/)).toBeVisible();
    await staffPage.getByRole("button", { name: "Reload" }).click();
    await expect(staffPage.getByText("Open", { exact: true }).first()).toBeVisible();
    await expect(staffPage.getByText(/^Allowed: In Progress, Waiting for Requester, Cancelled$/)).toBeVisible();

    await staffContext.close();
    await adminContext.close();
  });
});
