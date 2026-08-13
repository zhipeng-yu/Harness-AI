import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
} from "node:fs";
import {
  basename,
  dirname,
  extname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import { backup, DatabaseSync } from "node:sqlite";
import { backupFileOps } from "@/src/lib/db/backup-file-ops";
import {
  BACKUP_DIRECTORY,
  DATA_DIRECTORY,
  SERVER_STATE_PATH,
} from "@/src/lib/paths";

export type BackupKind = "manual" | "automatic" | "pre_restore";

export type BackupResult = {
  path: string;
  integrity: "ok";
  ownerCount: number;
  migrationCount: number;
};

type CountRow = { count: number };

function isWithin(root: string, candidate: string) {
  const pathFromRoot = relative(resolve(root), resolve(candidate));
  return (
    pathFromRoot !== "" &&
    pathFromRoot !== ".." &&
    !pathFromRoot.startsWith(`..${sep}`) &&
    !isAbsolute(pathFromRoot)
  );
}

function requireWithin(root: string, candidate: string, label: string) {
  const absolute = resolve(candidate);
  if (!isWithin(root, absolute)) {
    throw new Error(`${label} must be inside ${resolve(root)}`);
  }
  return absolute;
}

function requireAtOrWithin(root: string, candidate: string, label: string) {
  const absoluteRoot = resolve(root);
  const absolute = resolve(candidate);
  if (absolute !== absoluteRoot && !isWithin(absoluteRoot, absolute)) {
    throw new Error(`${label} must be ${absoluteRoot} or inside it`);
  }
  return absolute;
}

function requireDirectSibling(parent: string, candidate: string, label: string) {
  const absoluteParent = resolve(parent);
  const absolute = resolve(candidate);
  if (dirname(absolute) !== absoluteParent) {
    throw new Error(`${label} must be a direct sibling of the target`);
  }
  return absolute;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function backupFilename(date: Date) {
  return `harness-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}.sqlite`;
}

let lastBackupTimestamp = 0;

function unusedBackupPath(backupDir: string) {
  const startedAt = Math.max(Date.now(), lastBackupTimestamp + 1_000);
  for (let offset = 0; ; offset += 1) {
    const timestamp = startedAt + offset * 1_000;
    const candidate = join(
      backupDir,
      backupFilename(new Date(timestamp)),
    );
    if (!existsSync(candidate)) {
      lastBackupTimestamp = timestamp;
      return candidate;
    }
  }
}

function verifyNoSidecars(path: string, label: string) {
  for (const suffix of ["-wal", "-shm"]) {
    if (existsSync(`${path}${suffix}`)) {
      throw new Error(`${label} has a SQLite sidecar file: ${basename(path)}${suffix}`);
    }
  }
}

function makeBackupSelfContained(path: string) {
  const db = new DatabaseSync(path, { timeout: 5_000 });
  try {
    const row = db.prepare("PRAGMA journal_mode = DELETE").get() as {
      journal_mode: string;
    };
    if (String(row.journal_mode).toLowerCase() !== "delete") {
      throw new Error("Could not make backup self-contained");
    }
  } finally {
    db.close();
  }
  verifyNoSidecars(path, "Backup");
}

export function verifyBackup(path: string): {
  integrity: "ok";
  ownerCount: number;
  migrationCount: number;
} {
  const absolute = resolve(path);
  if (extname(absolute).toLowerCase() !== ".sqlite" || !existsSync(absolute)) {
    throw new Error("Backup must be an existing .sqlite file");
  }
  verifyNoSidecars(absolute, "Backup");

  const db = new DatabaseSync(absolute, { readOnly: true, timeout: 5_000 });
  try {
    const integrityRows = db.prepare("PRAGMA integrity_check").all() as {
      integrity_check: string;
    }[];
    if (
      integrityRows.length !== 1 ||
      String(integrityRows[0]?.integrity_check).toLowerCase() !== "ok"
    ) {
      throw new Error("Backup integrity check failed");
    }
    const ownerCount = Number(
      (db
        .prepare("SELECT COUNT(*) AS count FROM owners WHERE id = ?")
        .get("owner-local") as CountRow).count,
    );
    if (ownerCount < 1) throw new Error("Backup is missing owner-local");
    const migrationCount = Number(
      (db
        .prepare("SELECT COUNT(*) AS count FROM schema_migrations")
        .get() as CountRow).count,
    );
    if (migrationCount < 1) {
      throw new Error("Backup has no applied schema migration");
    }
    return { integrity: "ok", ownerCount, migrationCount };
  } finally {
    db.close();
  }
}

function pruneVerifiedAutomaticBackups(
  source: DatabaseSync,
  backupDir: string,
  keep: number,
) {
  const directory = resolve(backupDir);
  const records = source
    .prepare(`
      SELECT id, path
      FROM backup_records
      WHERE kind = 'automatic'
      ORDER BY verified_at DESC, created_at DESC, rowid DESC
    `)
    .all() as { id: string; path: string }[];
  const oldRecords = records
    .filter((record) => {
      const candidate = resolve(record.path);
      return isWithin(directory, candidate) && dirname(candidate) === directory;
    })
    .slice(keep);

  const deleteRecord = source.prepare("DELETE FROM backup_records WHERE id = ?");
  for (const record of oldRecords) {
    const candidate = resolve(record.path);
    if (!isWithin(directory, candidate) || dirname(candidate) !== directory) {
      continue;
    }
    if (!/^harness-\d{8}-\d{6}\.sqlite$/.test(basename(candidate))) continue;
    if (existsSync(candidate)) rmSync(candidate);
    deleteRecord.run(record.id);
  }
}

export async function createVerifiedBackup(
  dbPath: string,
  backupDir: string,
  kind: BackupKind = "manual",
): Promise<BackupResult> {
  const sourcePath = requireWithin(DATA_DIRECTORY, dbPath, "Database path");
  const directory = requireAtOrWithin(
    BACKUP_DIRECTORY,
    backupDir,
    "Backup directory",
  );
  if (!existsSync(sourcePath) || extname(sourcePath).toLowerCase() !== ".sqlite") {
    throw new Error("Database must be an existing .sqlite file");
  }
  mkdirSync(directory, { recursive: true });
  const destination = requireDirectSibling(
    directory,
    unusedBackupPath(directory),
    "Backup path",
  );
  const source = new DatabaseSync(sourcePath, { timeout: 5_000 });
  let recorded = false;
  try {
    await backup(source, destination);
    makeBackupSelfContained(destination);
    const verification = verifyBackup(destination);
    const now = new Date().toISOString();
    source
      .prepare(
        "INSERT INTO backup_records (id, path, kind, verified_at, created_at) VALUES (?, ?, ?, ?, ?)",
      )
      .run(randomUUID(), destination, kind, now, now);
    recorded = true;
    pruneVerifiedAutomaticBackups(source, directory, 10);
    return { path: destination, ...verification };
  } catch (error) {
    if (!recorded && existsSync(destination)) rmSync(destination);
    throw error;
  } finally {
    source.close();
  }
}

function liveWebsiteProcess() {
  const statePath = resolve(SERVER_STATE_PATH);
  if (!isWithin(dirname(dirname(statePath)), statePath) || !existsSync(statePath)) {
    return false;
  }
  try {
    const record = JSON.parse(readFileSync(statePath, "utf8")) as { pid?: unknown };
    if (!Number.isInteger(record.pid) || Number(record.pid) <= 0) return false;
    process.kill(Number(record.pid), 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

function removeInstalledTargetAndRollback(target: string, previous: string) {
  if (existsSync(target)) backupFileOps.remove(target);
  if (existsSync(previous)) backupFileOps.rename(previous, target);
}

export async function restoreBackup(options: {
  source: string;
  target: string;
  confirm: true;
}): Promise<void> {
  if (options.confirm !== true) throw new Error("Restore confirmation is required");
  if (resolve(options.source) === resolve(options.target)) {
    throw new Error("Backup source and restore target are the same path");
  }
  const source = requireWithin(BACKUP_DIRECTORY, options.source, "Backup source");
  const target = requireWithin(DATA_DIRECTORY, options.target, "Restore target");
  if (extname(target).toLowerCase() !== ".sqlite") {
    throw new Error("Restore target must be a .sqlite file");
  }
  if (liveWebsiteProcess()) {
    throw new Error("Refusing restore while the website process is running");
  }
  verifyBackup(source);
  verifyNoSidecars(target, "Restore target");

  const targetDirectory = dirname(target);
  mkdirSync(targetDirectory, { recursive: true });
  if (existsSync(target)) {
    await createVerifiedBackup(target, dirname(source), "pre_restore");
  }

  const temporary = requireDirectSibling(
    targetDirectory,
    join(targetDirectory, `.${basename(target)}.restore-${randomUUID()}.sqlite`),
    "Restore temporary path",
  );
  const previous = requireDirectSibling(
    targetDirectory,
    join(targetDirectory, "harness.pre-restore.sqlite"),
    "Restore rollback path",
  );
  if (existsSync(previous)) {
    throw new Error(`Restore rollback path already exists: ${previous}`);
  }

  backupFileOps.copyExclusive(source, temporary);
  let movedPrevious = false;
  try {
    if (existsSync(target)) {
      backupFileOps.rename(target, previous);
      movedPrevious = true;
    }
    try {
      backupFileOps.rename(temporary, target);
      verifyBackup(target);
    } catch (error) {
      removeInstalledTargetAndRollback(target, previous);
      movedPrevious = false;
      throw error;
    }
    if (movedPrevious) backupFileOps.remove(previous);
  } finally {
    if (existsSync(temporary)) backupFileOps.remove(temporary);
  }
}
