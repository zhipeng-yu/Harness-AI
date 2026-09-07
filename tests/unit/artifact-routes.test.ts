import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PUT as putActionPlan } from "@/app/api/action-plans/route";
import { POST as postArtifact } from "@/app/api/artifacts/route";
import { PATCH as patchArtifact } from "@/app/api/artifacts/[artifactId]/route";
import { actionPlanRepository } from "@/src/features/actions/repository";
import { artifactRepository } from "@/src/features/artifacts/repository";
import { openDatabase } from "@/src/lib/db/connection";
import { migrate } from "@/src/lib/db/migrate";

const actionPlanBody = {
  chapterId: "chapter-01",
  problem: "Too many priorities",
  action: "Choose one outcome",
  successCriteria: "One outcome shipped",
};

const artifactBody = {
  chapterId: "chapter-01",
  title: "Focus system",
  problem: "Too many priorities",
  principles: "Choose one constraint",
  rules: "One outcome each morning",
  successCriteria: "One meaningful outcome shipped",
};

function jsonRequest(url: string, method: string, body: unknown) {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function malformedRequest(url: string, method: string, body: string) {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body,
  });
}

function patchRequest(artifactId: string, body: unknown) {
  return patchArtifact(
    jsonRequest(`http://localhost/api/artifacts/${artifactId}`, "PATCH", body),
    { params: Promise.resolve({ artifactId }) },
  );
}

beforeEach(() => {
  process.env.HARNESS_DB_PATH = join(
    mkdtempSync(join(tmpdir(), "harness-artifact-routes-")),
    "test.sqlite",
  );
  process.env.HARNESS_TEST = "1";
  process.env.HARNESS_CONTENT_FIXTURE = "published-chapter";
});

afterEach(() => {
  delete process.env.HARNESS_DB_PATH;
  delete process.env.HARNESS_TEST;
  delete process.env.HARNESS_CONTENT_FIXTURE;
});

describe("action-plan and Artifact route validation", () => {
  it.each([
    [
      "action plan",
      (body: string) =>
        putActionPlan(malformedRequest("http://localhost/api/action-plans", "PUT", body)),
      "invalid_action_plan",
    ],
    [
      "Artifact creation",
      (body: string) =>
        postArtifact(malformedRequest("http://localhost/api/artifacts", "POST", body)),
      "invalid_artifact",
    ],
    [
      "Artifact transition",
      (body: string) =>
        patchArtifact(
          malformedRequest(
            "http://localhost/api/artifacts/missing",
            "PATCH",
            body,
          ),
          { params: Promise.resolve({ artifactId: "missing" }) },
        ),
      "invalid_artifact_transition",
    ],
  ])("rejects malformed JSON for %s", async (_name, request, error) => {
    const response = await request('{"truncated":');

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error });
  });

  it("rejects invalid and unpublished action-plan chapters", async () => {
    const invalid = await putActionPlan(
      jsonRequest("http://localhost/api/action-plans", "PUT", {
        ...actionPlanBody,
        successCriteria: "",
      }),
    );
    const unpublished = await putActionPlan(
      jsonRequest("http://localhost/api/action-plans", "PUT", {
        ...actionPlanBody,
        chapterId: "chapter-03",
      }),
    );

    expect(invalid.status).toBe(400);
    await expect(invalid.json()).resolves.toEqual({ error: "invalid_action_plan" });
    expect(unpublished.status).toBe(404);
    await expect(unpublished.json()).resolves.toEqual({
      error: "chapter_not_published",
    });
  });

  it("rejects invalid and unpublished Artifact creation", async () => {
    const invalid = await postArtifact(
      jsonRequest("http://localhost/api/artifacts", "POST", {
        ...artifactBody,
        rules: "",
      }),
    );
    const unpublished = await postArtifact(
      jsonRequest("http://localhost/api/artifacts", "POST", {
        ...artifactBody,
        chapterId: "chapter-03",
      }),
    );

    expect(invalid.status).toBe(400);
    await expect(invalid.json()).resolves.toEqual({ error: "invalid_artifact" });
    expect(unpublished.status).toBe(404);
    await expect(unpublished.json()).resolves.toEqual({
      error: "chapter_not_published",
    });
  });

  it.each([
    {},
    { event: "submit_review", actualResult: "result" },
    { event: "delete" },
  ])("rejects invalid Artifact transition input %#", async (body) => {
    const response = await patchRequest("missing", body);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "invalid_artifact_transition",
    });
  });
});

