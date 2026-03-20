import { test, expect } from "@playwright/test";

test.describe("07 - Admin", () => {
  test("admin page loads or redirects", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForLoadState("networkidle").catch(() => {});
    await expect(page).toHaveURL(/(admin|login)/);
  });

  test("admin page shows system cards when accessible", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForLoadState("networkidle").catch(() => {});
    const url = page.url();
    if (url.includes("admin")) {
      const adminContent = page.locator("text=/Admin|System|Control/i");
      expect(await adminContent.count()).toBeGreaterThan(0);
      await page.screenshot({ path: "e2e/screenshots/07-admin-overview.png" });
    }
  });

  test("admin Workflows tab renders", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForLoadState("networkidle").catch(() => {});
    const url = page.url();
    if (url.includes("admin")) {
      const workflowsTab = page.locator("button:has-text('Agent Builder'), button:has-text('Workflows')");
      if (await workflowsTab.count() > 0) {
        await workflowsTab.first().click();
        await page.waitForLoadState("networkidle").catch(() => {});
        await page.screenshot({ path: "e2e/screenshots/07-admin-workflows.png" });
        const content = page.locator("text=/Workflow|Agent/i");
        expect(await content.count()).toBeGreaterThan(0);
      }
    }
  });

  test("admin Audit tab renders", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForLoadState("networkidle").catch(() => {});
    const url = page.url();
    if (url.includes("admin")) {
      const auditTab = page.locator("button:has-text('Audit')");
      if (await auditTab.count() > 0) {
        await auditTab.first().click();
        await page.waitForLoadState("networkidle").catch(() => {});
        await page.screenshot({ path: "e2e/screenshots/07-admin-audit.png" });
        const content = page.locator("text=/Audit|Log/i");
        expect(await content.count()).toBeGreaterThan(0);
      }
    }
  });

  test("admin Connectors tab renders", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForLoadState("networkidle").catch(() => {});
    const url = page.url();
    if (url.includes("admin")) {
      const connectorsTab = page.locator("button:has-text('Connectors')");
      if (await connectorsTab.count() > 0) {
        await connectorsTab.first().click();
        await page.waitForLoadState("networkidle").catch(() => {});
        await page.screenshot({ path: "e2e/screenshots/07-admin-connectors.png" });
        const content = page.locator("text=/Connector|Integration/i");
        expect(await content.count()).toBeGreaterThan(0);
      }
    }
  });
});
