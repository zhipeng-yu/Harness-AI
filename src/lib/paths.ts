import { existsSync, lstatSync, mkdirSync, realpathSync } from "node:fs";
import { join, resolve } from "node:path";

export const PROJECT_DIRECTORY = realpathSync.native(process.cwd());
export const DATA_DIRECTORY = join(PROJECT_DIRECTORY, "data");
export const BACKUP_DIRECTORY = join(PROJECT_DIRECTORY, "backups");
export const RUNTIME_DIRECTORY = join(PROJECT_DIRECTORY, ".runtime");
export const SERVER_STATE_PATH = join(RUNTIME_DIRECTORY, "server.json");

export function ensureDirectProjectDirectory(name: "data" | "backups") {
  const directory = join(PROJECT_DIRECTORY, name);
  if (!existsSync(directory)) mkdirSync(directory);
  const stat = lstatSync(directory);
  const realDirectory = realpathSync.native(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink() || realDirectory !== directory) {
    throw new Error(`${name} must be a direct non-reparse project directory`);
  }
  return realDirectory;
}

export const MIGRATIONS_DIRECTORY = join(
  PROJECT_DIRECTORY,
  "src",
  "lib",
  "db",
  "migrations",
);

export function resolveDatabasePath() {
  return resolve(
    /* turbopackIgnore: true */
    PROJECT_DIRECTORY,
    process.env.HARNESS_DB_PATH ?? join("data", "harness.sqlite"),
  );
}
