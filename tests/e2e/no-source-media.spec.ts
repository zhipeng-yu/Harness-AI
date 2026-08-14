import { expect, test } from "@playwright/test";

test("does not expose original audio or transcript UI", async ({ page }) => {
  const response = await page.goto("/chapters/chapter-01");
  await page.waitForLoadState("networkidle");

  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { name: "测试用已发布章节" }),
  ).toBeVisible();

  await expect(page.locator("audio, video")).toHaveCount(0);
  await expect(page.getByText(/逐字稿|下载音频/)).toHaveCount(0);
});
