// E2E-01 (AC-01, AC-03, AC-05): IT Staff record several Actions Taken by different
// performers on one ticket; the Requester sees them read only.
import { test, expect, request as playwrightRequest, APIRequestContext } from "@playwright/test";
import { loginAsUser, apiLoginWithStandardPassword } from "../support/auth.js";
import { openOwnTicket, openTicketFromQueue, visible } from "../support/workflow.js";

const API_URL = "http://localhost:3000";
const REQUESTER_EMAIL = "michael.brown@example.com";
const IT_EMAIL = "it.staff@example.com";

let api: APIRequestContext;
let summary: string;

test.describe("Lab 4 Actions Taken flow", () => {
  test.beforeAll(async ({}, testInfo) => {
    summary = `Actions flow ${testInfo.project.name} ${Date.now()}`;
    api = await playwrightRequest.newContext({ baseURL: API_URL });
    await apiLoginWithStandardPassword(api, API_URL, REQUESTER_EMAIL);
    const categories = await (await api.get("/api/categories")).json();
    const systems = await (await api.get("/api/related-systems")).json();
    const res = await api.post("/api/tickets", {
      data: {
        categoryId: categories[0].id,
        relatedSystemId: systems[0].id,
        summary,
        description: "Ticket created for the Lab 4 Actions Taken end-to-end flow.",
        requestedPriority: "MEDIUM",
      },
    });
    expect(res.status()).toBe(201);
  });

  test.afterAll(async () => {
    await api.dispose();
  });

  test("staff plan, edit, complete, and cancel actions; requester sees them read only", async ({ page }) => {
    await loginAsUser(page, IT_EMAIL);
    await openTicketFromQueue(page, summary);

    const section = page.locator("section", { has: page.getByRole("heading", { name: /Actions Taken/ }) });
    await expect(section.getByText("No actions recorded yet.")).toBeVisible();

    // 1. A planned action performed by a different IT Staff member, with a follow-up note.
    await section.getByRole("button", { name: "+ Add Action" }).click();
    await section.getByLabel(/Action Description/).fill("Check VPN concentrator logs");
    await section.getByLabel("Performed by").selectOption({ label: "Carlos Mendez" });
    await section.getByLabel("Follow-up required").check();
    // Validation: follow-up note is required once follow-up is ticked; entered text is kept.
    await section.getByRole("button", { name: "Save as Planned" }).click();
    await expect(section.getByText("Follow-up note is required when follow-up is needed.")).toBeVisible();
    await expect(section.getByLabel(/Action Description/)).toHaveValue("Check VPN concentrator logs");
    await section.getByLabel(/Follow-up Note/).fill("Confirm with requester tomorrow");
    await section.getByLabel("Attachment Notes").fill("See vpn-error.png in Attachments");
    await section.getByRole("button", { name: "Save as Planned" }).click();
    await expect(section.getByText("Action saved.")).toBeVisible();

    // 2. A second action completed straight away by the current user.
    await section.getByRole("button", { name: "+ Add Action" }).click();
    await section.getByLabel(/Action Description/).fill("Reset VPN credentials");
    await section.getByLabel("Result").fill("Login reaches MFA step");
    await section.getByRole("button", { name: "Save and Complete" }).click();
    await expect(section.getByText("Action saved and completed.")).toBeVisible();
    await expect(section.getByRole("heading", { name: /Actions Taken \(2\)/ })).toBeVisible();

    // 3. Edit the planned action, then complete it with a result.
    await visible(page, section.getByRole("button", { name: "Edit action: Check VPN concentrator logs" })).click();
    await section.getByLabel(/Action Description/).fill("Checked VPN concentrator logs");
    await section.getByRole("button", { name: "Save Changes" }).click();
    await expect(section.getByText("Action updated.")).toBeVisible();

    await visible(page, section.getByRole("button", { name: "Complete action: Checked VPN concentrator logs" })).click();
    await section.getByRole("button", { name: "Confirm Complete" }).click();
    await expect(section.getByText("Result is required to complete an action.")).toBeVisible();
    await section.getByLabel("Result").fill("Account was locked; unlocked it");
    await section.getByRole("button", { name: "Confirm Complete" }).click();
    await expect(section.getByText("Action completed.")).toBeVisible();

    // 4. Plan one more and cancel it; it stays in the list as Cancelled.
    await section.getByRole("button", { name: "+ Add Action" }).click();
    await section.getByLabel(/Action Description/).fill("Replace the laptop");
    await section.getByRole("button", { name: "Save as Planned" }).click();
    await visible(page, section.getByRole("button", { name: "Cancel action: Replace the laptop" })).click();
    await section.getByRole("button", { name: "Confirm Cancel" }).click();
    await expect(section.getByText("Action cancelled.")).toBeVisible();

    // Three actions, different performers, completed/cancelled rows are read only.
    await expect(section.getByRole("heading", { name: /Actions Taken \(3\)/ })).toBeVisible();
    await expect(visible(page, section.getByText("Carlos Mendez")).first()).toBeVisible();
    await expect(visible(page, section.getByText("Confirm with requester tomorrow"))).toBeVisible();
    await expect(visible(page, section.getByText("Cancelled", { exact: true }))).toBeVisible();
    await expect(section.getByRole("button", { name: /^(Edit|Complete|Cancel) action:/ }).and(page.locator(":visible"))).toHaveCount(0);

    // The requester sees all three, with no controls.
    await page.getByRole("button", { name: /logout/i }).click();
    await loginAsUser(page, REQUESTER_EMAIL);
    await openOwnTicket(page, summary);
    const work = page.locator("section", { has: page.getByRole("heading", { name: "Work done on this ticket" }) });
    await expect(visible(page, work.getByText("Checked VPN concentrator logs"))).toBeVisible();
    await expect(visible(page, work.getByText("Reset VPN credentials"))).toBeVisible();
    await expect(visible(page, work.getByText("Replace the laptop"))).toBeVisible();
    await expect(work.getByRole("button")).toHaveCount(0);
  });

  test("actions are rejected by the API for a requester and for an inactive performer", async () => {
    const requesterApi = await playwrightRequest.newContext({ baseURL: API_URL });
    await apiLoginWithStandardPassword(requesterApi, API_URL, REQUESTER_EMAIL);
    const mine = await (await requesterApi.get(`/api/tickets?search=${encodeURIComponent(summary)}`)).json();
    const ticketId = mine.data[0].id;
    const asRequester = await requesterApi.post(`/api/tickets/${ticketId}/actions`, { data: { description: "Sneaky" } });
    expect(asRequester.status()).toBe(403);
    await requesterApi.dispose();

    const staffApi = await playwrightRequest.newContext({ baseURL: API_URL });
    await apiLoginWithStandardPassword(staffApi, API_URL, IT_EMAIL);
    const staffUsers = await (await staffApi.get("/api/staff-users")).json();
    expect(staffUsers.data.some((u: { name: string }) => u.name === "Former IT Staff")).toBe(false);
    const users = await (await staffApi.get("/api/requesters")).json();
    expect(Array.isArray(users)).toBe(true);
    const inactive = await staffApi.post(`/api/tickets/${ticketId}/actions`, {
      data: { description: "Assigned to someone inactive", performedById: 999999 },
    });
    expect(inactive.status()).toBe(400);
    await staffApi.dispose();
  });
});
