# 项目交接说明

## 当前状态（2026-08-14）

第一阶段本机单用户系统的核心功能已实现：18 章地图、章节工作台、自动保存回答、行动计划、结构化 Artifact、生命周期、复盘与版本、首页推荐、我的系统、本机 SQLite、迁移、已验证备份/受保护恢复、Windows 启停脚本和生命系统视觉。

正式内容目前是 **0 章 published**：`chapter-01` 到 `chapter-18` 均为 `awaiting_audio`。因此正常生产首页会显示“暂无可推荐的已发布章节”，章节详情不会开放。`content/fixtures/e2e-published-chapter.ts` 仅用于证明完整产品流，不属于课程，不得复制到正式 registry 条件之外。

## 技术架构

- Next.js 16 App Router、React 19、TypeScript，单 Node.js 进程，仅监听 `127.0.0.1`。
- 课程层：`content/schema.ts`、`content/chapters/registry.ts` 和各章模块，进入 Git。
- 私人层：原生 `node:sqlite`，repository 位于 `src/features/`，稳定 owner 为 `owner-local`。
- 页面与 API：`app/`；交互组件：`src/components/`。
- 数据保护：显式迁移；备份/恢复检查 realpath、文件身份、完整性、owner 和 migration；启动/停止检查端口、PID 与进程启动时间。
- E2E：串行 Playwright，合成 published chapter 受 `HARNESS_E2E=1` 和 `HARNESS_CONTENT_FIXTURE=published-chapter` 双环境变量保护。

## 本地数据位置

- 正式数据库：`data/harness.sqlite`
- E2E 数据库：`data/e2e.sqlite`（可重建；绝不能替代正式数据库）
- 已验证备份：`backups/*.sqlite`
- 启动器状态：`.runtime/server.json`
- 构建/测试输出：`.next/`、`test-results/`、`playwright-report/`
- 项目内 Chromium：`node_modules/playwright-core/.local-browsers/`
- 视觉证据：`artifacts/visual-check/`

上述运行文件都被 Git 忽略。交接时必须保留正式数据库和已有手动备份。

## 启动与停止

首次安装：`npm.cmd install`。日常双击 `scripts/Start-Harness.cmd` / `scripts/Stop-Harness.cmd`，或运行：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/Start-Harness.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/Stop-Harness.ps1
```

启动器在已有正式数据库时先备份，再迁移、校验内容、构建、隐藏启动生产服务器，确认就绪后才写 `.runtime/server.json` 并打开浏览器。最终实际 Start/Stop gate 应由能接受浏览器启动行为的控制器执行。

## 备份与恢复

网站停止时手动备份：

```powershell
npm.cmd run db:backup
```

必要时从项目内已验证备份恢复：

```powershell
npm.cmd run db:restore -- backups/harness-YYYYMMDD-HHMMSS.sqlite --confirm
```

不要手动覆盖数据库或移动 `-wal`/`-shm`。恢复会拒绝运行中网站、非项目备份、缺少确认和不安全路径；正式恢复前还会创建 `pre_restore` 备份。验收恢复测试只能用 `data/` 内新建临时目标，恢复后比较关键表计数并清理临时目标，不能恢复到 `data/harness.sqlite`。

## 处理并发布每章音频

1. 用户提供该章完整原音频；只读检查时长、语言、缺段。
2. 在项目工作区创建内部临时转录稿；不进入网站或 Git。
3. 修正口语重复、断句和明显识别错误；标记无法从音频确认的图像/界面信息。
4. 按 `content/schema.ts` 整理完整固定结构，使用稳定 ID。
5. 对照音频做忠实性检查，将摘要、结构和疑点交给用户明确审批。
6. 网站停止后运行 `npm.cmd run db:backup`。
7. 仅在审批后把章节改为 `published`，保持任何已有 chapter/prompt/field ID 不变。
8. 运行完整矩阵与逐页视觉检查。发布完成后删除内部临时转录稿，不触碰原始音频。

详情见 `docs/content-workflow.md`。

## 验证命令与证据

```powershell
npm.cmd run content:validate
npm.cmd test
npm.cmd run lint
npm.cmd run build
npm.cmd run test:e2e
```

E2E 浏览器仅安装到项目：

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH='0'
npx.cmd playwright install chromium
npm.cmd run test:e2e
```

Task11 的 RED/GREEN、1440×900 截图检查、console/page error、溢出/阅读列/sticky/focus/save-error 结果和最终矩阵记录在 `.superpowers/sdd/2026-08-13-personal-harness-learning-system/task-11-report.md`。

2026-08-14 的最新证据：内容校验为 18 章有效、0 章 published；Vitest 18 个文件、185 个测试通过；lint 与生产构建通过；串行 Playwright 5/5 通过且无警告；fresh project 会安全创建缺失的 `data/`、`backups/`，并拒绝 direct junction；启动器会拒绝 `.runtime` junction/预占临时记录，停止器会安全清理明确不存在 PID 的陈旧记录。临时恢复门禁的 9 张表集合与逐表计数一致，临时目标已清理。实际启动器 gate 中首页返回 HTTP 200；正式停止器 exit 0 后运行记录、监听端口和已记录 PID 均消失。视觉截图保存在 `artifacts/visual-check/`。

## 已知限制

- 当前没有正式已发布课程内容，只有等待音频的占位目录。
- 桌面端优先；手机仅保证基础阅读访问。
- 没有登录、多用户、远程访问、运行时 AI、CMS、文件上传、外链 Artifact、日历、提醒、打卡或社区。
- 自动保存失败会保留浏览器当前输入并允许重试，但用户仍应在关闭前确认“已保存”。
- 全部私人数据只有本机文件保护；用户需自行保护电脑和备份目录。

## 下一步（唯一内容优先项）

提供**完整第一章音频**，执行上述内容工作流并由用户审批后发布真实第一章。第一章发布前不要扩大产品范围；之后按同一门禁逐章处理第 2–18 章。任何多人、远程或额外功能都需用户另行明确批准。
