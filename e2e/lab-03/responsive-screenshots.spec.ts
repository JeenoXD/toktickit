import { test, expect, request as playwrightRequest, APIRequestContext } from "@playwright/test";
import { loginAsUser, apiLoginWithStandardPassword } from "../support/auth.js";

const API_URL = "http://localhost:3000";
const IT_EMAIL = "it.staff@example.com";
const ADMIN_EMAIL = "admin@example.com";
const REQUESTER_EMAIL = "michael.brown@example.com";
const CHANGE_PASSWORD_SCREEN_TEMP_PASSWORD = "FreshChangePw1!";

let api: APIRequestContext;
let requesterTicketNumber: string;
let changePasswordScreenEmail: string;
const REQUESTER_TICKET_SUMMARY = "Responsive Screenshot Coverage Ticket";

test.describe("Lab 3 responsive screenshots", () => {
  test.beforeAll(async () => {
    api = await playwrightRequest.newContext({ baseURL: API_URL });

    await apiLoginWithStandardPassword(api, API_URL, IT_EMAIL);
    await apiLoginWithStandardPassword(api, API_URL, ADMIN_EMAIL);

    changePasswordScreenEmail = `change-password-screenshot-${Date.now()}@example.com`;
    const createUserRes = await api.post("/api/users", {
      data: {
        name: "Change Password Screenshot User",
        email: changePasswordScreenEmail,
        role: "REQUESTER",
        isActive: true,
        initialPassword: CHANGE_PASSWORD_SCREEN_TEMP_PASSWORD,
      },
    });
    expect(createUserRes.status()).toBe(201);

    await apiLoginWithStandardPassword(api, API_URL, REQUESTER_EMAIL);

    const categories = await (await api.get("/api/categories")).json();
    const systems = await (await api.get("/api/related-systems")).json();

    const ticketRes = await api.post("/api/tickets", {
      data: {
        categoryId: categories[0].id,
        relatedSystemId: systems[0].id,
        summary: REQUESTER_TICKET_SUMMARY,
        description: "Ticket created purely so the queue, my tickets, and ticket detail screens have real content to capture.",
        requestedPriority: "HIGH",
      },
    });
    expect(ticketRes.status()).toBe(201);
    requesterTicketNumber = (await ticketRes.json()).ticketNumber;
  });

  test("Login screen", async ({ page }, testInfo) => {
    await page.goto("/");
    await expect(page.locator("#email")).toBeVisible();
    await page.screenshot({
      path: `../artifacts/lab-03/screenshots/authentication/login/${testInfo.project.name}.png`,
      fullPage: true,
    });
  });

  test("Change Password screen", async ({ page }, testInfo) => {
    await page.goto("/");
    await page.locator("#email").fill(changePasswordScreenEmail);
    await page.locator("#password").fill(CHANGE_PASSWORD_SCREEN_TEMP_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.getByRole("heading", { name: /update password/i })).toBeVisible({ timeout: 15000 });
    await page.screenshot({
      path: `../artifacts/lab-03/screenshots/authentication/change-password/${testInfo.project.name}.png`,
      fullPage: true,
    });
  });

  test("IT Staff Ticket Queue screen", async ({ page }, testInfo) => {
    await loginAsUser(page, IT_EMAIL);
    await page.getByRole("button", { name: /ticket queue/i }).click();
    await expect(page.getByRole("heading", { name: /ticket queue/i })).toBeVisible();
    await page.getByLabel("Search").fill(requesterTicketNumber);
    // Both the desktop table and mobile card layout render this text; only
    // one is visible at a time (the other stays in the DOM, CSS-hidden).
    await expect(page.getByText(REQUESTER_TICKET_SUMMARY, { exact: true }).and(page.locator(":visible"))).toBeVisible({ timeout: 10000 });
    await page.screenshot({
      path: `../artifacts/lab-03/screenshots/it-staff/ticket-queue/${testInfo.project.name}.png`,
      fullPage: true,
    });
  });

  test("IT Staff Ticket Detail screen", async ({ page }, testInfo) => {
    await loginAsUser(page, IT_EMAIL);
    await page.getByRole("button", { name: /ticket queue/i }).click();
    await page.getByLabel("Search").fill(requesterTicketNumber);
    await page.getByRole("button", { name: /open ticket/i }).click();
    await expect(page.getByRole("heading", { name: new RegExp(requesterTicketNumber) })).toBeVisible({ timeout: 10000 });
    await page.screenshot({
      path: `../artifacts/lab-03/screenshots/it-staff/ticket-detail/${testInfo.project.name}.png`,
      fullPage: true,
    });
  });

  test("Administrator User Management screen", async ({ page }, testInfo) => {
    await loginAsUser(page, ADMIN_EMAIL);
    await page.getByRole("button", { name: /user management/i }).click();
    await expect(page.getByRole("heading", { name: /user management/i })).toBeVisible();
    await expect(page.getByText("admin@example.com", { exact: true })).toBeVisible({ timeout: 10000 });
    await page.screenshot({
      path: `../artifacts/lab-03/screenshots/admin/user-management/${testInfo.project.name}.png`,
      fullPage: true,
    });
  });

  test("Requester Create Ticket screen", async ({ page }, testInfo) => {
    await loginAsUser(page, REQUESTER_EMAIL);
    await page.getByRole("button", { name: /create ticket/i }).click();
    await expect(page.getByRole("heading", { name: /create ticket/i })).toBeVisible();
    await page.screenshot({
      path: `../artifacts/lab-03/screenshots/requester/create-ticket/${testInfo.project.name}.png`,
      fullPage: true,
    });
  });

  test("Requester My Tickets screen", async ({ page }, testInfo) => {
    await loginAsUser(page, REQUESTER_EMAIL);
    await page.getByRole("button", { name: /my tickets/i }).click();
    await expect(page.getByRole("heading", { name: /my tickets/i })).toBeVisible();
    await page.getByPlaceholder("Search by ticket number or summary").fill(requesterTicketNumber);
    await expect(page.getByText(requesterTicketNumber)).toBeVisible({ timeout: 10000 });
    await page.screenshot({
      path: `../artifacts/lab-03/screenshots/requester/my-tickets/${testInfo.project.name}.png`,
      fullPage: true,
    });
  });

  test("Requester Ticket Detail screen", async ({ page }, testInfo) => {
    await loginAsUser(page, REQUESTER_EMAIL);
    await page.getByRole("button", { name: /my tickets/i }).click();
    await page.getByPlaceholder("Search by ticket number or summary").fill(requesterTicketNumber);
    await page.getByText(requesterTicketNumber).click();
    await expect(page.getByRole("heading", { name: `Ticket ${requesterTicketNumber}` })).toBeVisible({ timeout: 10000 });
    await page.screenshot({
      path: `../artifacts/lab-03/screenshots/requester/ticket-detail/${testInfo.project.name}.png`,
      fullPage: true,
    });
  });
});