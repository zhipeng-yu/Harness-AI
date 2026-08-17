# 项目交接

## 当前状态

- 项目是 Windows 本机个人学习网站，只监听 `127.0.0.1`，固定所有者为 `owner-local`。
- 18 章目录均为 `awaiting_audio`，正式发布内容为 0 章。
- 第一章音频完整性检查、本地转录和 schema 对齐草稿已完成；用户确认中段静音是录制暂停，目前等待内容审批。
- 私密临时材料位于 Git 忽略的 `artifacts/transcripts/chapter-01/`，不得提交或发送到外部服务。
- 核心学习闭环已经完成：课程阅读、个人回答、行动计划、Artifact、实践、复盘、版本迭代和下一步推荐。
- 正式数据库是 `data/harness.sqlite`；已有数据库和 `backups/` 内备份不得删除、覆盖或用于测试。
- 代码仓库是 <https://github.com/zhipeng-yu/Harness-AI>，完成任务后直接推送 `main`。

## 下一步

1. 让用户审阅 `artifacts/transcripts/chapter-01/approval-notes.md` 和 `chapter-01.schema-draft.json`，确认品牌拼写、量化口径、神经科学表述、行动任务和 Artifact 字段。
2. **用户明确批准前停在这里**，不要创建正式章节，不要修改 registry 或数据库状态。
3. 用户批准后，先停止网站并运行 `npm.cmd run db:backup`；再创建 `content/chapters/chapter-01.ts`、更新 registry，并保持草稿中的 chapter、prompt、field ID 稳定。
4. 运行验证：

   ```powershell
   npm.cmd run content:validate
   npm.cmd test
   npm.cmd run lint
   npm.cmd run build
   ```

5. 发布完成后删除项目内临时转录稿，不触碰用户源音频。

完整边界以 [AGENTS.md](AGENTS.md) 和 [内容工作流](docs/content-workflow.md) 为准。不要在处理第一章时扩展登录、多人、部署、运行时 AI、CMS 或其他产品功能。
