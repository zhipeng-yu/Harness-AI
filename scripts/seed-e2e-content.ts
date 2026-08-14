import {
  existsSync,
  lstatSync,
  mkdirSync,
  realpathSync,
  unlinkSync,
} from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import type { FullConfig } from "@playwright/test";
import { openDatabase } from "@/src/lib/db/connection";
import { migrate } from "@/src/lib/db/migrate";

const E2E_DATABASE_NAME = "e2e.sqlite";

function samePath(left: string, right: string): boolean {
  return process.platform === "win32"
    ? resolve(left).toLowerCase() === resolve(right).toLowerCase()
    : resolve(left) === resolve(right);
}

export function assertSafeE2eEnvironment(
  configFile: string | undefined,
  workingDirectory: string,
): {
  dataDirectory: string;
  databasePath: string;
  files: readonly string[];
} {
  if (!configFile) throw new Error("Playwright config file is required.");

  const configRealPath = realpathSync.native(configFile);
  const projectDirectory = realpathSync.native(dirname(configRealPath));
  const workingDirectoryRealPath = realpathSync.native(workingDirectory);
  if (!samePath(workingDirectoryRealPath, projectDirectory)) {
    throw new Error("Run the E2E seed from the Playwright project root.");
  }

  const dataDirectory = join(projectDirectory, "data");
  if (!existsSync(dataDirectory)) mkdirSync(dataDirectory);
  const dataDirectoryStat = lstatSync(dataDirectory);
  const dataRealPath = realpathSync.native(dataDirectory);
  if (
    !dataDirectoryStat.isDirectory() ||
    dataDirectoryStat.isSymbolicLink() ||
    !samePath(dataRealPath, dataDirectory)
  ) {
    throw new Error("Project data directory must be the real root/data directory.");
  }

  const databasePath = join(dataRealPath, E2E_DATABASE_NAME);
  return {
    dataDirectory: dataRealPath,
    databasePath,
    files: [databasePath, `${databasePath}-wal`, `${databasePath}-shm`],
  };
}

function assertInsideDataDirectory(path: string, dataRealPath: string): void {
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
    !samePath(path, resolve(parentRealPath, basename(path)))
  ) {
    throw new Error(`Refusing to remove E2E database path outside project data: ${path}`);
  }

  if (existsSync(path)) {
    if (lstatSync(path).isSymbolicLink()) {
      throw new Error(`Refusing to remove symlinked E2E database path: ${path}`);
    }
    const fileRealPath = realpathSync.native(path);
    const relativeFile = relative(dataRealPath, fileRealPath);
    if (
      relativeFile.startsWith("..") ||
      !samePath(resolve(dataRealPath, relativeFile), fileRealPath)
    ) {
      throw new Error(`Refusing to remove E2E database path outside project data: ${path}`);
    }
  }
}

export default function seedE2eContent(config: FullConfig): void {
  const environment = assertSafeE2eEnvironment(
    config.configFile,
    process.cwd(),
  );

  for (const path of environment.files) {
    assertInsideDataDirectory(path, environment.dataDirectory);
    if (existsSync(path)) unlinkSync(path);
  }

  const db = openDatabase(environment.databasePath);
  try {
    migrate(db);
  } finally {
    db.close();
  }
}
