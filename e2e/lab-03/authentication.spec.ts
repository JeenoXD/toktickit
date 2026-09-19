import { test, expect } from "@playwright/test";
import { loginAsUser } from "../support/auth.js";

const ADMIN_EMAIL = "admin@example.com";

test.describe("Lab 3 authentication and mandatory password change", () => {
  test("first login forces a password change, and the new password works afterward", async ({ page }) => {
    // Create a fresh, never-touched-elsewhere account, so this test is immune
    // to whatever order other specs ran in and what they did to admin's own password.
    await loginAsUser(page, ADMIN_EMAIL);
    await page.getByRole("button", { name: /user management/i }).click();
    await page.getByRole("button", { name: /^create user$/i }).click();

    const email = `fresh-login-${Date.now()}@example.com`;
    const tempPassword = "FreshTempPass1!";
    await page.locator("#user-name").fill("Fresh Login Test User");
    await page.locator("#user-email").fill(email);
    await page.locator("#user-password").fill(tempPassword);
    await page.getByRole("button", { name: /save user/i }).click();
    await expect(page.getByRole("cell", { name: email, exact: true })).toBeVisible();

    await page.getByRole("button", { name: /logout/i }).click();
    await expect(page.locator("#email")).toBeVisible({ timeout: 15000 });

    await page.locator("#email").fill(email);
    await page.locator("#password").fill(tempPassword);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.getByRole("heading", { name: /update password/i })).toBeVisible({ timeout: 15000 });

    const newPassword = "FreshNewPass1!";
    await page.locator("#currentPassword").fill("WrongCurrentPass1!");
    await page.locator("#newPassword").fill(newPassword);
    await page.getByRole("button", { name: /update password/i }).click();
    await expect(page.getByText(/incorrect|invalid/i)).toBeVisible({ timeout: 15000 });

    await page.locator("#currentPassword").fill(tempPassword);
    await page.locator("#newPassword").fill(newPassword);
    await page.getByRole("button", { name: /update password/i }).click();
    await expect(page.getByRole("button", { name: /logout/i })).toBeVisible({ timeout: 15000 });

    await page.getByRole("button", { name: /logout/i }).click();
    await expect(page.locator("#email")).toBeVisible({ timeout: 15000 });

    await page.locator("#email").fill(email);
    await page.locator("#password").fill(newPassword);
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page.getByRole("button", { name: /logout/i })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("heading", { name: /update password/i })).not.toBeVisible();
  });
});