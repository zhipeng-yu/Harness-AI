import { randomUUID } from "node:crypto";
import {
  existsSync,
  lstatSync,
  realpathSync,
  renameSync,
  rmSync,
} from "node:fs";
import { basename, extname, isAbsolute, join, relative, resolve } from "node:path";
import { backup, DatabaseSync } from "node:sqlite";
import { SERVER_STATE_PATH, ensureDirectProjectDirectory } from "@/src/lib/paths";

export type BackupResult = {
  path: string;
  integrity: "ok";
  ownerCount: number;
  migrationCount: number;
};

function samePath(left: string, right: string) {
  return process.platform === "win32"
    ? resolve(left).toLowerCase() === resolve(right).toLowerCase()
    : resolve(left) === resolve(right);
}

function isInside(root: string, candidate: string) {
  const pathFromRoot = relative(root, candidate);
  return pathFromRoot !== "" && !pathFromRoot.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) && !isAbsolute(pathFromRoot);
}

function requireFileInside(root: string, candidate: string, label: string) {
  const resolved = resolve(candidate);
  if (!isInside(root, resolved) || extname(resolved).toLowerCase() !== ".sqlite") {
    throw new Error(`${label} must be a .sqlite file inside ${root}`);
  }
  const stat = lstatSync(resolved);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(`${label} must be a regular file`);
  }
  const real = realpathSync.native(resolved);
  if (!isInside(root, real)) throw new Error(`${label} is outside ${root}`);
  return real;
}

function requireTargetInside(root: string, candidate: string) {
  const resolved = resolve(candidate);
  if (!isInside(root, resolved) || extname(resolved).toLowerCase() !== ".sqlite") {
    throw new Error(`Restore target must be a .sqlite file inside ${root}`);
  }
  return resolved;
}

export function verifyBackup(path: string): {
  integrity: "ok";
  ownerCount: number;
  migrationCount: number;
} {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    const integrity = String(
      (db.prepare("PRAGMA integrity_check").get() as Record<string, unknown>)[
        "integrity_check"
      ],
    );
    if (integrity !== "ok") throw new Error(`Backup integrity check failed: ${integrity}`);

    const ownerCount = Number(
      (db.prepare("SELECT COUNT(*) AS count FROM owners WHERE id = ?").get("owner-local") as { count: number }).count,
    );
    const migrationCount = Number(
      (db.prepare("SELECT COUNT(*) AS count FROM schema_migrations").get() as { count: number }).count,
    );
    if (ownerCount < 1) throw new Error("Backup is missing owner-local");
    if (migrationCount < 1) throw new Error("Backup has no migration record");
    return { integrity: "ok", ownerCount, migrationCount };
  } finally {
    db.close();
  }
}

export async function createVerifiedBackup(
  dbPath: string,
): Promise<BackupResult> {
  const dataRoot = ensureDirectProjectDirectory("data");
  const backupRoot = ensureDirectProjectDirectory("backups");
  const source = requireFileInside(dataRoot, dbPath, "Database");
  const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  const destination = join(backupRoot, `harness-${stamp}-${randomUUID().slice(0, 8)}.sqlite`);

  const sourceDb = new DatabaseSync(source, { readOnly: true });
  try {
    await backup(sourceDb, destination);
  } finally {
    sourceDb.close();
  }

  const backupDb = new DatabaseSync(destination);
  try {
    backupDb.exec("PRAGMA journal_mode = DELETE");
  } finally {
    backupDb.close();
  }

  try {
    const verification = verifyBackup(destination);
    return { path: destination, ...verification };
  } catch (error) {
    rmSync(destination, { force: true });
    throw error;
  }
}

export async function restoreBackup(options: {
  source: string;
  target: string;
  confirm: true;
}): Promise<void> {
  if (options.confirm !== true) throw new Error("Restore confirmation is required");
  const dataRoot = ensureDirectProjectDirectory("data");
  const backupRoot = ensureDirectProjectDirectory("backups");
  const source = requireFileInside(backupRoot, options.source, "Backup source");
  const target = requireTargetInside(dataRoot, options.target);
  if (samePath(source, target)) throw new Error("Backup source and target are the same file");
  if (existsSync(SERVER_STATE_PATH)) throw new Error("Stop the website before restoring");
  if (existsSync(`${target}-wal`) || existsSync(`${target}-shm`)) {
    throw new Error("Restore target still has SQLite sidecar files");
  }
  verifyBackup(source);

  if (existsSync(target)) {
    requireFileInside(dataRoot, target, "Restore target");
    await createVerifiedBackup(target);
  }

  const temporary = join(dataRoot, `.${basename(target)}.${randomUUID()}.restore.sqlite`);
  const previous = join(dataRoot, `.${basename(target)}.${randomUUID()}.previous.sqlite`);
  let movedPrevious = false;
  let installed = false;

  try {
    const sourceDb = new DatabaseSync(source, { readOnly: true });
    try {
      await backup(sourceDb, temporary);
    } finally {
      sourceDb.close();
    }
    verifyBackup(temporary);
    if (existsSync(target)) {
      renameSync(target, previous);
      movedPrevious = true;
    }
    renameSync(temporary, target);
    installed = true;
    verifyBackup(target);
    if (movedPrevious) rmSync(previous, { force: true });
  } catch (error) {
    if (installed) rmSync(target, { force: true });
    if (movedPrevious && existsSync(previous)) renameSync(previous, target);
    throw error;
  } finally {
    rmSync(temporary, { force: true });
  }
}
