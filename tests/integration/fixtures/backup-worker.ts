import { createVerifiedBackup } from "@/src/lib/db/backup";

async function main() {
  const [source, backupDir, startAtText] = process.argv.slice(2);
  if (!source || !backupDir || !startAtText) throw new Error("Missing worker arguments");

  const delay = Math.max(0, Number(startAtText) - Date.now());
  await new Promise((resolve) => setTimeout(resolve, delay));
  const result = await createVerifiedBackup(source, backupDir, "manual");
  console.log(result.path);
}

void main();
