import { z } from "zod";
import { getChapters } from "@/content/chapters/registry";
import { artifactRepository } from "@/src/features/artifacts/repository";
import { openDatabase } from "@/src/lib/db/connection";
import { migrate } from "@/src/lib/db/migrate";
import { OWNER_ID } from "@/src/lib/owner";

const artifactInput = z.object({
  chapterId: z.string().regex(/^chapter-(0[1-9]|1[0-8])$/),
  title: z.string().trim().min(1),
  problem: z.string().trim().min(1),
  principles: z.string().trim().min(1),
  rules: z.string().trim().min(1),
  successCriteria: z.string().trim().min(1),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_artifact" }, { status: 400 });
  }

  const parsed = artifactInput.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid_artifact" }, { status: 400 });
  }

  const chapter = getChapters().find(
    (item) => item.id === parsed.data.chapterId,
  );
  if (!chapter || chapter.status !== "published") {
    return Response.json({ error: "chapter_not_published" }, { status: 404 });
  }

  const db = openDatabase();
  try {
    migrate(db);
    const created = artifactRepository(db).createWithVersion({
      ownerId: OWNER_ID,
      ...parsed.data,
    });
    return Response.json(created, { status: 201 });
  } finally {
    db.close();
  }
}
