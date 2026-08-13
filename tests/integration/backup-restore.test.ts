import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { basename, extname, join, relative, resolve, sep } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it, vi } from "vitest";
import { artifactRepository } from "@/src/features/artifacts/repository";
import { responseRepository } from "@/src/features/responses/repository";
import {
  createVerifiedBackup,
  restoreBackup,
  verifyBackup,
} from "@/src/lib/db/backup";
import { backupFileOps } from "@/src/lib/db/backup-file-ops";
import { openDatabase } from "@/src/lib/db/connection";
import { migrate } from "@/src/lib/db/migrate";

const projectRoot = resolve(process.cwd());
const dataRoot = join(projectRoot, "data");
const backupRoot = join(projectRoot, "backups");
const cleanupPaths: string[] = [];
const databases: DatabaseSync[] = [];

function makeProjectTemp(root: string, prefix: string) {
  mkdirSync(root, { recursive: true });
  const path = mkdtempSync(join(root, prefix));
  cleanupPaths.push(path);
  return path;
}

function assertCleanupBoundary(path: string) {
  const absolute = resolve(path);
  const inData = relative(dataRoot, absolute);
  const inBackups = relative(backupRoot, absolute);
  const isChild = (candidate: string) =>
    candidate !== "" && candidate !== ".." && !candidate.startsWith(`..${sep}`);
  if (!isChild(inData) && !isChild(inBackups)) {
    throw new Error(`Refusing test cleanup outside project data/backups: ${absolute}`);
  }
}

function trackDatabase(path: string) {
  const db = openDatabase(path);
  databases.push(db);
  return db;
}

function closeDatabase(db: DatabaseSync) {
  db.close();
  databases.splice(databases.indexOf(db), 1);
}

function seedDatabase(path: string, response = "必须精确保留的回答") {
  const db = trackDatabase(path);
  migrate(db);
  responseRepository(db).upsert({
    ownerId: "owner-local",
    chapterId: "chapter-01",
    promptId: "chapter-01-reflection-01",
    value: response,
  });
  const artifact = artifactRepository(db).createWithVersion({
    ownerId: "owner-local",
    chapterId: "chapter-01",
    title: "恢复验证工件",
    problem: "原始问题",
    principles: "原始原则",
    rules: "原始规则",
    successCriteria: "原始成功标准",
  });
  return { db, artifactId: artifact.id };
}

afterEach(() => {
  vi.restoreAllMocks();
  while (databases.length > 0) databases.pop()?.close();
  while (cleanupPaths.length > 0) {
    const path = cleanupPaths.pop()!;
    assertCleanupBoundary(path);
    rmSync(path, { recursive: true, force: true });
  }
});

