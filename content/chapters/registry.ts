import { publishedChapterFixture } from "../fixtures/e2e-published-chapter";
import { chapterSchema, type ChapterDefinition } from "../schema";
import { chapter01 } from "./chapter-01";

const awaitingChapters: readonly ChapterDefinition[] = [
  chapter01,
  { id: "chapter-02", slug: "chapter-02", order: 2, title: "第2章（等待音频）", status: "awaiting_audio" },
  { id: "chapter-03", slug: "chapter-03", order: 3, title: "第3章（等待音频）", status: "awaiting_audio" },
  { id: "chapter-04", slug: "chapter-04", order: 4, title: "第4章（等待音频）", status: "awaiting_audio" },
  { id: "chapter-05", slug: "chapter-05", order: 5, title: "第5章（等待音频）", status: "awaiting_audio" },
  { id: "chapter-06", slug: "chapter-06", order: 6, title: "第6章（等待音频）", status: "awaiting_audio" },
  { id: "chapter-07", slug: "chapter-07", order: 7, title: "第7章（等待音频）", status: "awaiting_audio" },
  { id: "chapter-08", slug: "chapter-08", order: 8, title: "第8章（等待音频）", status: "awaiting_audio" },
  { id: "chapter-09", slug: "chapter-09", order: 9, title: "第9章（等待音频）", status: "awaiting_audio" },
  { id: "chapter-10", slug: "chapter-10", order: 10, title: "第10章（等待音频）", status: "awaiting_audio" },
  { id: "chapter-11", slug: "chapter-11", order: 11, title: "第11章（等待音频）", status: "awaiting_audio" },
  { id: "chapter-12", slug: "chapter-12", order: 12, title: "第12章（等待音频）", status: "awaiting_audio" },
  { id: "chapter-13", slug: "chapter-13", order: 13, title: "第13章（等待音频）", status: "awaiting_audio" },
  { id: "chapter-14", slug: "chapter-14", order: 14, title: "第14章（等待音频）", status: "awaiting_audio" },
  { id: "chapter-15", slug: "chapter-15", order: 15, title: "第15章（等待音频）", status: "awaiting_audio" },
  { id: "chapter-16", slug: "chapter-16", order: 16, title: "第16章（等待音频）", status: "awaiting_audio" },
  { id: "chapter-17", slug: "chapter-17", order: 17, title: "第17章（等待音频）", status: "awaiting_audio" },
  { id: "chapter-18", slug: "chapter-18", order: 18, title: "第18章（等待音频）", status: "awaiting_audio" },
];

const productionChapters = awaitingChapters.map((chapter) => chapterSchema.parse(chapter));
const e2ePublishedChapter = chapterSchema.parse(publishedChapterFixture);

export function assertChapterRegistry(chapters: readonly ChapterDefinition[]): void {
  const ids = new Set(chapters.map((chapter) => chapter.id));
  const slugs = new Set(chapters.map((chapter) => chapter.slug));
  const orders = new Set(chapters.map((chapter) => chapter.order));

  if (chapters.length !== 18 || ids.size !== 18 || slugs.size !== 18 || orders.size !== 18) {
    throw new Error("Chapter registry IDs, slugs, and orders must be unique.");
  }

  for (let order = 1; order <= 18; order += 1) {
    if (!orders.has(order)) {
      throw new Error("Chapter registry orders must equal 1 through 18.");
    }
  }
}

assertChapterRegistry(productionChapters);

export function getChapters(): readonly ChapterDefinition[] {
  if (
    process.env.HARNESS_E2E === "1" &&
    process.env.HARNESS_CONTENT_FIXTURE === "published-chapter"
  ) {
    return [e2ePublishedChapter, ...productionChapters.slice(1)];
  }

  return productionChapters;
}

export function getChapterBySlug(slug: string): ChapterDefinition | undefined {
  return getChapters().find((chapter) => chapter.slug === slug);
}

export function getPublishedChapters(): readonly ChapterDefinition[] {
  return getChapters().filter((chapter) => chapter.status === "published");
}
