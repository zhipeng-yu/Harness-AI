# 超体 · 我的成长操作系统

一个只在本机 `127.0.0.1` 运行的个人学习网站。它把课程内容连接到个人回答、行动计划、Artifact、实践与复盘。私人记录只保存在项目内 SQLite，不调用外部 AI。

代码仓库：<https://github.com/zhipeng-yu/Harness-AI>

当前已有 18 章目录，前三章已经用户审批并发布：第一章《获取超体的脑机接口：获得 10 倍输出能力》、第二章《获取语言杠杆：掌握 Vibe Coding，放大调用智能的能力》、第三章《人和 AI 的不变：理解分工，练习意义压缩》。其余 15 章为 `awaiting_audio`。

第三章含 38 节详细讲解、约 1.5 万字正文与三幅方法示意图，结尾为连续三天替换一个小旧习惯的行动与复盘；音频依据和整理边界见 [第三章内容说明](docs/chapter-03-review.md)。

课程采用博客式分页阅读：先了解路线，再逐节阅读解释与例子，最后回顾概念、场景和误区并进入实践。第一章 30 页，第二章 28 页，第三章 51 页；三章共 65 节详细讲解，每节独立一页，正文完整显示，补充例子明确标注为说明性例子。页面保留浅灰画布与白色圆角面板，正文为主、灰度插画为辅，高度随内容展开，窄窗口自动变为单栏。支持目录跳转、按钮和方向键翻页，最后一页进入反思、行动与 Artifact 工作区；当前阅读页不持久化。

## 安装与使用

需要 Windows、PowerShell 和 Node.js 24+。所有依赖只安装在项目内：

```powershell
npm.cmd install
npm.cmd run db:migrate
```

日常双击 `scripts\Start-Harness.cmd` 启动，双击 `scripts\Stop-Harness.cmd` 停止。网站地址是 <http://127.0.0.1:3001>。启动器使用 Next.js 开发服务器，便于本机内容更新后直接生效。

同一项目只能运行一个开发服务器，换端口前也需先停止旧实例。启动进程退出时，可运行 `npm.cmd run dev` 查看具体错误。

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

每章流程：接收完整音频、内部转录、整理结构、标记无法从音频确认的画面、对照原材料检查、用户审批、备份、发布。临时转录稿和原音频不进入网站或 Git。详细规则见 [内容工作流](docs/content-workflow.md)。

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
