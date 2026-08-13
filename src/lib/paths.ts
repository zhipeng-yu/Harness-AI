import { join } from "node:path";

export const MIGRATIONS_DIRECTORY = join(
  process.cwd(),
  "src",
  "lib",
  "db",
  "migrations",
);
