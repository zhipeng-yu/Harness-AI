import { BACKUP_DIRECTORY, resolveDatabasePath } from "@/src/lib/paths";
import { createVerifiedBackup } from "@/src/lib/db/backup";

async function main() {
  try {
    const result = await createVerifiedBackup(
      resolveDatabasePath(),
      BACKUP_DIRECTORY,
      "manual",
    );
    console.log(
      `Verified backup: ${result.path} integrity=${result.integrity} owners=${result.ownerCount} migrations=${result.migrationCount}`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

void main();
