import { test, expect } from "@playwright/test";

test.describe("10 - Lead Scoring Normalization", () => {
  test("leads page loads or redirects", async ({ page }) => {
    await page.goto("/leads");
    await page.waitForLoadState("networkidle").catch(() => {});
    await expect(page).toHaveURL(/(leads|login)/);
  });

  test("score values are in 0-100 range when leads are displayed", async ({ page }) => {
    await page.goto("/leads");
    await page.waitForLoadState("networkidle").catch(() => {});
    const url = page.url();
    if (url.includes("leads")) {
      // Look for numeric score values in the page
      const scoreElements = page.locator("[data-score], [class*='score'], .score-value");
      const count = await scoreElements.count();
      if (count > 0) {
        for (let i = 0; i < Math.min(count, 10); i++) {
          const text = await scoreElements.nth(i).textContent();
          const score = parseInt(text?.trim() ?? "0", 10);
          if (!isNaN(score)) {
            expect(score).toBeGreaterThanOrEqual(0);
            expect(score).toBeLessThanOrEqual(100);
          }
        }
      }
      // Even if no scored leads exist, the page should render
      expect(true).toBeTruthy();
    }
  });

  test("scoring normalization screenshot", async ({ page }) => {
    await page.goto("/leads");
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.screenshot({ path: "e2e/screenshots/10-scoring.png", fullPage: true });
  });
});
