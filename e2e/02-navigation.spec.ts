import { test, expect } from "@playwright/test";

const routes = [
  "/dashboard",
  "/leads",
  "/ai-assistant",
  "/crm",
  "/research",
  "/outreach",
  "/proposals",
  "/analytics",
  "/knowledge",
  "/competition",
  "/connectors",
  "/admin",
  "/settings",
];

test.describe("02 - Navigation", () => {
  for (const route of routes) {
    test(`${route} loads or redirects to /login`, async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState("networkidle").catch(() => {});
      const url = page.url();
      const routeName = route.replace("/", "");
      const isOnRoute = url.includes(routeName) || url.includes("login");
      expect(isOnRoute).toBeTruthy();
    });
  }

  test("screenshot all accessible pages", async ({ page }) => {
    for (const route of routes) {
      await page.goto(route);
      await page.waitForLoadState("networkidle").catch(() => {});
      const name = route.replace("/", "") || "root";
      await page.screenshot({ path: `e2e/screenshots/02-nav-${name}.png` }).catch(() => {});
    }
  });
});
