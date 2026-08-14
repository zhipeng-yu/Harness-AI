import { rmSync } from "node:fs";
import { join } from "node:path";

async function main() {
  const [projectRoot, mode] = process.argv.slice(2);
  if (!projectRoot || !mode) throw new Error("Missing worker arguments");
  process.chdir(projectRoot);

  const [{ createVerifiedBackup, restoreBackup }, { openDatabase }, { migrate }] =
    await Promise.all([
      import("@/src/lib/db/backup"),
      import("@/src/lib/db/connection"),
      import("@/src/lib/db/migrate"),
    ]);
  const source = join(projectRoot, "data", "source.sqlite");
  const db = openDatabase(source);
  migrate(db);
  db.close();

  const backup = await createVerifiedBackup(source, join(projectRoot, "backups"));
  if (mode === "backup") {
    console.log(backup.path);
    return;
  }

  rmSync(join(projectRoot, "data"), { recursive: true });
  await restoreBackup({
    source: backup.path,
    target: join(projectRoot, "data", "restored.sqlite"),
    confirm: true,
  });
  console.log(join(projectRoot, "data", "restored.sqlite"));
}

void main();
