# 项目交接

## 当前状态

- 本机单用户网站，固定所有者 `owner-local`，只监听 `127.0.0.1`。
- 18 章目录均为 `awaiting_audio`，正式发布内容为 0 章。
- 已实现：章节地图、学习工作台、自动保存回答、行动计划、结构化 Artifact、复盘、不可覆盖版本、下一步推荐和“我的系统”。
- 私人数据位于 `data/harness.sqlite`；已有正式数据库和备份必须保留。

## 技术边界

- Next.js 16、React 19、TypeScript、原生 `node:sqlite`，单进程。
- 页面/API 在 `app/`，交互在 `src/components/`，领域与 repository 在 `src/features/`，课程契约在 `content/`。
- 合成已发布章节位于 `content/fixtures/published-chapter.ts`，只供测试，不能当正式课程发布。
- 没有登录、多人、远程访问、运行时 AI、CMS、上传或浏览器 E2E。

## 常用命令

```powershell
npm.cmd install
npm.cmd run db:migrate
npm.cmd run db:backup
npm.cmd run content:validate
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

启动和停止：`scripts/Start-Harness.cmd`、`scripts/Stop-Harness.cmd`。

恢复命令：

```powershell
npm.cmd run db:restore -- backups/harness-YYYYMMDD-HHMMSS.sqlite --confirm
```

## 下一步

唯一内容优先级是处理完整第一章音频，按 [内容工作流](docs/content-workflow.md) 整理并在用户批准后发布。不要在第一章发布前扩展产品范围。
