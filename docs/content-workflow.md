# 内容制作工作流

1. 检查源音频，但不得修改用户的源音频。
2. 在工作区创建内部转录稿。
3. 整理转录稿中的口语与识别错误。
4. 标记缺失的视觉素材或无法确认的画面信息。
5. 提取章节结构。
6. 按固定章节内容契约填写内容。
7. 对照源材料检查内容保真度。
8. 请求内容所有者审批。
9. 发布获批章节并运行内容校验。
10. 审批后删除工作区转录稿，且不得触碰用户的源音频。

## 发布前数据保护门禁

发布任何内容变更或 schema migration 前，按顺序执行：

```powershell
npm.cmd run db:backup
npm.cmd run content:validate
npm.cmd run build
```

随后在本地逐页目视检查。编辑显示文字时必须保持已发布的 chapter ID、prompt ID 和 artifact ID 稳定，以确保已有回答和工件继续关联。

只有在网站已经停止、恢复来源位于项目 `backups/` 内且确认需要覆盖时，才运行：

```powershell
npm.cmd run db:restore -- backups/harness-20260813-120000.sqlite --confirm
```

恢复流程会在修改目标前验证来源，并在目标存在时先生成已验证的 `pre_restore` 备份。不要手动移动 SQLite 的 `-wal` 或 `-shm` sidecar 文件。
