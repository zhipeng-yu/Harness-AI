import { randomUUID } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  realpathSync,
  readdirSync,
  statSync,
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
import type { FileIdentity } from "@/src/lib/db/backup-file-ops";
import { backupRuntimeOps } from "@/src/lib/db/backup-runtime-ops";
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

function samePath(left: string, right: string) {
  return process.platform === "win32"
    ? resolve(left).toLowerCase() === resolve(right).toLowerCase()
    : resolve(left) === resolve(right);
}

function realRoot(root: string) {
  return realpathSync(resolve(root));
}

function nearestExistingAncestor(path: string) {
  let current = resolve(path);
  while (!existsSync(current)) {
    const parent = dirname(current);
    if (parent === current) throw new Error(`No existing ancestor for ${path}`);
    current = parent;
  }
  return current;
}

function requireRealMapping(root: string, candidate: string, label: string) {
  const lexicalRoot = resolve(root);
  const lexicalCandidate = resolve(candidate);
  const relativeCandidate = relative(lexicalRoot, lexicalCandidate);
  if (
    (relativeCandidate !== "" && !isWithin(lexicalRoot, lexicalCandidate)) ||
    isAbsolute(relativeCandidate)
  ) {
    throw new Error(`${label} is outside allowed root ${resolve(root)}`);
  }
  const existing = nearestExistingAncestor(lexicalCandidate);
  const actualExisting = realpathSync(existing);
  const expectedExisting = resolve(
    realRoot(lexicalRoot),
    relative(lexicalRoot, existing),
  );
  if (!samePath(actualExisting, expectedExisting)) {
    throw new Error(`${label} crosses a junction or real path boundary`);
  }
  return lexicalCandidate;
}

function requireExistingRealFile(root: string, candidate: string, label: string) {
  const absolute = requireRealMapping(root, candidate, label);
  if (!existsSync(absolute) || !lstatSync(absolute).isFile()) {
    throw new Error(`${label} must be an existing regular file`);
  }
  const actual = realpathSync(absolute);
  const expected = resolve(realRoot(root), relative(resolve(root), absolute));
  if (!samePath(actual, expected)) {
    throw new Error(`${label} crosses a symlink or real path boundary`);
  }
  return absolute;
}

function sameFileIdentity(left: string, right: string) {
  const leftStat = statSync(left, { bigint: true });
  const rightStat = statSync(right, { bigint: true });
  return leftStat.dev === rightStat.dev && leftStat.ino === rightStat.ino;
}

function fileIdentity(path: string): FileIdentity {
  const stats = statSync(path, { bigint: true });
  return { dev: stats.dev, ino: stats.ino };
}

function requireOwnedIdentity(
  path: string,
  identity: FileIdentity,
  label: string,
) {
  if (!backupFileOps.owns(path, identity)) {
    throw new Error(`${label} file identity changed: ${path}`);
  }
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

function requireSafeParent(root: string, candidate: string, label: string) {
  const absolute = requireRealMapping(root, candidate, label);
  const parent = dirname(absolute);
  requireRealMapping(root, parent, `${label} parent`);
  if (!existsSync(parent)) throw new Error(`${label} parent does not exist`);
  return absolute;
}

function safeRename(
  source: string,
  sourceIdentity: FileIdentity,
  destination: string,
  label: string,
) {
  backupFileOps.beforeRename(source, destination);
  requireExistingRealFile(DATA_DIRECTORY, source, `${label} source`);
  requireOwnedIdentity(source, sourceIdentity, `${label} source`);
  requireSafeParent(DATA_DIRECTORY, destination, `${label} destination`);
  if (existsSync(destination)) {
    throw new Error(`${label} destination already exists: ${destination}`);
  }
  backupFileOps.rename(source, destination);
}

function safeRemove(
  root: string,
  path: string,
  identity: FileIdentity,
  label: string,
) {
  backupFileOps.beforeRemove(path);
  requireExistingRealFile(root, path, label);
  requireOwnedIdentity(path, identity, label);
  requireSafeParent(root, path, label);
  backupFileOps.remove(path);
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function backupFilename(date: Date) {
  return `harness-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}.sqlite`;
}

function backupTimestamp(filename: string) {
  const match = /^harness-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})\.sqlite$/.exec(
    filename,
  );
  if (!match) return undefined;
  const [, year, month, day, hour, minute, second] = match;
  const timestamp = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  ).getTime();
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

