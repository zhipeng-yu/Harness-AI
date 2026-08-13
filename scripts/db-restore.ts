import { resolve } from "node:path";
import { restoreBackup } from "@/src/lib/db/backup";
import { resolveDatabasePath } from "@/src/lib/paths";

async function main() {
  const [source, confirm] = process.argv.slice(2);

  if (!source || confirm !== "--confirm") {
    console.error("Usage: npm run db:restore -- <backup.sqlite> --confirm");
    process.exitCode = 2;
  } else {
    try {
      await restoreBackup({
        source: resolve(source),
        target: resolveDatabasePath(),
        confirm: true,
      });
      console.log(`Restored verified backup: ${resolve(source)}`);
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    }
  }
}

void main();
