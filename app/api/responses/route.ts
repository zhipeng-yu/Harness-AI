import { z } from "zod";
import { getChapters } from "@/content/chapters/registry";
import { responseRepository } from "@/src/features/responses/repository";
import { openDatabase } from "@/src/lib/db/connection";
import { migrate } from "@/src/lib/db/migrate";
import { OWNER_ID } from "@/src/lib/owner";

const responseInput = z.object({
  chapterId: z.string().regex(/^chapter-(0[1-9]|1[0-8])$/),
  promptId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)+$/),
  value: z.string(),
});

export async function PUT(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_response" }, { status: 400 });
  }

  const parsed = responseInput.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid_response" }, { status: 400 });
  }

  const chapter = getChapters().find((item) => item.id === parsed.data.chapterId);
  if (!chapter || chapter.status !== "published") {
    return Response.json({ error: "prompt_not_published" }, { status: 404 });
  }

  const promptIds = new Set([
    ...chapter.reflectionPrompts.map((prompt) => prompt.id),
    chapter.actionPrompt.id,
    ...chapter.reviewPrompts.map((prompt) => prompt.id),
  ]);
  if (!promptIds.has(parsed.data.promptId)) {
    return Response.json({ error: "prompt_not_published" }, { status: 404 });
  }

  const db = openDatabase();
  try {
    migrate(db);
    const saved = responseRepository(db).upsert({
      ownerId: OWNER_ID,
      chapterId: parsed.data.chapterId,
      promptId: parsed.data.promptId,
      value: parsed.data.value,
    });
    return Response.json(saved);
  } finally {
    db.close();
  }
}
