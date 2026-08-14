import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

const screenshotDirectory = join(
  process.cwd(),
  "artifacts",
  "visual-check",
);

test.beforeAll(() => {
  mkdirSync(screenshotDirectory, { recursive: true });
});

test("keeps the desktop pages readable and free of browser errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(`${message.text()} (${message.location().url || "unknown URL"})`);
    }
  });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400) {
      errors.push(`HTTP ${response.status()} ${response.url()}`);
    }
  });

  for (const route of [
    { path: "/", screenshot: "home.png" },
    { path: "/chapters", screenshot: "chapters.png" },
    { path: "/chapters/chapter-01", screenshot: "chapter-01.png" },
    { path: "/system", screenshot: "system.png" },
  ]) {
    await page.goto(route.path);
    await page.waitForLoadState("networkidle");

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalOverflow, `${route.path} has horizontal overflow`).toBe(false);

    await page.screenshot({
      path: join(screenshotDirectory, route.screenshot),
    });
  }

  expect(errors, "desktop routes emitted console or page errors").toEqual([]);
});

test("keeps the chapter reading column and sticky summary usable", async ({
  page,
}) => {
  await page.goto("/chapters/chapter-01");
  await page.waitForLoadState("networkidle");

  const readingWidths = await page
    .locator(".chapter-workspace__content")
    .evaluate((content) => {
      const probe = document.createElement("span");
      const contentStyle = getComputedStyle(content);
      probe.style.cssText = [
        "position:absolute",
        "visibility:hidden",
        "width:72ch",
        `font:${contentStyle.font}`,
      ].join(";");
      document.body.append(probe);
      const result = {
        actual: content.getBoundingClientRect().width,
        maximum: probe.getBoundingClientRect().width,
      };
      probe.remove();
      return result;
    });
  expect(readingWidths.actual).toBeLessThanOrEqual(readingWidths.maximum + 1);

  const summary = page.getByLabel("行动与产物摘要");
  await expect(summary).toHaveCSS("position", "sticky");
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
  );
  const summaryBox = await summary.boundingBox();
  expect(summaryBox).not.toBeNull();
  expect(summaryBox?.y).toBeGreaterThanOrEqual(0);
  expect(summaryBox?.y).toBeLessThan(900);
});

test("shows keyboard focus and a legible autosave error", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.keyboard.press("Tab");

  const focusStyle = await page.evaluate(() => {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement)) return null;
    const style = getComputedStyle(active);
    return {
      outlineStyle: style.outlineStyle,
      outlineWidth: Number.parseFloat(style.outlineWidth),
    };
  });
  expect(focusStyle).not.toBeNull();
  expect(focusStyle?.outlineStyle).not.toBe("none");
  expect(focusStyle?.outlineWidth).toBeGreaterThanOrEqual(3);
  await page.screenshot({ path: join(screenshotDirectory, "keyboard-focus.png") });

  await page.route("**/api/responses", async (route) => {
    await route.fulfill({ status: 500, body: "save failed" });
  });
  await page.goto("/chapters/chapter-01");
  await page.waitForLoadState("networkidle");
  await page
    .getByLabel("我现在遇到什么问题？")
    .fill("验证保存错误仍然清晰可读");

  const alert = page.getByRole("alert").filter({ hasText: "保存失败，请重试。" });
  await expect(alert).toBeVisible();
  const fontSize = await alert.evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).fontSize),
  );
  expect(fontSize).toBeGreaterThanOrEqual(14);
  await alert.scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(screenshotDirectory, "save-error.png") });
});
