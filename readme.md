# 超体 · 我的成长操作系统

这是一个只在本机 `127.0.0.1` 运行的单用户成长网站。它把经过审核的课程内容连接到个人回答、行动计划、Artifact、实践和复盘；运行时不调用 AI，不对外提供服务，私人记录只保存在项目内的 SQLite 数据库。

> 当前正式课程状态：18 章目录已建立，0 章 `published`，18 章都在等待完整音频。端到端测试使用的“测试用已发布章节”只是合成 fixture，不是课程内容。

## 使用前准备

- Windows 与 PowerShell。
- Node.js 24.14 或更高版本（当前验证版本为 24.14.1）。
- 在项目目录运行一次 `npm.cmd install`。不要全局安装依赖。

## 每日使用

1. 双击 `scripts\Start-Harness.cmd`，或在项目目录运行：

   ```powershell
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/Start-Harness.ps1
   ```

2. 等待启动器完成数据备份（已有数据库时）、迁移、内容校验和生产构建。浏览器会打开 `http://127.0.0.1:3000`。
3. 在网站中学习并保存个人回答。文字回答会自动保存；行动计划、Artifact 和复盘按页面按钮保存。
4. 结束时双击 `scripts\Stop-Harness.cmd`，或运行：

   ```powershell
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/Stop-Harness.ps1
   ```

启动器只绑定 `127.0.0.1:3000`，不会安装软件、修改 PowerShell 全局策略、防火墙或公网设置。停止器会同时校验项目内运行记录、PID 和进程启动时间，避免停止无关进程。

## 数据在哪里

- 私人数据：`data\harness.sqlite`
- 已验证备份：`backups\harness-YYYYMMDD-HHMMSS.sqlite`
- 运行记录：`.runtime\server.json`
- 课程内容：`content\chapters\`

数据库、备份、运行记录、测试数据库、构建输出和浏览器文件均被 Git 忽略。不要手动复制或删除 SQLite 的 `-wal`、`-shm` 文件；不要提交私人数据、音频或内部转录稿。

## 备份与恢复

每次获批章节发布或数据库结构变更前，先停止网站，再运行：

```powershell
npm.cmd run db:backup
npm.cmd run content:validate
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

手动备份会通过 SQLite 完整性、默认所有者和迁移记录校验。恢复只在确实需要时执行：网站必须停止，来源必须是项目 `backups\` 内已验证的 `.sqlite` 文件，并显式提供 `--confirm`。

```powershell
npm.cmd run db:restore -- backups/harness-20260813-120000.sqlite --confirm
```

恢复程序会先验证来源；若目标数据库存在，还会先创建 `pre_restore` 备份。不要把 `data\harness.sqlite` 本身作为恢复来源，也不要直接覆盖正式数据库文件。

## 发布一章课程

每一章都执行同一批准流程：

1. 提供该章完整原始音频；项目不复制、修改或删除源音频。
2. 在项目工作区生成内部临时转录稿，修正口语重复、断句和明显识别错误。
3. 标记无法仅凭音频确认的视觉信息，不猜测画面。
4. 按固定章节契约整理问题、结构、讲解、概念、场景、误解、反思问题、行动和 Artifact 模板。
5. 对照音频检查忠实度，并由内容所有者明确审批。
6. 发布前停止网站并运行 `npm.cmd run db:backup`。
7. 保持已发布的 chapter ID、prompt ID 和 Artifact 模板字段 ID 稳定，再更新 `content\chapters\` 与 registry。
8. 运行完整验证矩阵并逐页目视检查。审批发布后删除内部临时转录稿，不触碰源音频。

完整细则见 `docs\content-workflow.md`。下一项内容工作是提供并处理完整第一章音频；之后逐章重复，不应把测试 fixture 发布为正式课程。

## 开发与验证

开发服务器：

```powershell
npm.cmd run dev
```

完整验证矩阵：

```powershell
npm.cmd run content:validate
npm.cmd test
npm.cmd run lint
npm.cmd run build
npm.cmd run test:e2e
```

E2E 只使用 `data\e2e.sqlite`，串行运行，并通过 `HARNESS_E2E=1` 与 `HARNESS_CONTENT_FIXTURE=published-chapter` 双重保护启用合成章节。seed 只允许删除 `data\e2e.sqlite` 及明确的 `-wal`、`-shm` sidecar，绝不操作 `data\harness.sqlite`。

Playwright Chromium 必须安装到项目自身的 `node_modules\playwright-core\.local-browsers`：

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH='0'
npx.cmd playwright install chromium
npm.cmd run test:e2e
```

`playwright.config.ts` 会在测试执行时设置同一项目内路径。不要全局安装 Playwright 或浏览器。

## 第一阶段边界

第一阶段不包含注册登录、邀请码、公网/LAN 访问、运行时 AI、CMS、文件上传、外部 Artifact 链接、日历、提醒、打卡、积分、排行或社区。全部章节可见，但只有内容所有者审核后标为 `published` 的章节可以打开。未来扩展必须由用户明确批准。
