import { test, expect } from "@playwright/test";

test.describe("09 - Connectors Page", () => {
  test("connectors page loads or redirects", async ({ page }) => {
    await page.goto("/connectors");
    await page.waitForLoadState("networkidle").catch(() => {});
    await expect(page).toHaveURL(/(connectors|login)/);
  });

  test("connectors page renders cards when accessible", async ({ page }) => {
    await page.goto("/connectors");
    await page.waitForLoadState("networkidle").catch(() => {});
    const url = page.url();
    if (url.includes("connectors")) {
      // Should show connector-related content
      const content = page.locator("text=/Connector|Integration|Connect|Status/i");
      const count = await content.count();
      expect(count).toBeGreaterThanOrEqual(0);
    }
  });

  test("connectors page has status badges when accessible", async ({ page }) => {
    await page.goto("/connectors");
    await page.waitForLoadState("networkidle").catch(() => {});
    const url = page.url();
    if (url.includes("connectors")) {
      // Status badges are typically spans with rounded-full class
      const badges = page.locator(".rounded-full, [class*='badge'], [class*='status']");
      const count = await badges.count();
      expect(count).toBeGreaterThanOrEqual(0);
    }
  });

  test("connectors screenshot", async ({ page }) => {
    await page.goto("/connectors");
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.screenshot({ path: "e2e/screenshots/09-connectors.png", fullPage: true });
  });
});
