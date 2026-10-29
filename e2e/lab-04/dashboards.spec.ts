// E2E-04, A11Y-01 (AC-02, AC-13, AC-15, AC-19): dashboards land first, counts
// match the backend, cards drill down, keyboard works, and nothing overflows.
import { test, expect, request as playwrightRequest, Page } from "@playwright/test";
import { loginAsUser, apiLoginWithStandardPassword } from "../support/auth.js";

const API_URL = "http://localhost:3000";
const IT_EMAIL = "it.staff@example.com";
const REQUESTER_EMAIL = "jennifer.anderson@example.com";
const EMPTY_REQUESTER_EMAIL = "emily.carter@example.com";
const ADMIN_EMAIL = "admin@example.com";

async function cardCount(page: Page, label: string): Promise<number> {
  const card = page.getByRole("button", { name: new RegExp(`^${label}: \\d+, view list$`) });
  const name = (await card.getAttribute("aria-label")) ?? "";
  return Number(/: (\d+),/.exec(name)?.[1]);
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

test.describe("Lab 4 dashboards", () => {
  test("IT Staff land on the dashboard; counts match the API and drill down to the queue", async ({ page }) => {
    await loginAsUser(page, IT_EMAIL);
    await expect(page.getByRole("heading", { name: /Welcome back/ })).toBeVisible();
    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(nav.getByRole("button", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
    await expectNoHorizontalOverflow(page);

    // Compare a card with the same queue query run through the API.
    const unassigned = await cardCount(page, "Unassigned");
    const api = await playwrightRequest.newContext({ baseURL: API_URL });
    await apiLoginWithStandardPassword(api, API_URL, IT_EMAIL);
    const queue = await (await api.get("/api/tickets/queue?statusGroup=active&owner=unassigned")).json();
    expect(queue.pagination.totalItems).toBe(unassigned);
    const dashboard = await (await api.get("/api/dashboard/staff")).json();
    expect(dashboard.users).toBeUndefined();
    await api.dispose();

    await page.getByRole("button", { name: /^Unassigned: \d+, view list$/ }).click();
    await expect(page.getByRole("heading", { name: "Ticket Queue" })).toBeVisible();
    await expect(nav.getByRole("button", { name: "Ticket Queue" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("button", { name: "Remove filter: Unassigned" })).toBeVisible();
    await expect(page.getByLabel("Status")).toHaveValue("active");
    // The list shows exactly the tickets the card counted (first page of 10), in either layout.
    const openButtons = page.getByRole("button", { name: /open ticket/i }).and(page.locator(":visible"));
    await expect(openButtons).toHaveCount(Math.min(unassigned, 10));
    await expectNoHorizontalOverflow(page);
  });

  test("Requesters see only their own data and drill down to My Tickets", async ({ page }) => {
    await loginAsUser(page, REQUESTER_EMAIL);
    await expect(page.getByRole("heading", { name: /Welcome, Jennifer/ })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const open = await cardCount(page, "My Open Tickets");
    const api = await playwrightRequest.newContext({ baseURL: API_URL });
    await apiLoginWithStandardPassword(api, API_URL, REQUESTER_EMAIL);
    const mine = await (await api.get("/api/tickets?statusGroup=active")).json();
    expect(mine.pagination.totalItems).toBe(open);
    expect((await api.get("/api/dashboard/staff")).status()).toBe(403);
    await api.dispose();

    await page.getByRole("button", { name: /^My Open Tickets: \d+, view list$/ }).click();
    await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();
    await expect(page.getByLabel("Status")).toHaveValue("active");
  });

  test("a requester with no tickets sees zeros and a getting-started panel", async ({ page }) => {
    await loginAsUser(page, EMPTY_REQUESTER_EMAIL);
    await expect(page.getByText("You haven't submitted any tickets yet.")).toBeVisible();
    for (const label of ["My Open Tickets", "Waiting for Me", "Resolved", "Closed"]) {
      expect(await cardCount(page, label)).toBe(0);
    }
  });

  test("Administrators also see user accounts and the system check", async ({ page }) => {
    await loginAsUser(page, ADMIN_EMAIL);
    await expect(page.getByRole("heading", { name: "User Accounts" })).toBeVisible();
    await page.getByRole("button", { name: "Check System" }).click();
    await expect(page.getByText("Online")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("A11Y-01: dashboard cards work with the keyboard and show a visible focus ring", async ({ page }) => {
    await loginAsUser(page, IT_EMAIL);
    await expect(page.getByRole("heading", { name: /Welcome back/ })).toBeVisible();

    const card = page.getByRole("button", { name: /^My Assigned: \d+, view list$/ });
    // Tab until the card has focus (proves it is reachable in reading order).
    for (let i = 0; i < 30; i++) {
      if (await card.evaluate((el) => el === document.activeElement)) break;
      await page.keyboard.press("Tab");
    }
    await expect(card).toBeFocused();
    const outline = await card.evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline).not.toBe("none");

    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Ticket Queue" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Remove filter: Assigned to me" })).toBeVisible();
  });
});
