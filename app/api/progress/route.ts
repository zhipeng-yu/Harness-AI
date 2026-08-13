import { z } from "zod";
import { getChapters } from "@/content/chapters/registry";
import { progressRepository } from "@/src/features/progress/repository";
import { openDatabase } from "@/src/lib/db/connection";
import { migrate } from "@/src/lib/db/migrate";
import { OWNER_ID } from "@/src/lib/owner";

const progressInput = z.object({
  chapterId: z.string().regex(/^chapter-(0[1-9]|1[0-8])$/),
  learningStage: z.enum(["understanding", "learned"]),
});

export async function PUT(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_progress" }, { status: 400 });
  }

  const parsed = progressInput.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid_progress" }, { status: 400 });
  }

  const chapter = getChapters().find((item) => item.id === parsed.data.chapterId);
  if (!chapter || chapter.status !== "published") {
    return Response.json({ error: "chapter_not_published" }, { status: 404 });
  }

  const db = openDatabase();
  try {
    migrate(db);
    const saved = progressRepository(db).setLearningStage(
      OWNER_ID,
      parsed.data.chapterId,
      parsed.data.learningStage,
    );
    return Response.json(saved);
  } finally {
    db.close();
  }
}
