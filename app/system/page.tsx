import type { DatabaseSync } from "node:sqlite";
import {
  artifactRepository,
  type Artifact,
} from "@/src/features/artifacts/repository";
import { openDatabase } from "@/src/lib/db/connection";
import { migrate } from "@/src/lib/db/migrate";
import { OWNER_ID } from "@/src/lib/owner";
import type { ArtifactStatus } from "@/src/types/learning";
import {
  artifactStatusLabels,
  SystemModuleCard,
} from "@/src/components/system-module-card";

export const dynamic = "force-dynamic";

const groupOrder: ArtifactStatus[] = [
  "in_practice",
  "review_ready",
  "draft",
  "reviewed",
  "archived",
];

export default function SystemPage() {
  let db: DatabaseSync | undefined;

  try {
    db = openDatabase();
    migrate(db);
    const artifacts = artifactRepository(db).listForOwner(OWNER_ID);
    const groups: Record<ArtifactStatus, Artifact[]> = {
      draft: [],
      in_practice: [],
      review_ready: [],
      reviewed: [],
      archived: [],
    };

    for (const artifact of artifacts) groups[artifact.status].push(artifact);

    return (
      <main>
        <h1>我的系统</h1>
        <p>查看从实践到复盘沉淀下来的个人 Harness System。</p>
        {artifacts.length === 0 ? <p>尚未创建系统模块。</p> : null}
        {groupOrder.map((status) =>
          groups[status].length > 0 ? (
            <section key={status} aria-labelledby={`${status}-heading`}>
              <h2 id={`${status}-heading`}>{artifactStatusLabels[status]}</h2>
              {groups[status].map((artifact) => (
                <SystemModuleCard key={artifact.id} module={artifact} />
              ))}
            </section>
          ) : null,
        )}
      </main>
    );
  } finally {
    db?.close();
  }
}
