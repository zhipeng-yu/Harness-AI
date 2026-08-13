# 超体 · 我的成长操作系统

这是一个只在本机 `127.0.0.1` 运行的个人成长操作系统。需要 Node.js 24.14 或更高版本，所有依赖和数据都保留在项目目录内。

## 本地启动与停止

首次使用时，在项目目录安装依赖：

```powershell
npm.cmd install
```

之后可以双击 `scripts\Start-Harness.cmd` 启动。启动器会先确认 Node 版本、依赖和本机端口安全；若已有数据库，会先创建并验证备份，然后依次迁移数据库、校验课程内容、构建并以 `127.0.0.1:3000` 启动网站。它不会安装软件、更改 PowerShell 全局策略或修改防火墙。

双击 `scripts\Stop-Harness.cmd` 停止。停止器只有在 `.runtime\server.json` 位于项目内，且其中的 PID 与进程启动时间同时匹配时才会停止进程；确认进程停止后才删除运行记录。

也可以在项目目录手动运行：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/Start-Harness.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/Stop-Harness.ps1
```

开发模式仍可使用：

```powershell
npm.cmd run dev
```

## 内容更新与私有数据保护

发布内容变更或执行 schema migration 之前，先创建并验证数据库备份：

```powershell
npm.cmd run db:backup
npm.cmd run content:validate
npm.cmd run build
```

内容显示文字可以更新，但已发布的 chapter ID、prompt ID 和 artifact ID 必须保持稳定，否则已有私人回答将无法继续关联。

如需恢复，请先停止本地网站，再明确指定已验证的项目内备份并附上字面量 `--confirm`：

```powershell
npm.cmd run db:restore -- backups/harness-20260813-120000.sqlite --confirm
```

恢复会先验证来源；若当前数据库存在，还会先创建 `pre_restore` 安全备份。缺少 `--confirm` 或网站仍在运行时不会更改数据库。
