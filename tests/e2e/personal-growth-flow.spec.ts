import { expect, test } from "@playwright/test";

test("follows the recommended growth flow until no published chapter remains", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.getByRole("link", { name: "测试用已发布章节" }).click();
  await page.waitForLoadState("networkidle");

  await page
    .getByLabel("我现在遇到什么问题？")
    .fill("我在内容创作时不断切换方向");
  await expect(page.getByText("已保存", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "完成本章学习" }).click();
  await expect(
    page.getByRole("button", { name: "已完成本章学习" }),
  ).toBeVisible();

  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const recommendation = page.locator(".next-action");
  await expect(recommendation).toContainText("制定行动");
  await expect(
    recommendation.getByRole("heading", { name: "测试用已发布章节" }),
  ).toBeVisible();
  await recommendation.getByRole("link", { name: "打开章节工作台" }).click();
  await page.waitForLoadState("networkidle");

  await page
    .getByLabel("现实问题", { exact: true })
    .fill("减少内容创作中的目标切换");
  await page.getByLabel("行动", { exact: true }).fill("每次只推进一个内容主题");
  await page
    .getByLabel("可观察的成功标准", { exact: true })
    .first()
    .fill("连续三次完成当天最重要的内容成果");
  await page.getByRole("button", { name: "保存行动计划" }).click();
  await expect(page.getByLabel("行动与产物摘要")).toContainText(
    "每次只推进一个内容主题",
  );

  await page
    .getByLabel("要解决的现实问题")
    .fill("减少内容创作中的目标切换");
  await page
    .getByLabel("从课程采用的核心原则")
    .fill("先观察，再选择最小行动");
  await page.getByLabel("运行规则").fill("每次只推进一个内容主题");
  await page
    .getByLabel("可观察的成功标准", { exact: true })
    .last()
    .fill("连续三次完成当天最重要的内容成果");
  await page.getByRole("button", { name: "创建 Artifact" }).click();
  await expect(page.getByText("版本 1").first()).toBeVisible();

  await page.getByRole("button", { name: "开始实践" }).click();
  await expect(
    page.getByRole("button", { name: "标记为可以复盘" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "标记为可以复盘" }).click();

  await page
    .getByLabel("实际发生了什么")
    .fill("完成率提高，但消息处理仍然打断下午工作");
  await page
    .getByLabel("什么有效、什么没有")
    .fill("单任务有效，消息窗口过长");
  await page
    .getByLabel("下一版本只改一件什么事")
    .fill("每个消息窗口限制为 15 分钟");
  await page
    .getByRole("button", { name: "完成复盘并创建下一版本" })
    .click();
  await expect(page.getByText("版本 2").first()).toBeVisible();

  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await expect(
    page.getByText("暂无可推荐的已发布章节。", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("制定行动", { exact: true })).toHaveCount(0);
});