describe("verified SQLite backups", () => {
  it("backs up online data and restores the exact response and Artifact version", async () => {
    const dataDir = makeProjectTemp(dataRoot, "task9-data-");
    const backupDir = makeProjectTemp(backupRoot, "task9-backups-");
    const sourcePath = join(dataDir, "harness.sqlite");
    const restoredPath = join(dataDir, "restored.sqlite");
    const { db, artifactId } = seedDatabase(sourcePath);

    const result = await createVerifiedBackup(sourcePath, backupDir);
    closeDatabase(db);
    assertCleanupBoundary(sourcePath);
    rmSync(sourcePath);
    await restoreBackup({ source: result.path, target: restoredPath, confirm: true });

    const restored = trackDatabase(restoredPath);
    expect(
      responseRepository(restored).get(
        "owner-local",
        "chapter-01",
        "chapter-01-reflection-01",
      )?.value,
    ).toBe("必须精确保留的回答");
    expect(artifactRepository(restored).getByChapter("owner-local", "chapter-01"))
      .toMatchObject({
        id: artifactId,
        currentVersion: 1,
        versions: [{ version: 1, problem: "原始问题" }],
      });
    expect(result).toMatchObject({ integrity: "ok", ownerCount: 1 });
    expect(result.migrationCount).toBeGreaterThanOrEqual(1);
  });

  it("does not migrate the source before capturing it", async () => {
    const dataDir = makeProjectTemp(dataRoot, "task9-data-");
    const backupDir = makeProjectTemp(backupRoot, "task9-backups-");
    const sourcePath = join(dataDir, "legacy.sqlite");
    const db = new DatabaseSync(sourcePath);
    db.exec("CREATE TABLE legacy_only (value TEXT) STRICT; INSERT INTO legacy_only VALUES ('kept')");
    db.close();

    await expect(createVerifiedBackup(sourcePath, backupDir)).rejects.toThrow();

    const reopened = new DatabaseSync(sourcePath, { readOnly: true });
    expect(
      reopened.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all(),
    ).toEqual([{ name: "legacy_only" }]);
    reopened.close();
  });

  it("opens verification read-only and rejects corrupt or unowned databases", () => {
    const backupDir = makeProjectTemp(backupRoot, "task9-backups-");
    const corrupt = join(backupDir, "corrupt.sqlite");
    writeFileSync(corrupt, "not sqlite");
    expect(() => verifyBackup(corrupt)).toThrow();

    const missingOwner = join(backupDir, "missing-owner.sqlite");
    const db = new DatabaseSync(missingOwner);
    db.exec(
      "CREATE TABLE owners (id TEXT PRIMARY KEY) STRICT; CREATE TABLE schema_migrations (id TEXT PRIMARY KEY) STRICT; INSERT INTO schema_migrations VALUES ('001_initial.sql')",
    );
    db.close();
    const before = readFileSync(missingOwner);
    expect(() => verifyBackup(missingOwner)).toThrow(/owner-local/i);
    expect(readFileSync(missingOwner)).toEqual(before);
    expect(existsSync(`${missingOwner}-wal`)).toBe(false);
    expect(existsSync(`${missingOwner}-shm`)).toBe(false);
  });

  it("does not change a valid backup while verifying it", async () => {
    const dataDir = makeProjectTemp(dataRoot, "task9-data-");
    const backupDir = makeProjectTemp(backupRoot, "task9-backups-");
    const sourcePath = join(dataDir, "harness.sqlite");
    const { db } = seedDatabase(sourcePath);
    const backup = await createVerifiedBackup(sourcePath, backupDir);
    const before = readFileSync(backup.path);

    expect(verifyBackup(backup.path)).toEqual({
      integrity: "ok",
      ownerCount: 1,
      migrationCount: 1,
    });

    expect(readFileSync(backup.path)).toEqual(before);
    expect(existsSync(`${backup.path}-wal`)).toBe(false);
    expect(existsSync(`${backup.path}-shm`)).toBe(false);
    closeDatabase(db);
  });

  it("rejects a database without an applied migration", () => {
    const backupDir = makeProjectTemp(backupRoot, "task9-backups-");
    const path = join(backupDir, "missing-migration.sqlite");
    const db = new DatabaseSync(path);
    db.exec(
      "CREATE TABLE owners (id TEXT PRIMARY KEY) STRICT; INSERT INTO owners VALUES ('owner-local'); CREATE TABLE schema_migrations (id TEXT PRIMARY KEY) STRICT",
    );
    db.close();
    expect(() => verifyBackup(path)).toThrow(/migration/i);
  });

  it("uses collision-safe timestamp filenames without overwriting", async () => {
    const dataDir = makeProjectTemp(dataRoot, "task9-data-");
    const backupDir = makeProjectTemp(backupRoot, "task9-backups-");
    const sourcePath = join(dataDir, "harness.sqlite");
    const { db } = seedDatabase(sourcePath);

    const first = await createVerifiedBackup(sourcePath, backupDir);
    const firstBytes = readFileSync(first.path);
    const second = await createVerifiedBackup(sourcePath, backupDir);

    expect(second.path).not.toBe(first.path);
    expect(basename(first.path)).toMatch(/^harness-\d{8}-\d{6}\.sqlite$/);
    expect(basename(second.path)).toMatch(/^harness-\d{8}-\d{6}\.sqlite$/);
    expect(readFileSync(first.path)).toEqual(firstBytes);
    closeDatabase(db);
  });

  it("keeps manual and pre_restore backups while pruning only verified automatic backups beyond ten", async () => {
    const dataDir = makeProjectTemp(dataRoot, "task9-data-");
    const backupDir = makeProjectTemp(backupRoot, "task9-backups-");
    const sourcePath = join(dataDir, "harness.sqlite");
    const { db } = seedDatabase(sourcePath);
    const manual = await createVerifiedBackup(sourcePath, backupDir, "manual");
    const preRestore = await createVerifiedBackup(sourcePath, backupDir, "pre_restore");
    const automatic: string[] = [];
    for (let index = 0; index < 12; index += 1) {
      automatic.push((await createVerifiedBackup(sourcePath, backupDir, "automatic")).path);
    }

    expect(existsSync(manual.path)).toBe(true);
    expect(existsSync(preRestore.path)).toBe(true);
    expect(automatic.filter(existsSync)).toEqual(automatic.slice(-10));
    const records = db
      .prepare("SELECT path, kind FROM backup_records ORDER BY created_at, path")
      .all() as { path: string; kind: string }[];
    expect(records.filter((row) => row.kind === "manual")).toHaveLength(1);
    expect(records.filter((row) => row.kind === "pre_restore")).toHaveLength(1);
    expect(records.filter((row) => row.kind === "automatic")).toHaveLength(10);
    closeDatabase(db);
  });

  it("never removes an unverified file during automatic rotation", async () => {
    const dataDir = makeProjectTemp(dataRoot, "task9-data-");
    const backupDir = makeProjectTemp(backupRoot, "task9-backups-");
    const sourcePath = join(dataDir, "harness.sqlite");
    const unverified = join(backupDir, "harness-20000101-000000.sqlite");
    writeFileSync(unverified, "do not delete");
    const { db } = seedDatabase(sourcePath);
    for (let index = 0; index < 11; index += 1) {
      await createVerifiedBackup(sourcePath, backupDir, "automatic");
    }

    expect(readFileSync(unverified, "utf8")).toBe("do not delete");
    closeDatabase(db);
  });

  it("rotates verified automatic backups independently per backup directory", async () => {
    const dataDir = makeProjectTemp(dataRoot, "task9-data-");
    const firstBackupDir = makeProjectTemp(backupRoot, "task9-backups-");
    const secondBackupDir = makeProjectTemp(backupRoot, "task9-backups-");
    const sourcePath = join(dataDir, "harness.sqlite");
    const { db } = seedDatabase(sourcePath);
    const firstDirectoryBackups: string[] = [];
    for (let index = 0; index < 10; index += 1) {
      firstDirectoryBackups.push(
        (await createVerifiedBackup(sourcePath, firstBackupDir, "automatic")).path,
      );
    }
    expect(firstDirectoryBackups.filter(existsSync)).toHaveLength(10);

    for (let index = 0; index < 10; index += 1) {
      await createVerifiedBackup(sourcePath, secondBackupDir, "automatic");
    }
    firstDirectoryBackups.push(
      (await createVerifiedBackup(sourcePath, firstBackupDir, "automatic")).path,
    );

    expect(firstDirectoryBackups.filter(existsSync)).toHaveLength(10);
    expect(dbBackupFiles(secondBackupDir)).toHaveLength(10);
    closeDatabase(db);
  });
});

