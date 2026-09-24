# AGENTS.md

## 项目范围

这是 Windows 本机个人学习网站，目前只有固定所有者 `owner-local`。核心流程是：阅读课程、联系自身、制定行动、创建文字 Artifact、实践、复盘、生成下一版本。18 章正式目录中前 11 章已发布，其余 7 章为 `awaiting_audio`。

## 必须遵守

- 只监听 `127.0.0.1`；不要增加公网、局域网、部署、注册、登录或邀请。
- 私人数据只保存在 `data/harness.sqlite`。数据库、备份、音频和转录稿不得提交 Git 或发送到外部服务。
- 网站运行时不调用 AI，不展示或提供原音频、逐字稿。
- 所有私人 repository 调用使用 `owner-local`；不要用标题或显示文字代替稳定 ID。
- 不要在测试或调试中修改、删除、恢复 `data/harness.sqlite` 及已有备份。
- 路由与页面测试必须先绑定临时数据库，不依赖“未发布章节会提前返回”来隔离真实数据。
- 不引入第二个服务、CMS、ORM、认证框架或新依赖，除非用户明确批准。

## 简单优先

只实现已提出的需求。优先平台能力和现有代码，不为假设的多人、并发、恶意本机操作者或未来扩展增加抽象与防御。保留服务端输入校验、SQLite 迁移、备份完整性检查、恢复前备份以及启动器的 PID/启动时间核对，因为它们直接保护私人数据或避免停止错误进程。

## 完成任务

- 每次任务完成后，同步更新 `readme.md` 和 `HANDOFF.md`，只记录当前仍有效的使用说明、状态和下一步。
- 三份文档必须简短高效；不写过程日志、重复背景、测试流水账或过期计划，避免污染后续窗口上下文。
- 验证通过后提交，并直接推送到远端 `main`；除非用户另有要求，不建功能分支或 PR。
- 推送前确认数据库、备份、音频、转录稿和运行文件未进入 Git。

## 内容工作流

完整音频 → 内部转录 → 语义整理 → 标记缺失视觉信息 → 按 `content/schema.ts` 生成章节 → 对照音频检查 → 用户明确审批 → 备份 → 发布。不要猜画面；发布后删除项目内临时转录稿，不修改用户源音频；已发布 ID 保持不变。

课程阅读页要让人沉浸地学会内容：每章先确定一个从问题、推理、原课案例到行动的连续主线，再按讲清一个完整意思的需要分页，不设统一页数或字数。正文沿讲者口吻展开，只使用音频已有案例；不要在阅读页插入编辑者的核验、免责、来源或“说明性例子”提示，也不要用“误区纠正”反复打断论证。对音频、数字和视觉缺口的内部核对放在审阅文档，必要时直接略去无法支撑的细节。发布前通读相邻页面，检查前后因果与过渡，不能把提纲扩写成互不相连的卡片。

`content/fixtures/published-chapter.ts` 仅供自动测试使用，绝不是正式课程内容。

## 验证

```powershell
npm.cmd run content:validate
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

没有 E2E 浏览器测试。只维护能直接覆盖内容契约、数据持久化和核心交互的单元/集成测试。

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