function reserveBackupPath(backupDir: string): {
  path: string;
  identity: FileIdentity;
} {
  const latestExisting = readdirSync(backupDir)
    .map(backupTimestamp)
    .filter((value): value is number => value !== undefined)
    .reduce((latest, value) => Math.max(latest, value), 0);
  const startedAt = Math.max(Date.now(), latestExisting + 1_000);
  for (let offset = 0; ; offset += 1) {
    const timestamp = startedAt + offset * 1_000;
    const candidate = join(
      backupDir,
      backupFilename(new Date(timestamp)),
    );
    try {
      return { path: candidate, identity: backupFileOps.reserve(candidate) };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
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

function addVerifiedBackupRecord(
  databasePath: string,
  backupPath: string,
  kind: BackupKind,
) {
  const db = new DatabaseSync(databasePath, { timeout: 5_000 });
  try {
    const now = new Date().toISOString();
    db.prepare(
      "INSERT INTO backup_records (id, path, kind, verified_at, created_at) VALUES (?, ?, ?, ?, ?)",
    ).run(randomUUID(), backupPath, kind, now, now);
  } finally {
    db.close();
  }
  makeBackupSelfContained(databasePath);
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
    if (existsSync(candidate)) {
      requireExistingRealFile(BACKUP_DIRECTORY, candidate, "Pruned backup");
      safeRemove(
        BACKUP_DIRECTORY,
        candidate,
        fileIdentity(candidate),
        "Pruned backup",
      );
    }
    deleteRecord.run(record.id);
  }
}

export async function createVerifiedBackup(
  dbPath: string,
  backupDir: string,
  kind: BackupKind = "manual",
): Promise<BackupResult> {
  const sourcePath = requireExistingRealFile(
    DATA_DIRECTORY,
    dbPath,
    "Database path",
  );
  const directory = requireAtOrWithin(
    BACKUP_DIRECTORY,
    backupDir,
    "Backup directory",
  );
  if (!existsSync(sourcePath) || extname(sourcePath).toLowerCase() !== ".sqlite") {
    throw new Error("Database must be an existing .sqlite file");
  }
  requireRealMapping(BACKUP_DIRECTORY, directory, "Backup directory");
  mkdirSync(directory, { recursive: true });
  requireRealMapping(BACKUP_DIRECTORY, directory, "Backup directory");
  const reservation = reserveBackupPath(directory);
  const destination = requireDirectSibling(
    directory,
    reservation.path,
    "Backup path",
  );
  const sourceIdentity = fileIdentity(sourcePath);
  let source: DatabaseSync | undefined;
  let recorded = false;
  try {
    backupFileOps.afterReserve(destination);
    requireSafeParent(BACKUP_DIRECTORY, destination, "Backup path");
    if (!backupFileOps.owns(destination, reservation.identity)) {
      throw new Error(`Lost ownership of reserved backup path: ${destination}`);
    }
    requireExistingRealFile(DATA_DIRECTORY, sourcePath, "Database before backup");
    requireOwnedIdentity(sourcePath, sourceIdentity, "Database before backup");
    source = new DatabaseSync(sourcePath, { timeout: 5_000 });
    await backup(source, destination);
    if (!backupFileOps.owns(destination, reservation.identity)) {
      throw new Error(`Backup path identity changed during creation: ${destination}`);
    }
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
    if (
      !recorded &&
      existsSync(destination) &&
      backupFileOps.owns(destination, reservation.identity)
    ) {
      safeRemove(
        BACKUP_DIRECTORY,
        destination,
        reservation.identity,
        "Failed backup",
      );
    }
    throw error;
  } finally {
    source?.close();
  }
}

function liveWebsiteProcess() {
  const requestedStatePath = backupRuntimeOps.statePath();
  try {
    const state = backupRuntimeOps.lstatState(requestedStatePath);
    if (!state.isFile()) {
      throw new Error(`Runtime state is not a regular file: ${requestedStatePath}`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw new Error(
      `Cannot safely inspect runtime state ${requestedStatePath}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
  let statePath = resolve(requestedStatePath);
  try {
    statePath = requireExistingRealFile(
      dirname(SERVER_STATE_PATH),
      requestedStatePath,
      "Runtime server.json",
    );
    const record = JSON.parse(backupRuntimeOps.readState(statePath)) as {
      pid?: unknown;
      startTime?: unknown;
    };
    if (
      !Number.isInteger(record.pid) ||
      Number(record.pid) <= 0 ||
      typeof record.startTime !== "string" ||
      !Number.isFinite(Date.parse(record.startTime))
    ) {
      throw new Error(`Malformed runtime state: ${statePath}`);
    }
    const processIdentity = backupRuntimeOps.inspectProcess(Number(record.pid));
    if (processIdentity.status === "dead") return false;
    const expectedStart = Date.parse(record.startTime);
    const actualStart = Date.parse(processIdentity.startTime);
    if (!Number.isFinite(actualStart)) {
      throw new Error(`Invalid process startTime for PID ${record.pid}`);
    }
    return Math.abs(expectedStart - actualStart) <= 1_000;
  } catch (error) {
    throw new Error(
      `Cannot safely read or validate runtime state ${statePath}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}

function removeInstalledTargetAndRollback(
  target: string,
  installedIdentity: FileIdentity,
  previous: string,
  previousIdentity: FileIdentity,
) {
  try {
    if (existsSync(target)) {
      safeRemove(
        DATA_DIRECTORY,
        target,
        installedIdentity,
        "Failed restore target",
      );
    }
    if (existsSync(previous)) {
      safeRename(
        previous,
        previousIdentity,
        target,
        "Restore rollback",
      );
    }
  } catch (error) {
    throw new Error(
      `Automatic restore rollback failed. Target: ${target}. Recoverable rollback: ${previous}. ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
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
  const source = requireExistingRealFile(
    BACKUP_DIRECTORY,
    options.source,
    "Backup source",
  );
  const target = requireRealMapping(DATA_DIRECTORY, options.target, "Restore target");
  if (existsSync(target)) {
    requireExistingRealFile(DATA_DIRECTORY, target, "Restore target");
    if (sameFileIdentity(source, target)) {
      throw new Error("Backup source and restore target have the same file identity");
    }
  }
  if (extname(target).toLowerCase() !== ".sqlite") {
    throw new Error("Restore target must be a .sqlite file");
  }
  if (liveWebsiteProcess()) {
    throw new Error("Refusing restore while the website process is running");
  }
  verifyBackup(source);
  const verifiedSourceIdentity = fileIdentity(source);
  verifyNoSidecars(target, "Restore target");

  const targetDirectory = dirname(target);
  requireRealMapping(DATA_DIRECTORY, targetDirectory, "Restore target directory");
  mkdirSync(targetDirectory, { recursive: true });
  requireRealMapping(DATA_DIRECTORY, targetDirectory, "Restore target directory");
  const preRestore = existsSync(target)
    ? await createVerifiedBackup(target, dirname(source), "pre_restore")
    : undefined;

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
  requireSafeParent(DATA_DIRECTORY, temporary, "Restore temporary path");
  requireSafeParent(DATA_DIRECTORY, previous, "Restore rollback path");
  if (existsSync(previous)) {
    throw new Error(`Restore rollback path already exists: ${previous}`);
  }

  let temporaryIdentity: FileIdentity | undefined;
  let movedPrevious = false;
  let previousIdentity: FileIdentity | undefined;
  try {
    backupFileOps.beforeCopy(source, temporary);
    requireExistingRealFile(
      BACKUP_DIRECTORY,
      source,
      "Backup source immediately before copy",
    );
    requireOwnedIdentity(
      source,
      verifiedSourceIdentity,
      "Backup source immediately before copy",
    );
    requireSafeParent(
      DATA_DIRECTORY,
      temporary,
      "Restore temporary immediately before copy",
    );
    if (existsSync(temporary)) {
      throw new Error(`Restore temporary path already exists: ${temporary}`);
    }
    backupFileOps.copyExclusive(source, temporary);
    temporaryIdentity = fileIdentity(temporary);
    backupFileOps.afterCopy(source, temporary);
    requireExistingRealFile(DATA_DIRECTORY, temporary, "Restore candidate");
    requireOwnedIdentity(temporary, temporaryIdentity, "Restore candidate");
    if (preRestore) {
      addVerifiedBackupRecord(temporary, preRestore.path, "pre_restore");
    }
    verifyBackup(temporary);
    requireOwnedIdentity(
      temporary,
      temporaryIdentity,
      "Verified restore candidate",
    );

    if (existsSync(target)) {
      requireExistingRealFile(DATA_DIRECTORY, target, "Restore target before rename");
      previousIdentity = fileIdentity(target);
      safeRename(target, previousIdentity, previous, "Preserve restore target");
      movedPrevious = true;
    }
    try {
      safeRename(
        temporary,
        temporaryIdentity,
        target,
        "Install restore candidate",
      );
      verifyBackup(target);
      requireOwnedIdentity(target, temporaryIdentity, "Installed restore target");
    } catch (error) {
      if (movedPrevious && previousIdentity) {
        removeInstalledTargetAndRollback(
          target,
          temporaryIdentity,
          previous,
          previousIdentity,
        );
      }
      movedPrevious = false;
      throw error;
    }
    if (movedPrevious && previousIdentity) {
      safeRemove(
        DATA_DIRECTORY,
        previous,
        previousIdentity,
        "Restore rollback",
      );
    }
  } finally {
    if (
      temporaryIdentity &&
      existsSync(temporary) &&
      backupFileOps.owns(temporary, temporaryIdentity)
    ) {
      safeRemove(
        DATA_DIRECTORY,
        temporary,
        temporaryIdentity,
        "Restore temporary file",
      );
    }
  }
}
