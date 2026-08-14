# AGENTS.md

## 项目目的与当前事实

本项目是 Windows 本机单用户“超体 · 我的成长操作系统”。核心闭环是：理解课程 → 联系自身 → 设计行动 → 创建结构化文字 Artifact → 实践 → 复盘 → 生成下一版本。当前 18 章正式目录全部为 `awaiting_audio`，正式 `published` 数为 0。`content/fixtures/e2e-published-chapter.ts` 只是合成测试内容，绝不能当作真实课程发布。

## 不可突破的边界

- 只绑定 `127.0.0.1`，不增加 LAN、公网、隧道、部署、注册、登录或邀请能力。
- 私人记录仅保存在 `data/harness.sqlite`；数据库、备份、音频、转录稿和运行数据不得提交 Git 或发送到外部服务。
- 运行时不调用 AI；网站不展示、提供下载或打包原音频及逐字稿。
- 课程内容与私人记录分离。内容使用稳定 chapter ID、prompt ID、Artifact 字段 ID；已发布 ID 不得随显示文字变化。
- Artifact 使用结构化文字和不可覆盖的版本；归档代替破坏性删除。
- 保留现有 owner 边界、Zod 服务端校验、显式 SQLite 迁移、repository 层、备份身份校验和启动/停止进程身份校验。不要为“简化”删除这些已经验证的可靠性代码。

## 架构边界

- `app/`：Next.js App Router 页面和 route handlers。
- `content/`：版本控制内的共享课程契约、18 章 registry 和测试 fixture。
- `src/components/`：客户端交互与展示。
- `src/features/`：进度、回答、行动、Artifact、推荐的领域/repository 逻辑。
- `src/lib/db/`：SQLite 连接、迁移、备份与恢复安全边界。
- `data/harness.sqlite`：正式私人数据；`data/e2e.sqlite`：可重建的隔离 E2E 数据。
- `backups/`：已验证备份；`.runtime/`：启动器运行记录。

所有私有 repository 调用必须绑定稳定 owner `owner-local`。不要把标题、顺序或显示文字当唯一标识。不要引入第二个服务、CMS、ORM、认证框架或运行时模型调用，除非用户明确批准并提供新规格。

## Simple-first 与范围控制

对任何未来修改，先提出满足需求的最小方案；只改与请求直接相关的行，匹配现有风格，不顺手重构。任何功能扩展、依赖增加、数据模型扩张、网络能力或隐私边界变化都必须先获得用户明确批准。简单优先不等于删除可靠性保障：现有备份/恢复、路径 realpath、文件身份、进程身份、双环境 fixture guard 等安全代码必须保留。

## 数据与备份安全

- 永远不要在测试、迁移或调试中删除、覆盖、恢复到 `data/harness.sqlite`。
- E2E seed 仅可在 realpath 确认位于项目 `data/` 后删除精确的 `e2e.sqlite`、`e2e.sqlite-wal`、`e2e.sqlite-shm`。
- 不手动搬运 SQLite sidecar。内容发布/schema migration 前先停止网站，再运行 `npm.cmd run db:backup`。
- 恢复来源必须位于项目 `backups/`、通过验证且命令带 `--confirm`；网站运行时拒绝恢复。
- 真实恢复门禁只恢复到项目 `data/` 内新建的临时 `.sqlite` 目标，比较表计数后清理；不得把门禁恢复到正式 target。
- 保留现有 `data/harness.sqlite` 和已有手动备份。

## 章节内容工作流

逐章接收完整音频，检查完整性 → 内部转录 → 语义整理 → 标记缺失视觉上下文 → 提取结构 → 按 `content/schema.ts` 生成内容 → 对照源材料检查忠实度 → 用户明确审批 → 备份 → 发布 → 完整验证。不得猜测画面，不得把临时转录稿或源音频放进网站。审批发布后删除项目内临时转录稿，但绝不修改或删除用户源音频。已发布稳定 ID 必须保持不变。

## 精确验证命令

```powershell
npm.cmd run content:validate
npm.cmd test
npm.cmd run lint
npm.cmd run build
npm.cmd run test:e2e
```

预期：18 条章节记录有效；单元/集成测试零失败；lint 零错误；生产构建成功；E2E 完整增长流与无源媒体测试通过。E2E `workers: 1`，浏览器必须项目内安装和执行：

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH='0'
npx.cmd playwright install chromium
npm.cmd run test:e2e
```

不要全局安装包或浏览器。视觉变更还需在 1440×900 headless Chromium 检查 `/`、`/chapters`、测试 fixture 下的 `/chapters/chapter-01`、`/system`：console/page error、横向溢出、阅读列 ≤72ch、右侧摘要 sticky、键盘 focus、保存错误可读；截图保存在被忽略的 `artifacts/visual-check/`。

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
