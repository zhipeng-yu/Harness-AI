import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
  symlinkSync,
  linkSync,
  unlinkSync,
} from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { basename, dirname, extname, join, relative, resolve, sep } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { artifactRepository } from "@/src/features/artifacts/repository";
import { responseRepository } from "@/src/features/responses/repository";
import {
  createVerifiedBackup,
  restoreBackup,
  verifyBackup,
} from "@/src/lib/db/backup";
import { backupFileOps } from "@/src/lib/db/backup-file-ops";
import { backupRuntimeOps } from "@/src/lib/db/backup-runtime-ops";
import { openDatabase } from "@/src/lib/db/connection";
import { migrate } from "@/src/lib/db/migrate";

const projectRoot = resolve(process.cwd());
const dataRoot = join(projectRoot, "data");
const backupRoot = join(projectRoot, "backups");
const runtimeRoot = join(projectRoot, ".runtime");
const cleanupPaths: string[] = [];
const externalCleanupPaths: string[] = [];
const databases: DatabaseSync[] = [];

function makeProjectTemp(root: string, prefix: string) {
  mkdirSync(root, { recursive: true });
  const path = mkdtempSync(join(root, prefix));
  cleanupPaths.push(path);
  return path;
}

function makeExternalTemp(prefix: string) {
  const path = mkdtempSync(join(tmpdir(), prefix));
  externalCleanupPaths.push(path);
  return path;
}

function assertCleanupBoundary(path: string) {
  const absolute = resolve(path);
  const inData = relative(dataRoot, absolute);
  const inBackups = relative(backupRoot, absolute);
  const inRuntime = relative(runtimeRoot, absolute);
  const isChild = (candidate: string) =>
    candidate !== "" && candidate !== ".." && !candidate.startsWith(`..${sep}`);
  if (!isChild(inData) && !isChild(inBackups) && !isChild(inRuntime)) {
    throw new Error(
      `Refusing test cleanup outside project data/backups/runtime: ${absolute}`,
    );
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
  while (externalCleanupPaths.length > 0) {
    const path = externalCleanupPaths.pop()!;
    const absolute = realpathSync(path);
    const relativeToTmp = relative(realpathSync(tmpdir()), absolute);
    if (
      relativeToTmp === "" ||
      relativeToTmp === ".." ||
      relativeToTmp.startsWith(`..${sep}`)
    ) {
      throw new Error(`Refusing external test cleanup outside temp: ${absolute}`);
    }
    rmSync(absolute, { recursive: true, force: true });
  }
});

