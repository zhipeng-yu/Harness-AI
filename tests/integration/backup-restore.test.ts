import { randomUUID } from "node:crypto";
import { existsSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { responseRepository } from "@/src/features/responses/repository";
import {
  createVerifiedBackup,
  restoreBackup,
  verifyBackup,
} from "@/src/lib/db/backup";
import { openDatabase } from "@/src/lib/db/connection";
import { migrate } from "@/src/lib/db/migrate";
import { BACKUP_DIRECTORY, DATA_DIRECTORY } from "@/src/lib/paths";

let originalBackups = new Set<string>();
const temporaryFiles = new Set<string>();

beforeEach(() => {
  originalBackups = new Set(readdirSync(BACKUP_DIRECTORY));
});

afterEach(() => {
  for (const path of temporaryFiles) rmSync(path, { force: true });
  temporaryFiles.clear();
  for (const name of readdirSync(BACKUP_DIRECTORY)) {
    if (!originalBackups.has(name)) {
      rmSync(join(BACKUP_DIRECTORY, name), { force: true });
    }
  }
});

function databasePath(label: string) {
  const path = join(DATA_DIRECTORY, `test-${label}-${randomUUID()}.sqlite`);
  temporaryFiles.add(path);
  temporaryFiles.add(`${path}-wal`);
  temporaryFiles.add(`${path}-shm`);
  return path;
}

function seedDatabase(path: string, value: string) {
  const db = openDatabase(path);
  migrate(db);
  responseRepository(db).upsert({
    ownerId: "owner-local",
    chapterId: "chapter-01",
    promptId: "chapter-01-reflection-01",
    value,
  });
  db.close();
}

function readValue(path: string) {
  const db = openDatabase(path);
  const value = responseRepository(db).get(
    "owner-local",
    "chapter-01",
    "chapter-01-reflection-01",
  )?.value;
  db.close();
  return value;
}

describe("local backup and restore", () => {
  it("creates a verified SQLite backup", async () => {
    const source = databasePath("source");
    seedDatabase(source, "my answer");

    const result = await createVerifiedBackup(source);

    expect(result.integrity).toBe("ok");
    expect(result.ownerCount).toBe(1);
    expect(result.migrationCount).toBeGreaterThan(0);
    expect(verifyBackup(result.path).integrity).toBe("ok");
  });

  it("restores a verified backup into a project data file", async () => {
    const source = databasePath("source");
    const target = databasePath("target");
    seedDatabase(source, "restored answer");
    const saved = await createVerifiedBackup(source);

    await restoreBackup({ source: saved.path, target, confirm: true });

    expect(readValue(target)).toBe("restored answer");
  });

  it("backs up an existing target before replacing it", async () => {
    const source = databasePath("source");
    const target = databasePath("target");
    seedDatabase(source, "new answer");
    seedDatabase(target, "old answer");
    const saved = await createVerifiedBackup(source);
    const before = new Set(readdirSync(BACKUP_DIRECTORY));

    await restoreBackup({ source: saved.path, target, confirm: true });

    expect(readValue(target)).toBe("new answer");
    expect(readdirSync(BACKUP_DIRECTORY).filter((name) => !before.has(name))).toHaveLength(1);
  });

  it("rejects corrupt and out-of-project restore sources", async () => {
    const corrupt = join(BACKUP_DIRECTORY, `corrupt-${randomUUID()}.sqlite`);
    writeFileSync(corrupt, "not sqlite");
    expect(() => verifyBackup(corrupt)).toThrow();

    const target = databasePath("target");
    await expect(
      restoreBackup({ source: join(DATA_DIRECTORY, "outside.sqlite"), target, confirm: true }),
    ).rejects.toThrow(/inside/i);
    expect(existsSync(target)).toBe(false);
  });
});
