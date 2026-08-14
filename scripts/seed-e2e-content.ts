import {
  existsSync,
  lstatSync,
  realpathSync,
  unlinkSync,
} from "node:fs";
import { basename, dirname, relative, resolve } from "node:path";
import { openDatabase } from "@/src/lib/db/connection";
import { migrate } from "@/src/lib/db/migrate";
import { DATA_DIRECTORY, PROJECT_DIRECTORY } from "@/src/lib/paths";

const E2E_DATABASE_NAME = "e2e.sqlite";
const E2E_DATABASE_PATH = resolve(DATA_DIRECTORY, E2E_DATABASE_NAME);
const E2E_FILES = [
  E2E_DATABASE_PATH,
  `${E2E_DATABASE_PATH}-wal`,
  `${E2E_DATABASE_PATH}-shm`,
] as const;

function assertInsideDataDirectory(path: string): void {
  const dataRealPath = realpathSync.native(DATA_DIRECTORY);
  const parentRealPath = realpathSync.native(dirname(path));
  const relativeParent = relative(dataRealPath, parentRealPath);
  const allowedNames = new Set([
    E2E_DATABASE_NAME,
    `${E2E_DATABASE_NAME}-wal`,
    `${E2E_DATABASE_NAME}-shm`,
  ]);

  if (
    relativeParent !== "" ||
    !allowedNames.has(basename(path)) ||
    resolve(path) !== resolve(parentRealPath, basename(path))
  ) {
    throw new Error(`Refusing to remove E2E database path outside project data: ${path}`);
  }

  if (existsSync(path)) {
    if (lstatSync(path).isSymbolicLink()) {
      throw new Error(`Refusing to remove symlinked E2E database path: ${path}`);
    }
    const fileRealPath = realpathSync.native(path);
    const relativeFile = relative(dataRealPath, fileRealPath);
    if (relativeFile.startsWith("..") || resolve(dataRealPath, relativeFile) !== fileRealPath) {
      throw new Error(`Refusing to remove E2E database path outside project data: ${path}`);
    }
  }
}

export default function seedE2eContent(): void {
  if (resolve(process.cwd()) !== resolve(PROJECT_DIRECTORY)) {
    throw new Error("Run the E2E seed from the project root.");
  }

  for (const path of E2E_FILES) {
    assertInsideDataDirectory(path);
    if (existsSync(path)) unlinkSync(path);
  }

  const db = openDatabase(E2E_DATABASE_PATH);
  try {
    migrate(db);
  } finally {
    db.close();
  }
}