describe("verified SQLite backups", () => {
  it("refuses a backup directory junction that resolves outside project backups", async () => {
    const dataDir = makeProjectTemp(dataRoot, "task9-data-");
    const linkParent = makeProjectTemp(backupRoot, "task9-backups-");
    const external = makeExternalTemp("task9-external-");
    const linkedBackupDir = join(linkParent, "escape");
    symlinkSync(external, linkedBackupDir, "junction");
    const sourcePath = join(dataDir, "harness.sqlite");
    const { db } = seedDatabase(sourcePath);

    await expect(createVerifiedBackup(sourcePath, linkedBackupDir)).rejects.toThrow(
      /real|junction|boundary|outside/i,
    );

    expect(readdirSync(external)).toEqual([]);
    closeDatabase(db);
  });

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

  it("creates distinct verified backups and records from concurrent processes", async () => {
    const dataDir = makeProjectTemp(dataRoot, "task9-data-");
    const backupDir = makeProjectTemp(backupRoot, "task9-backups-");
    const sourcePath = join(dataDir, "harness.sqlite");
    const { db } = seedDatabase(sourcePath);
    closeDatabase(db);
    const startAt = Date.now() + 1_000;

    const [first, second] = await Promise.all([
      runBackupWorker(sourcePath, backupDir, startAt),
      runBackupWorker(sourcePath, backupDir, startAt),
    ]);

    expect(first, first.stderr).toMatchObject({ code: 0 });
    expect(second, second.stderr).toMatchObject({ code: 0 });
    const files = dbBackupFiles(backupDir);
    expect(files).toHaveLength(2);
    expect(new Set(files.map((path) => basename(path))).size).toBe(2);
    for (const path of files) expect(verifyBackup(path).integrity).toBe("ok");
    const source = trackDatabase(sourcePath);
    expect(
      source.prepare("SELECT COUNT(*) AS count FROM backup_records").get(),
    ).toEqual({ count: 2 });
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
  it("refuses a backup source junction that resolves outside project backups", async () => {
    const dataDir = makeProjectTemp(dataRoot, "task9-data-");
    const backupDir = makeProjectTemp(backupRoot, "task9-backups-");
    const external = makeExternalTemp("task9-external-");
    const externalSource = join(external, "source.sqlite");
    const seeded = seedDatabase(externalSource, "external source");
    closeDatabase(seeded.db);
    const linked = join(backupDir, "escape");
    symlinkSync(external, linked, "junction");
    const target = join(dataDir, "harness.sqlite");

    await expect(
      restoreBackup({ source: join(linked, "source.sqlite"), target, confirm: true }),
    ).rejects.toThrow(/real|junction|boundary|outside/i);

    expect(existsSync(target)).toBe(false);
  });

  it("refuses a restore target junction that resolves outside project data", async () => {
    const dataDir = makeProjectTemp(dataRoot, "task9-data-");
    const backupDir = makeProjectTemp(backupRoot, "task9-backups-");
    const external = makeExternalTemp("task9-external-");
    const sourceDbPath = join(dataDir, "source.sqlite");
    const seeded = seedDatabase(sourceDbPath);
    const source = (await createVerifiedBackup(sourceDbPath, backupDir)).path;
    closeDatabase(seeded.db);
    const linked = join(dataDir, "escape");
    symlinkSync(external, linked, "junction");
    const target = join(linked, "harness.sqlite");

    await expect(restoreBackup({ source, target, confirm: true })).rejects.toThrow(
      /real|junction|boundary|outside/i,
    );

    expect(readdirSync(external)).toEqual([]);
  });

  it("rejects source and target hardlinks to the same database file", async () => {
    const dataDir = makeProjectTemp(dataRoot, "task9-data-");
    const backupDir = makeProjectTemp(backupRoot, "task9-backups-");
    const target = join(dataDir, "harness.sqlite");
    const seeded = seedDatabase(target);
    closeDatabase(seeded.db);
    const source = join(backupDir, "hardlink.sqlite");
    linkSync(target, source);

    await expect(restoreBackup({ source, target, confirm: true })).rejects.toThrow(
      /same|identity|hardlink/i,
    );

    expect(readResponse(target)).toBe("必须精确保留的回答");
  });

  it("rejects a source file swapped after verification and before copy", async () => {
    const dataDir = makeProjectTemp(dataRoot, "task9-data-");
    const backupDir = makeProjectTemp(backupRoot, "task9-backups-");
    const target = join(dataDir, "harness.sqlite");
    const sourceDbPath = join(dataDir, "source.sqlite");
    const replacementDbPath = join(dataDir, "replacement.sqlite");
    const sourceSeed = seedDatabase(sourceDbPath, "verified source");
    const source = (await createVerifiedBackup(sourceDbPath, backupDir)).path;
    closeDatabase(sourceSeed.db);
    const replacementSeed = seedDatabase(replacementDbPath, "swapped source");
    const replacement = (await createVerifiedBackup(replacementDbPath, backupDir)).path;
    closeDatabase(replacementSeed.db);
    const beforeCopy = backupFileOps.beforeCopy;
    vi.spyOn(backupFileOps, "beforeCopy").mockImplementation((from, to) => {
      beforeCopy(from, to);
      unlinkSync(source);
      linkSync(replacement, source);
    });

    await expect(restoreBackup({ source, target, confirm: true })).rejects.toThrow(
      /identity|changed|source/i,
    );

    expect(existsSync(target)).toBe(false);
  });

  it("rejects a target parent swapped to an external junction immediately before copy", async () => {
    const dataDir = makeProjectTemp(dataRoot, "task9-data-");
    const backupDir = makeProjectTemp(backupRoot, "task9-backups-");
    const targetParent = join(dataDir, "target-parent");
    mkdirSync(targetParent);
    const target = join(targetParent, "harness.sqlite");
    const external = makeExternalTemp("task9-external-");
    const sourceDbPath = join(dataDir, "source.sqlite");
    const sourceSeed = seedDatabase(sourceDbPath);
    const source = (await createVerifiedBackup(sourceDbPath, backupDir)).path;
    closeDatabase(sourceSeed.db);
    vi.spyOn(backupFileOps, "beforeCopy").mockImplementation(() => {
      rmSync(targetParent, { recursive: true });
      symlinkSync(external, targetParent, "junction");
    });

    await expect(restoreBackup({ source, target, confirm: true })).rejects.toThrow(
      /junction|boundary|parent/i,
    );

    expect(readdirSync(external)).toEqual([]);
  });

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
    const backupNames = new Set([source]);
    const preRestorePaths = dbBackupFiles(backupDir).filter(
      (path) => !backupNames.has(path),
    );
    expect(preRestorePaths).toHaveLength(1);
    const preRestoreRecord = restored
      .prepare(
        "SELECT path, kind, verified_at FROM backup_records WHERE kind = 'pre_restore'",
      )
      .get() as
      | { path: string; kind: string; verified_at: string }
      | undefined;
    expect(preRestoreRecord).toMatchObject({
      path: preRestorePaths[0],
      kind: "pre_restore",
    });
    expect(Number.isNaN(Date.parse(preRestoreRecord!.verified_at))).toBe(false);
    expect(verifyBackup(preRestoreRecord!.path).integrity).toBe("ok");
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
    const sourceDbPath = join(dataDir, "source.sqlite");
    const seeded = seedDatabase(sourceDbPath);
    const source = (await createVerifiedBackup(sourceDbPath, backupDir)).path;
    closeDatabase(seeded.db);

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

  it("preserves the rollback sibling with explicit paths when bad-target removal fails", async () => {
    const setup = await setupRestoreFailureFiles();
    vi.spyOn(backupFileOps, "rename").mockImplementation((from, to) => {
      renameSync(from, to);
      if (basename(from).startsWith(`.${basename(setup.target)}.restore-`)) {
        writeFileSync(to, "corrupted after install");
      }
    });
    vi.spyOn(backupFileOps, "remove").mockImplementation((path) => {
      if (path === setup.target) throw new Error("injected rollback remove failure");
      rmSync(path);
    });

    await expect(
      restoreBackup({ source: setup.source, target: setup.target, confirm: true }),
    ).rejects.toThrow(
      new RegExp(
        `${escapeRegex(setup.target)}.*${escapeRegex(setup.rollback)}|${escapeRegex(setup.rollback)}.*${escapeRegex(setup.target)}`,
        "i",
      ),
    );

    expect(readResponse(setup.rollback)).toBe("old target answer");
  });

  it("preserves the rollback sibling with explicit paths when rollback rename fails", async () => {
    const setup = await setupRestoreFailureFiles();
    let renameNumber = 0;
    vi.spyOn(backupFileOps, "rename").mockImplementation((from, to) => {
      renameNumber += 1;
      if (renameNumber === 3) throw new Error("injected rollback rename failure");
      renameSync(from, to);
      if (renameNumber === 2) writeFileSync(to, "corrupted after install");
    });

    await expect(
      restoreBackup({ source: setup.source, target: setup.target, confirm: true }),
    ).rejects.toThrow(
      new RegExp(
        `${escapeRegex(setup.target)}.*${escapeRegex(setup.rollback)}|${escapeRegex(setup.rollback)}.*${escapeRegex(setup.target)}`,
        "i",
      ),
    );

    expect(existsSync(setup.target)).toBe(false);
    expect(readResponse(setup.rollback)).toBe("old target answer");
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
    writeFileSync(
      join(runtime, "server.json"),
      JSON.stringify({ pid: process.pid, startTime: currentProcessStartTime() }),
    );
    const before = readFileSync(target);

    const result = runRestoreCli(isolatedRoot, [source, "--confirm"]);

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/website process is running/i);
    expect(readFileSync(target)).toEqual(before);
    expect(dbBackupFiles(isolatedBackups)).toEqual([source]);
  }, 15_000);

  it("does not treat a reused PID with a mismatched startTime as the website", () => {
    const setup = setupCliRestore("task9-cli-");
    writeFileSync(
      join(setup.runtime, "server.json"),
      JSON.stringify({ pid: process.pid, startTime: "2000-01-01T00:00:00.000Z" }),
    );

    const result = runRestoreCli(setup.root, [setup.source, "--confirm"]);

    expect(result.status, result.stderr).toBe(0);
    expect(readResponse(setup.target)).toBe("unused source");
  }, 15_000);

  it("allows restore when server.json identifies a dead PID", () => {
    const setup = setupCliRestore("task9-cli-");
    writeFileSync(
      join(setup.runtime, "server.json"),
      JSON.stringify({ pid: 2_147_483_647, startTime: "2026-01-01T00:00:00.000Z" }),
    );

    const result = runRestoreCli(setup.root, [setup.source, "--confirm"]);

    expect(result.status, result.stderr).toBe(0);
    expect(readResponse(setup.target)).toBe("unused source");
  }, 15_000);

  it("fails closed when server.json is malformed", () => {
    const setup = setupCliRestore("task9-cli-");
    writeFileSync(join(setup.runtime, "server.json"), "not json");
    const before = readFileSync(setup.target);

    const result = runRestoreCli(setup.root, [setup.source, "--confirm"]);

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/server\.json|runtime state|malformed/i);
    expect(readFileSync(setup.target)).toEqual(before);
  });

  it("fails closed when server.json cannot be read", async () => {
    const dataDir = makeProjectTemp(dataRoot, "task9-data-");
    const backupDir = makeProjectTemp(backupRoot, "task9-backups-");
    const target = join(dataDir, "harness.sqlite");
    const sourceDb = join(dataDir, "source.sqlite");
    const seededTarget = seedDatabase(target, "unchanged target");
    closeDatabase(seededTarget.db);
    const seededSource = seedDatabase(sourceDb, "unused source");
    const source = (await createVerifiedBackup(sourceDb, backupDir)).path;
    closeDatabase(seededSource.db);
    const before = readFileSync(target);
    mkdirSync(runtimeRoot, { recursive: true });
    const runtimeDir = makeProjectTemp(runtimeRoot, "task9-runtime-");
    const statePath = join(runtimeDir, "server.json");
    writeFileSync(
      statePath,
      JSON.stringify({ pid: process.pid, startTime: currentProcessStartTime() }),
    );
    vi.spyOn(backupRuntimeOps, "statePath").mockReturnValue(statePath);
    vi.spyOn(backupRuntimeOps, "readState").mockImplementation(() => {
      const error = new Error("access denied") as NodeJS.ErrnoException;
      error.code = "EACCES";
      throw error;
    });

    await expect(restoreBackup({ source, target, confirm: true })).rejects.toThrow(
      /runtime state|server\.json|read/i,
    );

    expect(readFileSync(target)).toEqual(before);
  });

  it("allows restore only when runtime lstat reports ENOENT", async () => {
    const setup = await setupRestoreWithoutRuntime();
    vi.spyOn(backupRuntimeOps, "lstatState").mockImplementation(() => {
      const error = new Error("missing") as NodeJS.ErrnoException;
      error.code = "ENOENT";
      throw error;
    });

    await restoreBackup({ source: setup.source, target: setup.target, confirm: true });

    expect(readResponse(setup.target)).toBe("unused source");
  });

  it("fails closed when runtime lstat reports EACCES", async () => {
    const setup = await setupRestoreWithoutRuntime();
    const before = readFileSync(setup.target);
    vi.spyOn(backupRuntimeOps, "lstatState").mockImplementation(() => {
      const error = new Error("access denied") as NodeJS.ErrnoException;
      error.code = "EACCES";
      throw error;
    });

    await expect(
      restoreBackup({ source: setup.source, target: setup.target, confirm: true }),
    ).rejects.toThrow(/runtime state|server\.json|access/i);

    expect(readFileSync(setup.target)).toEqual(before);
  });

  it("cleans its temporary restore file when candidate verification fails", async () => {
    const setup = await setupRestoreFailureFiles();
    vi.spyOn(backupFileOps, "afterCopy").mockImplementation((_from, temporary) => {
      writeFileSync(temporary, "corrupt candidate");
    });

    await expect(
      restoreBackup({ source: setup.source, target: setup.target, confirm: true }),
    ).rejects.toThrow();

    expect(readResponse(setup.target)).toBe("old target answer");
    expect(readdirSync(dirname(setup.target)).filter((name) => name.includes(".restore-")))
      .toEqual([]);
  });

  it("cleans its temporary restore file when copied candidate verification fails without a target", async () => {
    const dataDir = makeProjectTemp(dataRoot, "task9-data-");
    const backupDir = makeProjectTemp(backupRoot, "task9-backups-");
    const sourceDbPath = join(dataDir, "source.sqlite");
    const sourceSeed = seedDatabase(sourceDbPath, "source answer");
    const source = (await createVerifiedBackup(sourceDbPath, backupDir)).path;
    closeDatabase(sourceSeed.db);
    const target = join(dataDir, "missing-target.sqlite");
    vi.spyOn(backupFileOps, "afterCopy").mockImplementation((_from, temporary) => {
      writeFileSync(temporary, "corrupt candidate");
    });

    await expect(restoreBackup({ source, target, confirm: true })).rejects.toThrow();

    expect(existsSync(target)).toBe(false);
    expect(readdirSync(dataDir).filter((name) => name.includes(".restore-")))
      .toEqual([]);
  });

  it("cleans its reservation when a post-reservation check fails", async () => {
    const dataDir = makeProjectTemp(dataRoot, "task9-data-");
    const backupDir = makeProjectTemp(backupRoot, "task9-backups-");
    const sourcePath = join(dataDir, "harness.sqlite");
    const seeded = seedDatabase(sourcePath);
    closeDatabase(seeded.db);
    vi.spyOn(backupFileOps, "afterReserve").mockImplementation(() => {
      throw new Error("injected post-reservation failure");
    });

    await expect(createVerifiedBackup(sourcePath, backupDir)).rejects.toThrow(
      "injected post-reservation failure",
    );

    expect(readdirSync(backupDir)).toEqual([]);
  });

  it("cleans its reserved backup when source open fails after reservation", async () => {
    const dataDir = makeProjectTemp(dataRoot, "task9-data-");
    const backupDir = makeProjectTemp(backupRoot, "task9-backups-");
    const sourcePath = join(dataDir, "harness.sqlite");
    const seeded = seedDatabase(sourcePath);
    closeDatabase(seeded.db);
    vi.spyOn(backupFileOps, "afterReserve").mockImplementation(() => {
      unlinkSync(sourcePath);
    });

    await expect(createVerifiedBackup(sourcePath, backupDir)).rejects.toThrow();

    expect(readdirSync(backupDir)).toEqual([]);
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

function runBackupWorker(source: string, backupDir: string, startAt: number) {
  const cli = join(projectRoot, "node_modules", "tsx", "dist", "cli.mjs");
  const worker = join(
    projectRoot,
    "tests",
    "integration",
    "fixtures",
    "backup-worker.ts",
  );
  return new Promise<{ code: number | null; stdout: string; stderr: string }>(
    (resolveResult) => {
      const child = spawn(
        process.execPath,
        [cli, worker, source, backupDir, String(startAt)],
        { cwd: projectRoot, stdio: ["ignore", "pipe", "pipe"] },
      );
      let stdout = "";
      let stderr = "";
      child.stdout.setEncoding("utf8").on("data", (chunk) => {
        stdout += chunk;
      });
      child.stderr.setEncoding("utf8").on("data", (chunk) => {
        stderr += chunk;
      });
      child.on("close", (code) => resolveResult({ code, stdout, stderr }));
    },
  );
}

function currentProcessStartTime() {
  const result = spawnSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      `(Get-Process -Id ${process.pid} -ErrorAction Stop).StartTime.ToUniversalTime().ToString('O')`,
    ],
    { encoding: "utf8" },
  );
  if (result.status !== 0) throw new Error(result.stderr);
  return result.stdout.trim();
}

function setupCliRestore(prefix: string) {
  const root = makeProjectTemp(dataRoot, prefix);
  const data = join(root, "data");
  const backups = join(root, "backups");
  const runtime = join(root, ".runtime");
  mkdirSync(data);
  mkdirSync(backups);
  mkdirSync(runtime);
  const target = join(data, "harness.sqlite");
  const source = join(backups, "source.sqlite");
  const targetDb = seedDatabase(target, "unchanged target");
  closeDatabase(targetDb.db);
  const sourceDb = seedDatabase(source, "unused source");
  closeDatabase(sourceDb.db);
  return { root, data, backups, runtime, target, source };
}

async function setupRestoreFailureFiles() {
  const dataDir = makeProjectTemp(dataRoot, "task9-data-");
  const backupDir = makeProjectTemp(backupRoot, "task9-backups-");
  const target = join(dataDir, "harness.sqlite");
  const sourceDbPath = join(dataDir, "replacement.sqlite");
  const oldTarget = seedDatabase(target, "old target answer");
  closeDatabase(oldTarget.db);
  const replacement = seedDatabase(sourceDbPath, "new source answer");
  const source = (await createVerifiedBackup(sourceDbPath, backupDir)).path;
  closeDatabase(replacement.db);
  return {
    target,
    source,
    rollback: join(dataDir, "harness.pre-restore.sqlite"),
  };
}

async function setupRestoreWithoutRuntime() {
  const dataDir = makeProjectTemp(dataRoot, "task9-data-");
  const backupDir = makeProjectTemp(backupRoot, "task9-backups-");
  const target = join(dataDir, "harness.sqlite");
  const sourceDbPath = join(dataDir, "source.sqlite");
  const targetSeed = seedDatabase(target, "unchanged target");
  closeDatabase(targetSeed.db);
  const sourceSeed = seedDatabase(sourceDbPath, "unused source");
  const source = (await createVerifiedBackup(sourceDbPath, backupDir)).path;
  closeDatabase(sourceSeed.db);
  return { target, source };
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
