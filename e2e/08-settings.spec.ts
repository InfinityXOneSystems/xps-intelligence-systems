import { test, expect } from "@playwright/test";

test.describe("08 - Settings", () => {
  test("settings page loads or redirects", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle").catch(() => {});
    await expect(page).toHaveURL(/(settings|login)/);
  });

  test("settings page renders content when accessible", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle").catch(() => {});
    const url = page.url();
    if (url.includes("settings")) {
      // Page should render without crash
      const body = await page.locator("body").textContent();
      expect(body).toBeTruthy();
    }
  });

  test("settings screenshot", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.screenshot({ path: "e2e/screenshots/08-settings.png", fullPage: true });
  });
});
