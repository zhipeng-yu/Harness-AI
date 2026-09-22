import type { DatabaseSync } from "node:sqlite";
import { DiagnosisWorkspace } from "@/src/components/diagnosis-workspace";
import { diagnosisRepository } from "@/src/features/diagnoses/repository";
import { openDatabase } from "@/src/lib/db/connection";
import { migrate } from "@/src/lib/db/migrate";
import { OWNER_ID } from "@/src/lib/owner";

export const dynamic = "force-dynamic";

export default function DiagnosisPage() {
  let db: DatabaseSync | undefined;
  try {
    db = openDatabase();
    migrate(db);
    return (
      <main className="page page--diagnosis">
        <h1>教学诊断</h1>
        <p>从已发现的异常出发，按固定步骤查清问题、验证判断并复查动作。</p>
        <DiagnosisWorkspace initialDiagnoses={diagnosisRepository(db).listForOwner(OWNER_ID)} />
      </main>
    );
  } finally {
    db?.close();
  }
}
