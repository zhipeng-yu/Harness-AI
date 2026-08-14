# Task 11 Report：完整 E2E、视觉验收与最终文档

日期：2026-08-14

分支：`main`

基线：`4f46e4df681e21748842ed09e1ad6351ab1e1d6a`

## 交付范围

- Playwright 串行 E2E 使用 `data/e2e.sqlite`，通过 `HARNESS_E2E=1` 与 `HARNESS_CONTENT_FIXTURE=published-chapter` 双门禁启用合成已发布章节。
- global setup 只允许删除项目 `data/` 直属的 `e2e.sqlite`、`e2e.sqlite-wal`、`e2e.sqlite-shm`，并检查 realpath、精确文件名与符号链接。
- Playwright 显式解析 `node_modules/playwright-core/.local-browsers/chromium-*/chrome-win64/chrome.exe`；浏览器 realpath 必须位于项目 `node_modules/playwright-core` 内。
- E2E 覆盖完整增长闭环、原音频/逐字稿不暴露、1440×900 桌面视觉与错误态。
- 新增 Next 原生 `app/icon.svg`，消除浏览器请求 `/favicon.ico` 的 404 console error。
- Vitest 仅发现 `tests/unit` 与 `tests/integration`，避免把 Playwright spec 作为单元测试加载。
- `readme.md`、`AGENTS.md`、`HANDOFF.md` 已补齐所有者日常使用、边界、备份/恢复、内容发布与验证说明。

## RED / GREEN 记录

1. 首次 focused E2E RED：Playwright 以 CommonJS 加载 global setup，`scripts/seed-e2e-content.ts` 的 `import.meta` 报 `SyntaxError`。GREEN：移除仅用于直接执行的 `import.meta` 分支，把项目根目录检查放进默认 setup；global setup 可正常迁移隔离数据库。
2. 第二个 RED：Playwright 默认寻找未下载的 `chromium_headless_shell-1234`。GREEN：把已下载 full Chromium 的 realpath 放入 `use.launchOptions.executablePath`；增长流实际用例通过。
3. 当前执行沙箱中的 teardown RED：用例显示 `ok` 后停在 `pw:webserver Terminating the WebServer`。边界实验使用与 Playwright 相同的 `taskkill /T /F`：沙箱内 53ms 返回 `Access denied`；同一精确 PID 在获批的沙箱外命令中成功清理。该问题是执行权限，不是应用或 Next 进程树缺陷；controller 的 escalated E2E 正常退出。
4. 视觉测试 RED：首次路由触发 `/favicon.ico` 404 console error。GREEN：添加 `app/icon.svg` 后 focused 测试 `1 passed`，console/page error 列表为空。
5. 完整 `npm.cmd test` RED：170 个原测试通过，但 Vitest 误加载 3 个 Playwright spec。GREEN：`vitest.config.ts` 精确 include unit/integration，复跑 17/17 文件、170/170 测试通过。
6. 初次完整 E2E 通过但包含 `node:sqlite` ExperimentalWarning 和 Next `missing-data-scroll-behavior` 警告。GREEN：E2E runner/webServer 只禁用精确 `ExperimentalWarning` 类别，`<html>` 增加 `data-scroll-behavior="smooth"`；最终 5/5 输出无警告。

## 视觉验收

视口固定为 1440×900，所有页面先等待 `networkidle`，再执行断言与截图。

- `artifacts/visual-check/home.png`
- `artifacts/visual-check/chapters.png`
- `artifacts/visual-check/chapter-01.png`
- `artifacts/visual-check/system.png`
- `artifacts/visual-check/keyboard-focus.png`
- `artifacts/visual-check/save-error.png`

已自动断言并人工查看：

- `/`、`/chapters`、fixture `/chapters/chapter-01`、`/system` 没有横向溢出；console error、page error 与 HTTP 4xx/5xx 均为空。
- 章节阅读列实测不超过同字体的 72ch；右侧“行动与产物摘要”为 sticky，滚动到底后仍在 900px 视口内。
- 键盘 Tab 焦点有不小于 3px 的可见 outline。
- 拦截 `/api/responses` 为 500 后，“保存失败，请重试。”与“重试保存”按钮可见，字体不小于 14px；截图已滚动到错误提示。

## 最终验证证据

| 门禁 | 结果 |
| --- | --- |
| `npm.cmd run content:validate` | PASS：`Validated 18 chapters (0 published).` |
| `npm.cmd test` | PASS：17/17 files，170/170 tests，95.61s |
| `npm.cmd run lint` | PASS：exit 0，零错误 |
| `npm.cmd run build` | PASS：编译、TypeScript、7/7 静态页面生成完成；`/icon.svg` 已列入路由 |
| `$env:PLAYWRIGHT_BROWSERS_PATH='0'; npm.cmd run test:e2e` | PASS：controller escalated run 5/5，27.0s，exit 0，无警告 |
| 临时恢复 count gate | PASS：备份与 `data/task11-restore-gate.sqlite` 的 9 张真实表集合和逐表计数一致；临时目标已删除 |
| 实际 Start/Stop gate | PASS：`Start-Harness.ps1 -SkipBrowser` 写入 PID 41416 / `2026-08-14T01:38:21.5387664Z`，首页 HTTP 200；`Stop-Harness.ps1` exit 0，之后 runtime absent、HTTP unreachable、PID absent |

恢复门禁比较的表为：`action_plans`、`artifact_versions`、`artifacts`、`backup_records`、`chapter_progress`、`owners`、`responses`、`reviews`、`schema_migrations`。恢复来源是已有 `backups/harness-20260813-140718.sqlite`；目标只使用新建临时文件，没有恢复到 `data/harness.sqlite`。恢复门禁结束当时，正式数据库与原备份仍为 90112 bytes，时间戳均为 2026-08-13 14:07:18。之后 controller 的正式启动 gate 按启动器设计生成了新的 `backups/harness-20260814-093813.sqlite`；原手动备份仍保留。

## Concerns / 后续

- 正式内容仍为 0 章 published；E2E 的“测试用已发布章节”仅是合成 fixture，绝不能当作真实课程发布。
- Playwright 浏览器文件与截图均为项目本地、被 Git 忽略的运行证据，不应提交。
- 实际 Windows 启动/停止 gate 已由 controller 完成；停止后 `.runtime/server.json` 不存在、3000 端口无监听、已记录 PID 不存在。
- 唯一内容优先项仍是取得完整第一章音频，按审批、备份、发布、完整验证门禁处理；不应扩大产品范围。
