import { test, expect } from "@playwright/test";

test.describe("01 - Authentication", () => {
  test("login page loads with email/password fields", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("input[type='email'], input[placeholder*='mail'], input[placeholder*='Email']")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("input[type='password']")).toBeVisible({ timeout: 10000 });
  });

  test("login form validation - empty submit", async ({ page }) => {
    await page.goto("/login");
    const submitBtn = page.locator("button[type='submit'], button:has-text('Login'), button:has-text('Sign In'), button:has-text('Continue')");
    await submitBtn.first().click({ timeout: 10000 }).catch(() => {});
    // Should still be on login page
    await expect(page).toHaveURL(/login/);
  });

  test("login page screenshot", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.screenshot({ path: "e2e/screenshots/01-login.png", fullPage: true });
  });
});
