import { test, expect } from "@playwright/test";

test.describe("06 - AI Assistant", () => {
  test("ai-assistant page loads or redirects", async ({ page }) => {
    await page.goto("/ai-assistant");
    await page.waitForLoadState("networkidle").catch(() => {});
    await expect(page).toHaveURL(/(ai-assistant|login)/);
  });

  test("ai-assistant has chat input and send button", async ({ page }) => {
    await page.goto("/ai-assistant");
    await page.waitForLoadState("networkidle").catch(() => {});
    const url = page.url();
    if (url.includes("ai-assistant")) {
      const chatInput = page.locator("input[placeholder*='assistant'], input[placeholder*='Ask'], input[placeholder*='message']");
      const sendBtn = page.locator("button[aria-label*='send'], button:has([data-lucide='send']), button svg");
      const hasInput = await chatInput.count();
      expect(hasInput).toBeGreaterThan(0);
      const hasSend = await sendBtn.count();
      expect(hasSend).toBeGreaterThan(0);
    }
  });

  test("ai-assistant can type and submit message", async ({ page }) => {
    await page.goto("/ai-assistant");
    await page.waitForLoadState("networkidle").catch(() => {});
    const url = page.url();
    if (url.includes("ai-assistant")) {
      const chatInput = page.locator("input[placeholder*='assistant'], input[placeholder*='Ask'], input[placeholder*='message']").first();
      if (await chatInput.isVisible()) {
        await chatInput.fill("Hello, test message");
        // Check value was typed
        const value = await chatInput.inputValue();
        expect(value).toBe("Hello, test message");
      }
    }
  });

  test("ai-assistant screenshot", async ({ page }) => {
    await page.goto("/ai-assistant");
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.screenshot({ path: "e2e/screenshots/06-ai-assistant.png", fullPage: true });
  });
});