describe("guarded restore", () => {
  it("makes a verified pre_restore backup before replacing an existing target", async () => {
    const dataDir = makeProjectTemp(dataRoot, "task9-data-");
    const backupDir = makeProjectTemp(backupRoot, "task9-backups-");
    const target = join(dataDir, "harness.sqlite");
    const sourceDbPath = join(dataDir, "replacement.sqlite");
    const oldTarget = seedDatabase(target, "old target answer");
    closeDatabase(oldTarget.db);
    const replacement = seedDatabase(sourceDbPath, "new source answer");
    const source = (await createVerifiedBackup(sourceDbPath, backupDir)).path;
    closeDatabase(replacement.db);

    await restoreBackup({ source, target, confirm: true });

    const restored = trackDatabase(target);
    expect(
      responseRepository(restored).get(
        "owner-local",
        "chapter-01",
        "chapter-01-reflection-01",
      )?.value,
    ).toBe("new source answer");
    const preRestoreRecord = restored
      .prepare("SELECT path FROM backup_records WHERE kind = 'pre_restore'")
      .get() as { path: string } | undefined;
    expect(preRestoreRecord).toBeUndefined();
    const backupNames = new Set([source]);
    const preRestorePaths = dbBackupFiles(backupDir).filter(
      (path) => !backupNames.has(path),
    );
    expect(preRestorePaths).toHaveLength(1);
    const preRestore = trackDatabase(preRestorePaths[0]!);
    expect(
      responseRepository(preRestore).get(
        "owner-local",
        "chapter-01",
        "chapter-01-reflection-01",
      )?.value,
    ).toBe("old target answer");
  });

  it("verifies the source before making any changes", async () => {
    const dataDir = makeProjectTemp(dataRoot, "task9-data-");
    const backupDir = makeProjectTemp(backupRoot, "task9-backups-");
    const target = join(dataDir, "harness.sqlite");
    const source = join(backupDir, "invalid.sqlite");
    writeFileSync(target, "original target");
    writeFileSync(source, "invalid source");
    const before = readFileSync(target);

    await expect(restoreBackup({ source, target, confirm: true })).rejects.toThrow();

    expect(readFileSync(target)).toEqual(before);
    expect(existsSync(join(dataDir, "harness.pre-restore.sqlite"))).toBe(false);
  });

  it("refuses source and target paths outside project backup/data boundaries", async () => {
    const dataDir = makeProjectTemp(dataRoot, "task9-data-");
    const backupDir = makeProjectTemp(backupRoot, "task9-backups-");
    const target = join(dataDir, "harness.sqlite");
    const outside = join(projectRoot, "outside.sqlite");
    const source = join(backupDir, "source.sqlite");

    await expect(restoreBackup({ source: outside, target, confirm: true })).rejects.toThrow(/backups/i);
    await expect(restoreBackup({ source, target: outside, confirm: true })).rejects.toThrow(/data/i);
    expect(existsSync(outside)).toBe(false);
  });

  it("rejects the same source and target path", async () => {
    const dataDir = makeProjectTemp(dataRoot, "task9-data-");
    const path = join(dataDir, "harness.sqlite");
    await expect(restoreBackup({ source: path, target: path, confirm: true })).rejects.toThrow(/same/i);
  });

  it("refuses to replace a target with SQLite sidecars", async () => {
    const dataDir = makeProjectTemp(dataRoot, "task9-data-");
    const backupDir = makeProjectTemp(backupRoot, "task9-backups-");
    const target = join(dataDir, "harness.sqlite");
    const seededTarget = seedDatabase(target);
    closeDatabase(seededTarget.db);
    const sourceDbPath = join(dataDir, "source.sqlite");
    const seededSource = seedDatabase(sourceDbPath);
    const source = (await createVerifiedBackup(sourceDbPath, backupDir)).path;
    closeDatabase(seededSource.db);
    writeFileSync(`${target}-wal`, "stale");

    await expect(restoreBackup({ source, target, confirm: true })).rejects.toThrow(/sidecar/i);
    expect(existsSync(target)).toBe(true);
  });

  it("rolls the original target back when installing the temporary file cannot be renamed", async () => {
    const dataDir = makeProjectTemp(dataRoot, "task9-data-");
    const backupDir = makeProjectTemp(backupRoot, "task9-backups-");
    const target = join(dataDir, "harness.sqlite");
    const sourceDbPath = join(dataDir, "replacement.sqlite");
    const oldTarget = seedDatabase(target, "old target answer");
    closeDatabase(oldTarget.db);
    const replacement = seedDatabase(sourceDbPath, "new source answer");
    const source = (await createVerifiedBackup(sourceDbPath, backupDir)).path;
    closeDatabase(replacement.db);
    let renameNumber = 0;
    vi.spyOn(backupFileOps, "rename").mockImplementation((from, to) => {
      renameNumber += 1;
      if (renameNumber === 2) throw new Error("injected Windows rename failure");
      renameSync(from, to);
    });

    await expect(restoreBackup({ source, target, confirm: true })).rejects.toThrow(
      "injected Windows rename failure",
    );

    expect(readResponse(target)).toBe("old target answer");
    expect(existsSync(join(dataDir, "harness.pre-restore.sqlite"))).toBe(false);
  });

  it("rolls the original target back when installed-backup verification fails", async () => {
    const dataDir = makeProjectTemp(dataRoot, "task9-data-");
    const backupDir = makeProjectTemp(backupRoot, "task9-backups-");
    const target = join(dataDir, "harness.sqlite");
    const sourceDbPath = join(dataDir, "replacement.sqlite");
    const oldTarget = seedDatabase(target, "old target answer");
    closeDatabase(oldTarget.db);
    const replacement = seedDatabase(sourceDbPath, "new source answer");
    const source = (await createVerifiedBackup(sourceDbPath, backupDir)).path;
    closeDatabase(replacement.db);
    vi.spyOn(backupFileOps, "rename").mockImplementation((from, to) => {
      renameSync(from, to);
      if (basename(from).startsWith(`.${basename(target)}.restore-`)) {
        writeFileSync(to, "corrupted after install");
      }
    });

    await expect(restoreBackup({ source, target, confirm: true })).rejects.toThrow();

    expect(readResponse(target)).toBe("old target answer");
    expect(existsSync(join(dataDir, "harness.pre-restore.sqlite"))).toBe(false);
  });

  it("CLI without --confirm exits nonzero without changing files", () => {
    const isolatedRoot = makeProjectTemp(dataRoot, "task9-cli-");
    const isolatedData = join(isolatedRoot, "data");
    const isolatedBackups = join(isolatedRoot, "backups");
    mkdirSync(isolatedData);
    mkdirSync(isolatedBackups);
    const target = join(isolatedData, "harness.sqlite");
    const source = join(isolatedBackups, "source.sqlite");
    const targetDb = seedDatabase(target, "unchanged target");
    closeDatabase(targetDb.db);
    const sourceDb = seedDatabase(source, "unused source");
    closeDatabase(sourceDb.db);
    const before = readFileSync(target);

    const result = runRestoreCli(isolatedRoot, [source]);

    expect(result.status).toBe(2);
    expect(readFileSync(target)).toEqual(before);
    expect(dbBackupFiles(isolatedBackups)).toEqual([source]);
  });

  it("refuses restore while server.json identifies a live process", () => {
    const isolatedRoot = makeProjectTemp(dataRoot, "task9-cli-");
    const isolatedData = join(isolatedRoot, "data");
    const isolatedBackups = join(isolatedRoot, "backups");
    const runtime = join(isolatedRoot, ".runtime");
    mkdirSync(isolatedData);
    mkdirSync(isolatedBackups);
    mkdirSync(runtime);
    const target = join(isolatedData, "harness.sqlite");
    const source = join(isolatedBackups, "source.sqlite");
    const targetDb = seedDatabase(target, "unchanged target");
    closeDatabase(targetDb.db);
    const sourceDb = seedDatabase(source, "unused source");
    closeDatabase(sourceDb.db);
    writeFileSync(join(runtime, "server.json"), JSON.stringify({ pid: process.pid }));
    const before = readFileSync(target);

    const result = runRestoreCli(isolatedRoot, [source, "--confirm"]);

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/website process is running/i);
    expect(readFileSync(target)).toEqual(before);
    expect(dbBackupFiles(isolatedBackups)).toEqual([source]);
  });
});

function dbBackupFiles(directory: string) {
  return existsSync(directory)
    ? readdirSync(directory)
        .map((name) => join(directory, name))
        .filter((path) => extname(path) === ".sqlite")
        .sort()
    : [];
}

function readResponse(path: string) {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    return (
      db
        .prepare(
          "SELECT value FROM responses WHERE owner_id = 'owner-local' AND chapter_id = 'chapter-01' AND prompt_id = 'chapter-01-reflection-01'",
        )
        .get() as { value: string }
    ).value;
  } finally {
    db.close();
  }
}

function runRestoreCli(cwd: string, args: string[]) {
  const cli = join(projectRoot, "node_modules", "tsx", "dist", "cli.mjs");
  const script = join(projectRoot, "scripts", "db-restore.ts");
  return spawnSync(process.execPath, [cli, script, ...args], {
    cwd,
    encoding: "utf8",
  });
}