describe("action-plan and Artifact route persistence", () => {
  it("upserts the action plan for the fixed local owner", async () => {
    const response = await putActionPlan(
      jsonRequest("http://localhost/api/action-plans", "PUT", {
        ...actionPlanBody,
        ownerId: "owner-other",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ownerId: "owner-local",
      ...actionPlanBody,
    });
    const db = openDatabase(process.env.HARNESS_DB_PATH);
    try {
      expect(
        actionPlanRepository(db).get("owner-local", "chapter-01"),
      ).toMatchObject(actionPlanBody);
      expect(
        actionPlanRepository(db).get("owner-other", "chapter-01"),
      ).toBeUndefined();
    } finally {
      db.close();
    }
  });

  it("creates version 1 for the fixed local owner", async () => {
    const response = await postArtifact(
      jsonRequest("http://localhost/api/artifacts", "POST", {
        ...artifactBody,
        ownerId: "owner-other",
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      ownerId: "owner-local",
      chapterId: artifactBody.chapterId,
      title: artifactBody.title,
      status: "draft",
      currentVersion: 1,
      versions: [
        {
          version: 1,
          problem: artifactBody.problem,
          principles: artifactBody.principles,
          rules: artifactBody.rules,
          successCriteria: artifactBody.successCriteria,
        },
      ],
    });
  });

  it("returns the same 404 for missing and other-owner Artifacts", async () => {
    const db = openDatabase(process.env.HARNESS_DB_PATH);
    migrate(db);
    db.prepare(
      "INSERT INTO owners (id, display_name, created_at) VALUES (?, ?, ?)",
    ).run("owner-other", "Other", "2026-08-13T00:00:00.000Z");
    const foreign = artifactRepository(db).createWithVersion({
      ownerId: "owner-other",
      ...artifactBody,
    });
    db.close();

    const missing = await patchRequest("does-not-exist", {
      event: "start_practice",
    });
    const otherOwner = await patchRequest(foreign.id, {
      event: "start_practice",
    });

    expect(missing.status).toBe(404);
    expect(otherOwner.status).toBe(404);
    await expect(missing.json()).resolves.toEqual({ error: "artifact_not_found" });
    await expect(otherOwner.json()).resolves.toEqual({
      error: "artifact_not_found",
    });
  });

  it("returns server state through practice, review, and next-version creation", async () => {
    const createdResponse = await postArtifact(
      jsonRequest("http://localhost/api/artifacts", "POST", artifactBody),
    );
    const created = (await createdResponse.json()) as { id: string };

    const started = await patchRequest(created.id, { event: "start_practice" });
    expect(await started.json()).toEqual({ status: "in_practice", version: 1 });
    const ready = await patchRequest(created.id, { event: "mark_review_ready" });
    expect(await ready.json()).toEqual({ status: "review_ready", version: 1 });
    const reviewed = await patchRequest(created.id, {
      event: "submit_review",
      actualResult: "Shipped the chosen outcome",
      effective: "Choosing before opening messages",
      nextChange: "Shorten the focus window",
      createNextVersion: true,
    });
    expect(await reviewed.json()).toEqual({ status: "draft", version: 2 });
  });

  it("can create the next version after completing review", async () => {
    const createdResponse = await postArtifact(
      jsonRequest("http://localhost/api/artifacts", "POST", artifactBody),
    );
    const created = (await createdResponse.json()) as { id: string };
    await patchRequest(created.id, { event: "start_practice" });
    await patchRequest(created.id, { event: "mark_review_ready" });
    const reviewed = await patchRequest(created.id, {
      event: "submit_review",
      actualResult: "Shipped the chosen outcome",
      effective: "Choosing before opening messages",
      nextChange: "Shorten the focus window",
      createNextVersion: false,
    });
    expect(await reviewed.json()).toEqual({ status: "reviewed", version: 1 });

    const next = await patchRequest(created.id, {
      event: "create_next_version",
    });
    expect(await next.json()).toEqual({ status: "draft", version: 2 });
  });

  it("returns a conflict without changing an illegal transition", async () => {
    const createdResponse = await postArtifact(
      jsonRequest("http://localhost/api/artifacts", "POST", artifactBody),
    );
    const created = (await createdResponse.json()) as { id: string };

    const response = await patchRequest(created.id, {
      event: "mark_review_ready",
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "illegal_artifact_transition",
    });
    const db = openDatabase(process.env.HARNESS_DB_PATH);
    try {
      expect(
        artifactRepository(db).getByChapter("owner-local", "chapter-01")?.status,
      ).toBe("draft");
    } finally {
      db.close();
    }
  });
});
