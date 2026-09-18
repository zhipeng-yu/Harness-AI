import { z } from "zod";
import {
  ArtifactNotEditableError,
  ArtifactNotFoundError,
  artifactRepository,
} from "@/src/features/artifacts/repository";
import { openDatabase } from "@/src/lib/db/connection";
import { migrate } from "@/src/lib/db/migrate";
import { OWNER_ID } from "@/src/lib/owner";

const artifactTransitionInput = z.discriminatedUnion("event", [
  z.object({ event: z.literal("start_practice") }),
  z.object({ event: z.literal("mark_review_ready") }),
  z.object({ event: z.literal("create_next_version") }),
  z.object({ event: z.literal("archive") }),
  z.object({
    event: z.literal("save_draft"),
    problem: z.string().trim().min(1),
    principles: z.string().trim().min(1),
    rules: z.string().trim().min(1),
    successCriteria: z.string().trim().min(1),
  }),
  z.object({
    event: z.literal("submit_review"),
    actualResult: z.string().trim().min(1),
    effective: z.string().trim().min(1),
    nextChange: z.string().trim().min(1),
    createNextVersion: z.boolean(),
  }),
]);

export async function PATCH(
  request: Request,
  { params }: Readonly<{ params: Promise<{ artifactId: string }> }>,
) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "invalid_artifact_transition" },
      { status: 400 },
    );
  }

  const parsed = artifactTransitionInput.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "invalid_artifact_transition" },
      { status: 400 },
    );
  }

  const { artifactId } = await params;
  const db = openDatabase();
  try {
    migrate(db);
    const repository = artifactRepository(db);
    if (parsed.data.event === "submit_review") {
      repository.addReviewAndNextVersion(OWNER_ID, artifactId, parsed.data);
    } else if (parsed.data.event === "save_draft") {
      repository.updateDraft(OWNER_ID, artifactId, parsed.data);
    } else {
      repository.transition(OWNER_ID, artifactId, parsed.data.event);
    }
    return Response.json(repository.getById(OWNER_ID, artifactId));
  } catch (error) {
    if (error instanceof ArtifactNotFoundError) {
      return Response.json({ error: "artifact_not_found" }, { status: 404 });
    }
    if (error instanceof ArtifactNotEditableError) {
      return Response.json({ error: "artifact_not_editable" }, { status: 409 });
    }
    if (
      error instanceof Error &&
      error.message.startsWith("Illegal artifact transition:")
    ) {
      return Response.json(
        { error: "illegal_artifact_transition" },
        { status: 409 },
      );
    }
    throw error;
  } finally {
    db.close();
  }
}
