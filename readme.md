## 超体 · 我的成长操作系统

这是一个仅在本机 `127.0.0.1` 运行的第一阶段个人成长操作系统骨架。

需要 Node.js 24.14+。在项目目录安装依赖后，运行：

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

构建完成后还需要在本机逐页目视检查。内容显示文字可以更新，但已发布的 chapter ID、prompt ID 和 artifact ID 必须保持稳定，否则已有私人回答将无法继续关联。

如需恢复，请先停止本地网站，再明确指定已验证的项目内备份并附上字面量 `--confirm`：

```powershell
npm.cmd run db:restore -- backups/harness-20260813-120000.sqlite --confirm
```

恢复会先验证来源；若当前数据库存在，还会先创建 `pre_restore` 安全备份。缺少 `--confirm` 或网站仍在运行时不会更改数据库。
