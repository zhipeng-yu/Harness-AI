# 超体 · 我的成长操作系统

Windows 本机个人学习网站，地址为 <http://127.0.0.1:3001>，固定所有者 `owner-local`。课程连接个人回答、行动计划、实践成果卡、实践和复盘。私人记录保存在项目内 SQLite，网站运行时不调用外部 AI。

18章目录中第1—11章已发布，其余7章为 `awaiting_audio`。第1—11章已沿完整原材料逐章删减整理，保留案例、推理和练习要求。制作方法统一维护在 [内容工作流](docs/content-workflow.md)，各章材料对应与疑点见 `docs/chapter-*-review.md`。

阅读页按内容自然分页，支持目录、按钮和方向键翻页，末页显示本章练习并进入实践区。正文完整显示，窄窗口单栏，当前页码不持久化。

实践成果卡分两次填写。实践前记录目标、执行计划与成功标准，开始后锁定计划，结束后填写结果、收获与调整。下一版沿用计划和调整说明，旧行动设计、补充内容与版本历史保留。

## 安装与启停

需要 Windows、PowerShell 和 Node.js 24+，依赖安装在项目内。

```powershell
npm.cmd install
npm.cmd run db:migrate
```

双击 `scripts\Start-Harness.cmd` 启动，双击 `scripts\Stop-Harness.cmd` 停止。启动器使用开发服务器，内容修改可直接生效。重复启动复用本项目实例，停止时核对 PID 和启动时间。端口被其他程序占用时会提示其 PID，同一项目只运行一个服务器。

也可以运行对应 PowerShell 脚本。

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/Start-Harness.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/Stop-Harness.ps1
```

启动退出时可用 `npm.cmd run dev` 查看错误。

## 数据与备份

私人数据在 `data/harness.sqlite`，备份在 `backups/`，正式课程在 `content/`，插画在 `public/illustrations/`，运行记录在 `.runtime/`。

发布课程或修改数据库结构前停止网站并备份。

```powershell
npm.cmd run db:backup
```

恢复仅使用项目内已验证的备份，显式提供确认参数。

```powershell
npm.cmd run db:restore -- backups/harness-YYYYMMDD-HHMMSS.sqlite --confirm
```

恢复会验证完整性并先备份当前目标。数据库、已有备份及 SQLite 附属文件的保护规则见 [AGENTS.md](AGENTS.md)。路由、页面与构建验证前先将 `HARNESS_DB_PATH` 绑定项目内临时数据库。

## 本机课程材料

第1—11章现成转录位于 `artifacts/share/Harness-AI课程第1-11章文本.zip`。离线工具和模型位于 `.tools/faster-whisper/`、`.tools/whisper-models/`。音频、转录、数据库、备份与运行文件均排除 Git。

`artifacts/presentations/harness-ai-campus-sharing/` 保存已有40分钟校园分享材料，包括22页 PPTX 和 A4《AI 协作任务卡》的 DOCX、PDF，面向无 AI 基础的大四学生。

## 开发验证

```powershell
npm.cmd run content:validate
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

自动检查覆盖内容契约、持久化和核心交互，实际阅读页另做浏览器检查。完成任务后同步本文件与 [HANDOFF.md](HANDOFF.md)，验证通过后直接提交并推送远端 `main`。仓库为 <https://github.com/zhipeng-yu/Harness-AI>。
