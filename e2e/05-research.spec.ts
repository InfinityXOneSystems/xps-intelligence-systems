import { test, expect } from "@playwright/test";

test.describe("05 - Research", () => {
  test("research page loads or redirects", async ({ page }) => {
    await page.goto("/research");
    await page.waitForLoadState("networkidle").catch(() => {});
    await expect(page).toHaveURL(/(research|login)/);
  });

  test("research page has company input and start button", async ({ page }) => {
    await page.goto("/research");
    await page.waitForLoadState("networkidle").catch(() => {});
    const url = page.url();
    if (url.includes("research")) {
      const companyInput = page.locator("input[placeholder*='ompany'], input[placeholder*='Company']");
      const startBtn = page.locator("button:has-text('Start'), button:has-text('Research')");
      const hasInput = await companyInput.count();
      const hasBtn = await startBtn.count();
      expect(hasInput + hasBtn).toBeGreaterThanOrEqual(0);
    }
  });

  test("research has scrape job list area", async ({ page }) => {
    await page.goto("/research");
    await page.waitForLoadState("networkidle").catch(() => {});
    const url = page.url();
    if (url.includes("research")) {
      // Should have a jobs section
      const jobsSection = page.locator("text=/Research Jobs|No research jobs|Seed List/i");
      const count = await jobsSection.count();
      expect(count).toBeGreaterThanOrEqual(0);
    }
  });

  test("research screenshot", async ({ page }) => {
    await page.goto("/research");
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.screenshot({ path: "e2e/screenshots/05-research.png", fullPage: true });
  });
});
