import { publishedChapterFixture } from "../fixtures/published-chapter";
import { chapterSchema, type ChapterDefinition } from "../schema";
import { chapter01 } from "./chapter-01";
import { chapter02 } from "./chapter-02";
import { chapter03 } from "./chapter-03";
import { chapter04 } from "./chapter-04";
import {
  chapter05,
  chapter06,
  chapter07,
  chapter08,
  chapter09,
  chapter10,
  chapter11,
} from "./chapter-05-11";

const chapterCatalog: readonly ChapterDefinition[] = [
  chapter01,
  chapter02,
  chapter03,
  chapter04,
  chapter05,
  chapter06,
  chapter07,
  chapter08,
  chapter09,
  chapter10,
  chapter11,
  { id: "chapter-12", slug: "chapter-12", order: 12, title: "第12章（等待音频）", status: "awaiting_audio" },
  { id: "chapter-13", slug: "chapter-13", order: 13, title: "第13章（等待音频）", status: "awaiting_audio" },
  { id: "chapter-14", slug: "chapter-14", order: 14, title: "第14章（等待音频）", status: "awaiting_audio" },
  { id: "chapter-15", slug: "chapter-15", order: 15, title: "第15章（等待音频）", status: "awaiting_audio" },
  { id: "chapter-16", slug: "chapter-16", order: 16, title: "第16章（等待音频）", status: "awaiting_audio" },
  { id: "chapter-17", slug: "chapter-17", order: 17, title: "第17章（等待音频）", status: "awaiting_audio" },
  { id: "chapter-18", slug: "chapter-18", order: 18, title: "第18章（等待音频）", status: "awaiting_audio" },
];

const productionChapters = chapterCatalog.map((chapter) => chapterSchema.parse(chapter));
const testPublishedChapter = chapterSchema.parse(publishedChapterFixture);

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
    process.env.HARNESS_TEST === "1" &&
    process.env.HARNESS_CONTENT_FIXTURE === "published-chapter"
  ) {
    return [testPublishedChapter, ...productionChapters.slice(1)];
  }

  return productionChapters;
}

export function getChapterBySlug(slug: string): ChapterDefinition | undefined {
  return getChapters().find((chapter) => chapter.slug === slug);
}

export function getPublishedChapters(): readonly ChapterDefinition[] {
  return getChapters().filter((chapter) => chapter.status === "published");
}
