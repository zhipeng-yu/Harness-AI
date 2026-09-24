# 超体 · 我的成长操作系统

一个只在本机 `127.0.0.1` 运行的个人学习网站。它把课程内容连接到个人回答、行动计划、Artifact、实践与复盘。私人记录只保存在项目内 SQLite，不调用外部 AI。

代码仓库：<https://github.com/zhipeng-yu/Harness-AI>

当前已有 18 章目录，前 11 章已经用户审批并发布，其余 7 章为 `awaiting_audio`。第 5–11 章依次讨论 AI 原生软件、上下文管理、现实校准、契约体系、意图建模、现实碰撞与端到端回路；音频依据和整理边界见 [第 5–11 章内容说明](docs/chapter-05-11-review.md)。

第 3–11 章按各自音频的论证顺序重写为连续阅读稿：从问题进入，经原课案例与推演走向方法和行动。各章页数随内容自然变化，不设统一页数或字数；阅读正文保持讲课的语气，不插入编辑者的核验或免责提示。原音频依据与视觉缺口保存在各章内容说明中，不打断阅读。

课程采用分页阅读：每页讲清一个完整意思，正文完整显示，灰度方法示意为辅，高度随内容展开，窄窗口自动变为单栏。支持目录跳转、按钮和方向键翻页，最后一页进入反思、行动与 Artifact 工作区；当前阅读页不持久化。

Artifact 在章节页中称为“实践成果卡”：创建后立即显示四项正文，草稿可以继续编辑；开始实践时锁定当前版本，复盘与生成的下一版会留在同一页的版本历史中。

## 安装与使用

需要 Windows、PowerShell 和 Node.js 24+。所有依赖只安装在项目内：

```powershell
npm.cmd install
npm.cmd run db:migrate
```

日常双击 `scripts\Start-Harness.cmd` 启动，双击 `scripts\Stop-Harness.cmd` 停止。网站地址是 <http://127.0.0.1:3001>。启动器使用 Next.js 开发服务器，便于本机内容更新后直接生效。

重复点击启动会直接打开已有网站，并补回缺失的进程记录；停止时核对 PID 和启动时间，再结束整个 Next.js 进程树。若 3001 被其他程序占用，启动器会提示其 PID，需先关闭该程序。同一项目只能运行一个开发服务器。启动进程退出时，可运行 `npm.cmd run dev` 查看具体错误。

也可以在终端运行：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/Start-Harness.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/Stop-Harness.ps1
```

## 数据与备份

- 私人数据：`data/harness.sqlite`
- 备份：`backups/*.sqlite`
- 课程内容：`content/`
- 课程插画：`public/illustrations/`
- 临时运行记录：`.runtime/server.json`

发布课程或修改数据库结构前，先停止网站并备份：

```powershell
npm.cmd run db:backup
```

必要时从项目内备份恢复：

```powershell
npm.cmd run db:restore -- backups/harness-YYYYMMDD-HHMMSS.sqlite --confirm
```

恢复会验证 SQLite 完整性，并在覆盖现有目标前再做一次备份。不要手动移动 SQLite 的 `-wal`、`-shm` 文件。

## 课程制作

每章流程：接收完整音频、内部转录、梳理一条连续推演主线、用原课案例写成可沉浸阅读的页面、内部核对、用户审批、备份、发布。页数由内容决定；临时转录稿和原音频不进入网站或 Git。详细规则见 [内容工作流](docs/content-workflow.md)。

本机已有离线转写库 `.tools/faster-whisper/` 和模型 `.tools/whisper-models/`，优先复用；这些工具及 `artifacts/` 均被 Git 忽略，审阅页只在本机存在。

本机 `artifacts/share/Harness-AI课程第1-11章文本.zip` 是可对外阅读的文本包：第 1–11 章均为带准确性说明的离线自动转录稿；文件不进入 Git。

## 校园公益分享

本机 `artifacts/presentations/harness-ai-campus-sharing/` 保存一套基于第 1–11 章整理的 40 分钟线下分享材料：22 页 PPTX（前 20 页主讲、后 2 页附录）和一页 A4《AI 协作任务卡》的 DOCX、PDF。材料面向无 AI 基础的大四学生，使用四步协作回路与六字段任务卡；不包含原音频、逐字稿或私人数据，不作为课程官方课件。

## 开发验证

```powershell
npm.cmd run content:validate
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

项目不包含浏览器 E2E 测试。自动测试只覆盖内容契约、数据持久化和核心交互。

## 当前不做

登录、多用户共享、远程访问、部署、运行时 AI、CMS、文件上传、提醒、积分、排行和社区。未来若分享给不超过 20 人，再单独设计数据隔离；现在不提前实现。

每次完成任务后更新本文件和 `HANDOFF.md`，并将验证通过的改动直接推送到 `main`。
