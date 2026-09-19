import { test, expect } from "@playwright/test";
import { loginAsUser } from "../support/auth.js";

const ADMIN_EMAIL = "admin@example.com";
const NEW_USER_NAME = "QA Created User";
const NEW_USER_EMAIL = `qa.created.user.${Date.now()}@example.com`;
const NEW_USER_PASSWORD = "NewUserPass1!";

test.describe("Lab 3 Administrator create user and password change requirement", () => {
  test("admin creates a user, duplicate email is rejected, and the new account must change its password on first login", async ({ page }) => {
    await loginAsUser(page, ADMIN_EMAIL);
    await page.getByRole("button", { name: /user management/i }).click();
    await expect(page.getByRole("heading", { name: /user management/i })).toBeVisible();

    // Create the new user.
    await page.getByRole("button", { name: /^create user$/i }).click();
    await page.locator("#user-name").fill(NEW_USER_NAME);
    await page.locator("#user-email").fill(NEW_USER_EMAIL);
    await page.locator("#user-password").fill(NEW_USER_PASSWORD);
    await page.getByRole("button", { name: /save user/i }).click();

    await expect(page.getByRole("cell", { name: NEW_USER_EMAIL, exact: true })).toBeVisible();
    const newUserRow = page.locator("tr", { has: page.getByText(NEW_USER_EMAIL, { exact: true }) });
    await expect(newUserRow.getByText("REQUESTER", { exact: true })).toBeVisible();
    await expect(newUserRow.getByText("Active", { exact: true })).toBeVisible();

    // Duplicate email is rejected with a clear error, not a silent failure.
    await page.getByRole("button", { name: /^create user$/i }).click();
    await page.locator("#user-name").fill("Duplicate Attempt");
    await page.locator("#user-email").fill(NEW_USER_EMAIL);
    await page.locator("#user-password").fill("AnotherPass1!");
    await page.getByRole("button", { name: /save user/i }).click();
    await expect(page.getByText("A user with this email already exists")).toBeVisible();
    await page.getByRole("button", { name: /^cancel$/i }).click();

    // Log out as admin, then confirm the newly created account is forced
    // through the mandatory password change on its very first login.
    await page.getByRole("button", { name: /logout/i }).click();
    await expect(page.locator("#email")).toBeVisible({ timeout: 15000 });

    await page.locator("#email").fill(NEW_USER_EMAIL);
    await page.locator("#password").fill(NEW_USER_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page.getByRole("heading", { name: /update password/i })).toBeVisible({ timeout: 15000 });
  });
});