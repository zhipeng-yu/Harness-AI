import { openDatabase } from "@/src/lib/db/connection";
import { migrate } from "@/src/lib/db/migrate";

const db = openDatabase();

try {
  const completed = migrate(db);
  console.log(`Applied ${completed.length} migration(s).`);
  for (const migration of completed) console.log(`- ${migration}`);
} finally {
  db.close();
}
