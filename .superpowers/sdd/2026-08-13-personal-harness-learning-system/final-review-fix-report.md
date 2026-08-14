# Final review fix round 1

日期：2026-08-14
范围：只修最终审查的 I1–I4；未处理 Minor/spec gaps，未引入新服务、依赖、数据库 schema 或公网能力。

## I1 课程契约消费

- RED：focused 3 个测试文件中 5 个预期失败，证明 schema 接受额外 review prompts / Artifact fields，workspace 未渲染 concepts/scenarios/misconceptions，固定表单未消费课程 prompt/field ID 与 label。
- GREEN：published schema 收窄为恰好 3 条 review prompts、4 个 Artifact 字段；workspace 渲染全部解释区块；action prompt 作为 action 字段说明；Artifact/review 固定存储顺序继续映射原有 4/3 个字段，并使用稳定课程 ID/label。
- 证据：`npm.cmd test -- tests/unit/content-schema.test.ts tests/unit/chapter-workspace.test.tsx tests/unit/action-artifact-forms.test.tsx` → 3 files / 20 tests passed。

## I2 data/backups 信任根

- RED：fresh project 缺 `backups/` 时 backup 因 realpath ENOENT；restore 前同样失败；E2E seed 缺 `data/` 时 lstat ENOENT。
- GREEN：project root 先 canonicalize；`data/`、`backups/` 只允许 project root 的 direct non-reparse directory，缺失时创建后 fresh lstat/realpath；backup、restore、E2E seed 保留原有逐操作 realpath/identity/rollback 门禁。
- 证据：fresh backup、fresh restore、fresh E2E data、direct data/backups junction 均有真实临时项目行为测试；focused backup/seed 为 2 files / 46 tests passed，fresh-only 为 3 passed。
- 安全：测试项目只位于项目 `artifacts/`；未恢复、删除或覆盖 `data/harness.sqlite`，未删除已有备份。

## I3 Start `.runtime`

- RED：端口空闲后真实重跑确认 `.runtime` junction 和预占 `server.json.tmp` 均错误 exit 0；same-length/same-timestamp 交换文件会在失败清理中被误删。
- GREEN：Start 在写入前拒绝 direct runtime reparse；temp 使用 exclusive CreateNew；rename 前 fresh 复验 runtime、target absence、temp metadata/content identity；失败清理仅删除仍匹配 owned identity 的记录，交换文件保留。
- 证据：完整 `tests/unit/launch-script.test.ts` 在第一轮为 21/21，新增 same-metadata RED→GREEN 后纳入全量 22 条 launcher 行为。

## I4 stale runtime

- RED：合法 JSON/PID/startTime 指向明确不存在 PID 时 Stop exit 1 且保留 record。
- GREEN：完成路径、JSON、PID、startTime 和 record identity 校验后，只对 `NoProcessFoundForGivenId` 或已退出的同一进程清理陈旧记录并 exit 0；PID/startTime mismatch、corrupt、unreadable、reparse 仍 fail closed。
- 证据：focused launcher pattern 4 passed；完整 Vitest 包含 dead PID 与既有 mismatch/corrupt/unreadable/reparse 测试。

## 最终验证

- `npm.cmd run content:validate` → 18 chapters, 0 published。
- `npm.cmd test` → 18 files / 185 tests passed。
- `npm.cmd run lint` → exit 0。
- `npm.cmd run build` → Next.js 16.3.0 编译、TypeScript、7/7 static pages 成功。
- `$env:PLAYWRIGHT_BROWSERS_PATH='0'; npm.cmd run test:e2e` → 5/5 passed，24.2s。
- `git diff --check` → exit 0。
- E2E/launcher 串行运行；最终检查确认 `.runtime`、launcher/fresh/seed/task 测试临时目录与 3000 LISTEN 均无残留。正式 `data/harness.sqlite` 仍为 90112 bytes、时间戳 2026-08-14 09:38:13；两份既有备份的大小与时间戳仍与 Task11 记录一致。

## Controller verification follow-up

- Controller 全量验证中，真实 PowerShell 的 Start runtime-junction 用例在 5844ms 被 Vitest 默认 5000ms timeout 中止；没有 assertion failure。
- 未修改 timeout 前连续三次单独运行均通过：测试体分别为 3.45s、3.39s、3.65s，总命令分别为 5.73s、5.67s、6.00s。每次后 3000 无 LISTEN，`.runtime` 与 `.tools/launcher-tests` 均无残留。
- 根因是该用例串行启动两个真实 PowerShell 进程（创建 junction、执行 Start），在控制器负载下超过默认 5 秒，不是子进程或清理泄漏。只给该用例设置 15 秒 timeout，与同文件其他真实 CLI 测试的 per-test timeout 做法一致；未改全局 timeout。
