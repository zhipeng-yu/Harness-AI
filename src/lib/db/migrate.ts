import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { MIGRATIONS_DIRECTORY } from "@/src/lib/paths";
import { withTransaction } from "./connection";

function orderedMigrationFiles() {
  return readdirSync(MIGRATIONS_DIRECTORY, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^\d+.*\.sql$/.test(entry.name))
    .map((entry) => ({
      name: entry.name,
      path: join(MIGRATIONS_DIRECTORY, entry.name),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function migrate(db: DatabaseSync): string[] {
  db.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL) STRICT",
  );
  const applied = new Set(
    db
      .prepare("SELECT id FROM schema_migrations")
      .all()
      .map((row) => String(row.id)),
  );
  const completed: string[] = [];

  for (const file of orderedMigrationFiles()) {
    if (applied.has(file.name)) continue;
    withTransaction(db, () => {
      db.exec(readFileSync(file.path, "utf8"));
      db.prepare(
        "INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)",
      ).run(file.name, new Date().toISOString());
    });
    completed.push(file.name);
  }

  return completed;
}
