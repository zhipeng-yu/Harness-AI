# 项目交接

## 当前状态

- 项目是 Windows 本机个人学习网站，只监听 `127.0.0.1`，固定所有者为 `owner-local`。
- 18 章目录均为 `awaiting_audio`，正式发布内容为 0 章。
- 核心学习闭环已经完成：课程阅读、个人回答、行动计划、Artifact、实践、复盘、版本迭代和下一步推荐。
- 正式数据库是 `data/harness.sqlite`；已有数据库和 `backups/` 内备份不得删除、覆盖或用于测试。
- 代码仓库是 <https://github.com/zhipeng-yu/Harness-AI>，完成任务后直接推送 `main`。

## 新窗口的唯一任务

处理用户在新窗口直接上传的**第一章完整音频附件**。如果新窗口里只有本机路径而没有可读取的附件，先请用户用输入框旁的附件按钮上传，不要假装已经读取文件。

执行顺序：

1. 确认附件可读取，检查格式、时长和是否明显缺段；不修改用户源音频。
2. 使用项目内现有的 faster-whisper 和 small 模型做本地临时转录：
   - Python 包：`.tools/faster-whisper/`
   - 模型缓存：`.tools/whisper-models/`
   - small 模型快照：`.tools/whisper-models/models--Systran--faster-whisper-small/snapshots/536b0662742c02347bc0e980a01041f333bce120/`
3. 临时音频处理文件和转录稿只放在被 Git 忽略的 `artifacts/transcripts/chapter-01/`，不得上传外部服务或提交 Git。
4. 修正断句、口语重复和明显识别错误；不凭空补充内容，不猜测仅画面中出现的信息。
5. 按 `content/schema.ts` 整理第一章的讲解、概念、场景、误区、反思问题、行动任务、Artifact 模板和复盘问题。
6. 对照音频检查忠实度，把整理稿和无法确认的内容交给用户审阅。**在用户明确批准前停在这里，不修改正式章节状态。**
7. 用户批准后，先停止网站并运行 `npm.cmd run db:backup`；再创建必要的 `content/chapters/chapter-01.ts`，更新 registry，并保持 chapter、prompt、field ID 稳定。
8. 运行验证：

   ```powershell
   npm.cmd run content:validate
   npm.cmd test
   npm.cmd run lint
   npm.cmd run build
   ```

9. 发布完成后删除项目内临时转录稿，不触碰用户源音频。

完整边界以 [AGENTS.md](AGENTS.md) 和 [内容工作流](docs/content-workflow.md) 为准。不要在处理第一章时扩展登录、多人、部署、运行时 AI、CMS 或其他产品功能。

## 建议在新窗口发送的话

> 请先读取项目根目录的 AGENTS.md 和 HANDOFF.md。我已经直接上传第一章完整音频。先检查附件完整性，使用项目内现有 faster-whisper 在本地转录，再按 content/schema.ts 整理成第一章学习内容。不要发布，也不要修改正式章节状态；先把整理结果和不确定项交给我审批。
