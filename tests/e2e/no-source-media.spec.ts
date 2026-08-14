import { expect, test } from "@playwright/test";

test("does not expose original audio or transcript UI", async ({ page }) => {
  await page.goto("/chapters/chapter-01");
  await page.waitForLoadState("networkidle");

  await expect(page.locator("audio, video")).toHaveCount(0);
  await expect(page.getByText(/逐字稿|下载音频/)).toHaveCount(0);
});
