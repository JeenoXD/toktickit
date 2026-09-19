import { Page, APIRequestContext, expect } from "@playwright/test";

export const SEED_PASSWORD = "TempPass123!";
// One canonical "already past the mandatory change" password, used by every
// spec in the suite. Files run against a shared, un-reseeded database once
// other files (or other projects) have already touched an account, so every
// login helper here is written to work whether an account is still fresh or
// was already moved to this password by something that ran earlier.
export const STANDARD_PASSWORD = "Lab3Standard1!";

export async function loginAsUser(
  page: Page,
  email: string,
  password: string = SEED_PASSWORD,
  newPassword: string = STANDARD_PASSWORD
): Promise<void> {
  await attemptSignIn(page, email, password);

  const updatePasswordHeading = page.getByRole("heading", { name: /update password/i });
  const logoutButton = page.getByRole("button", { name: /logout/i });
  const loginError = page.locator(".alert-danger");

  await Promise.race([
    updatePasswordHeading.waitFor({ state: "visible", timeout: 15000 }),
    logoutButton.waitFor({ state: "visible", timeout: 15000 }),
    loginError.waitFor({ state: "visible", timeout: 15000 }),
  ]);

  if (await loginError.isVisible()) {
    // The given password no longer works, an earlier file already changed
    // it. Retry with the canonical post-change password instead.
    await attemptSignIn(page, email, newPassword);
    await Promise.race([
      updatePasswordHeading.waitFor({ state: "visible", timeout: 15000 }),
      logoutButton.waitFor({ state: "visible", timeout: 15000 }),
    ]);
  }

  if (await updatePasswordHeading.isVisible()) {
    await page.locator("#currentPassword").fill(password);
    await page.locator("#newPassword").fill(newPassword);
    await page.getByRole("button", { name: /update password/i }).click();
    await expect(logoutButton).toBeVisible({ timeout: 15000 });
  }
}

async function attemptSignIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/");
  await page.locator("#email").waitFor({ state: "visible", timeout: 15000 });
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
}

/**
 * API-context equivalent for beforeAll setup blocks: logs in with the seed
 * password, and if that fails (already changed by an earlier file or an
 * earlier project's run), adopts STANDARD_PASSWORD instead. Completes the
 * mandatory password change via the API when needed, so a test can rely on
 * "this account is now on STANDARD_PASSWORD" regardless of run order.
 */
export async function apiLoginWithStandardPassword(
  api: APIRequestContext,
  apiUrl: string,
  email: string
): Promise<void> {
  const freshLogin = await api.post(`${apiUrl}/api/auth/login`, {
    data: { email, password: SEED_PASSWORD },
  });

  if (freshLogin.ok()) {
    const changeRes = await api.post(`${apiUrl}/api/auth/change-password`, {
      data: { currentPassword: SEED_PASSWORD, newPassword: STANDARD_PASSWORD },
    });
    expect(changeRes.ok()).toBeTruthy();
    return;
  }

  const retryLogin = await api.post(`${apiUrl}/api/auth/login`, {
    data: { email, password: STANDARD_PASSWORD },
  });
  expect(retryLogin.ok()).toBeTruthy();
}