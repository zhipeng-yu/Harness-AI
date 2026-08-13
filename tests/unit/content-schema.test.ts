import { chapterSchema } from "@/content/schema";
import { publishedChapterFixture } from "@/content/fixtures/e2e-published-chapter";

describe("chapter content contract", () => {
  it("accepts a fully reviewed published chapter", () => {
    expect(chapterSchema.parse(publishedChapterFixture).status).toBe("published");
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
});
