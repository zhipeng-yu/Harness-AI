import { chapterSchema } from "@/content/schema";
import { publishedChapterFixture } from "@/content/fixtures/published-chapter";

async function loadRegistry(environment: Record<string, string | undefined> = {}) {
  vi.resetModules();
  vi.unstubAllEnvs();

  for (const [name, value] of Object.entries(environment)) {
    vi.stubEnv(name, value);
  }

  return import("@/content/chapters/registry");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("chapter content contract", () => {
  it("accepts a fully reviewed published chapter", () => {
    expect(chapterSchema.parse(publishedChapterFixture).status).toBe("published");
  });

  it.each([
    ["review prompts", "reviewPrompts", 4],
    ["Artifact fields", "artifactTemplate.fields", 5],
  ])("rejects published chapters with extra %s", (_label, path, expectedLength) => {
    const invalid = structuredClone(publishedChapterFixture);
    if (path === "reviewPrompts") {
      invalid.reviewPrompts.push({
        id: "chapter-01-review-04",
        question: "这条额外复盘提示不应被固定表单静默忽略。",
      });
    } else {
      invalid.artifactTemplate.fields.push({
        id: "chapter-01-artifact-extra",
        label: "额外字段",
      });
    }

    expect(path === "reviewPrompts" ? invalid.reviewPrompts : invalid.artifactTemplate.fields)
      .toHaveLength(expectedLength);
    expect(() => chapterSchema.parse(invalid)).toThrow();
  });

  it("rejects display text used as a prompt id", () => {
    const invalid = structuredClone(publishedChapterFixture);
    invalid.reflectionPrompts[0].id = "我现在遇到什么问题？";
    expect(() => chapterSchema.parse(invalid)).toThrow();
  });

  it("allows an awaiting-audio chapter without processed sections", () => {
    expect(
      chapterSchema.parse({
        id: "chapter-18",
        slug: "chapter-18",
        order: 18,
        title: "第18章节（等待音频）",
        status: "awaiting_audio",
      }).status,
    ).toBe("awaiting_audio");
  });

  it("rejects processed sections on an awaiting-audio chapter", () => {
    expect(() =>
      chapterSchema.parse({
        id: "chapter-18",
        slug: "chapter-18",
        order: 18,
        title: "第18章（等待音频）",
        status: "awaiting_audio",
        problem: publishedChapterFixture.problem,
      }),
    ).toThrow();
  });

  it("exposes exactly 18 unique awaiting-audio chapters by default", async () => {
    const { getChapters } = await loadRegistry();
    const chapters = getChapters();

    expect(chapters).toHaveLength(18);
    expect(chapters.every((chapter) => chapter.status === "awaiting_audio")).toBe(true);
    expect(new Set(chapters.map((chapter) => chapter.id)).size).toBe(18);
    expect(new Set(chapters.map((chapter) => chapter.slug)).size).toBe(18);
    expect(chapters.map((chapter) => chapter.order)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18,
    ]);
  });

  it("rejects a registry with an extra duplicate chapter", async () => {
    const { assertChapterRegistry, getChapters } = await loadRegistry();
    const chapters = getChapters();

    expect(assertChapterRegistry).toBeTypeOf("function");
    expect(() => assertChapterRegistry([...chapters, chapters[0]])).toThrow();
  });

  it("uses the published fixture only when both test environment variables are set", async () => {
    const production = await loadRegistry({ HARNESS_TEST: "1" });
    expect(production.getChapters()[0].status).toBe("awaiting_audio");

    const testRegistry = await loadRegistry({
      HARNESS_TEST: "1",
      HARNESS_CONTENT_FIXTURE: "published-chapter",
    });
    const chapters = testRegistry.getChapters();

    expect(chapters).toHaveLength(18);
    expect(chapters[0]).toEqual(publishedChapterFixture);
    expect(chapters.slice(1).every((chapter) => chapter.status === "awaiting_audio")).toBe(true);
  });
});
