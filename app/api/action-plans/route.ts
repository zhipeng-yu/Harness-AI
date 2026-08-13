import { z } from "zod";
import { getChapters } from "@/content/chapters/registry";
import { actionPlanRepository } from "@/src/features/actions/repository";
import { openDatabase } from "@/src/lib/db/connection";
import { migrate } from "@/src/lib/db/migrate";
import { OWNER_ID } from "@/src/lib/owner";

const actionPlanInput = z.object({
  chapterId: z.string().regex(/^chapter-(0[1-9]|1[0-8])$/),
  problem: z.string().trim().min(1),
  action: z.string().trim().min(1),
  successCriteria: z.string().trim().min(1),
});

export async function PUT(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_action_plan" }, { status: 400 });
  }

  const parsed = actionPlanInput.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid_action_plan" }, { status: 400 });
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
    return Response.json(
      actionPlanRepository(db).upsert({ ownerId: OWNER_ID, ...parsed.data }),
    );
  } finally {
    db.close();
  }
}
