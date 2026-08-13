import { join, resolve } from "node:path";

export const PROJECT_DIRECTORY = process.cwd();
export const DATA_DIRECTORY = join(PROJECT_DIRECTORY, "data");
export const BACKUP_DIRECTORY = join(PROJECT_DIRECTORY, "backups");
export const RUNTIME_DIRECTORY = join(PROJECT_DIRECTORY, ".runtime");
export const SERVER_STATE_PATH = join(RUNTIME_DIRECTORY, "server.json");

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
