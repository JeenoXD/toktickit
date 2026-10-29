import { APIRequestContext, Locator, Page, expect } from "@playwright/test";

/**
 * Lab 4 workflow changes must send the ticket's current version (BR-20).
 * Reads the latest version, then sends the PATCH with it.
 */
export async function patchTicket(
  api: APIRequestContext,
  ticketId: number,
  path: "status" | "claim" | "reassign" | "priority",
  data: Record<string, unknown> = {}
) {
  const current = await (await api.get(`/api/tickets/${ticketId}`)).json();
  return api.patch(`/api/tickets/${ticketId}/${path}`, { data: { ...data, version: current.version } });
}

/** Records one completed Action Taken so the resolution gate (BR-15) can pass. */
export async function addCompletedAction(api: APIRequestContext, ticketId: number, description = "Fixed the problem") {
  const created = await api.post(`/api/tickets/${ticketId}/actions`, { data: { description } });
  expect(created.status()).toBe(201);
  const action = await created.json();
  const done = await api.patch(`/api/tickets/${ticketId}/actions/${action.id}/status`, {
    data: { status: "COMPLETED", version: action.version, result: "Confirmed working" },
  });
  expect(done.ok()).toBeTruthy();
}

/** New -> Open -> (claim) -> In Progress -> (completed action) -> Resolved, as IT Staff. */
export async function resolveTicket(api: APIRequestContext, ticketId: number) {
  expect((await patchTicket(api, ticketId, "status", { status: "OPEN" })).ok()).toBeTruthy();
  expect((await patchTicket(api, ticketId, "claim")).ok()).toBeTruthy();
  expect((await patchTicket(api, ticketId, "status", { status: "IN_PROGRESS" })).ok()).toBeTruthy();
  await addCompletedAction(api, ticketId);
  expect((await patchTicket(api, ticketId, "status", { status: "RESOLVED" })).ok()).toBeTruthy();
}

/** Opens a ticket from the IT Staff queue by searching its summary (works for table and card layouts). */
export async function openTicketFromQueue(page: Page, summary: string) {
  await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: /ticket queue/i }).click();
  await page.getByLabel("Search").fill(summary);
  await expect(page.getByText(summary, { exact: true }).and(page.locator(":visible"))).toBeVisible({ timeout: 10000 });
  await page.getByRole("button", { name: /open ticket/i }).and(page.locator(":visible")).first().click();
  await expect(page.getByRole("heading", { level: 2, name: /^Ticket TKT-/ })).toBeVisible();
}

/** Opens one of the requester's own tickets from My Tickets by searching its summary. */
export async function openOwnTicket(page: Page, summary: string) {
  await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: /my tickets/i }).click();
  await page.getByPlaceholder("Search by ticket number or summary").fill(summary);
  await page.getByText(summary, { exact: true }).and(page.locator(":visible")).first().click();
  await expect(page.getByRole("heading", { level: 2, name: /^Ticket TKT-/ })).toBeVisible();
}

/** Only the copy that is actually visible at this viewport (tables and cards both stay in the DOM). */
export function visible(page: Page, locator: Locator) {
  return locator.and(page.locator(":visible"));
}
