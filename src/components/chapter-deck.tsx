"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { ChapterDefinition } from "@/content/schema";

type PublishedChapter = Extract<ChapterDefinition, { status: "published" }>;

type SlideItem = Readonly<{
  title: string;
  summary?: string;
}>;

type ChapterSlide = Readonly<{
  eyebrow: string;
  title: string;
  lead: string;
  items?: readonly SlideItem[];
  visual: number;
  closing?: boolean;
}>;

const visuals = [
  {
    src: "/illustrations/chapter-01/voice-to-structure.png",
    alt: "人物说出思绪，语音将杂乱想法整理成结构化卡片",
  },
  {
    src: "/illustrations/chapter-01/thought-to-language.png",
    alt: "纠缠的思绪经过表达后变成清晰的信息分支",
  },
  {
    src: "/illustrations/chapter-01/output-multiplier.png",
    alt: "键盘逐个输入与语音连续输出形成鲜明对比",
  },
  {
    src: "/illustrations/chapter-01/create-anywhere.png",
    alt: "人在散步途中用语音捕捉并整理灵感",
  },
  {
    src: "/illustrations/chapter-01/experience-compounds.png",
    alt: "零散经验生长成可复用的知识树",
  },
  {
    src: "/illustrations/chapter-01/human-ai-sensemaking.png",
    alt: "AI 展开信息，人完成选择与最终判断",
  },
  {
    src: "/illustrations/chapter-01/morning-priming.png",
    alt: "清晨说出行动过程，让前进路径逐步清晰",
  },
  {
    src: "/illustrations/chapter-01/practice-feedback.png",
    alt: "连续实践形成作品，并从现实世界获得反馈",
  },
] as const;

const coreVisuals = [1, 2, 4, 5, 7] as const;
const explanationVisuals = [1, 2, 3, 5, 5, 6, 7] as const;
const conceptVisuals = [4, 5] as const;
const chapter02Visuals = [
  { src: "/illustrations/chapter-02/real-task.png", alt: "口述真实目标、整理规划卡片，再与 AI 搭建第一版作品" },
  { src: "/illustrations/chapter-02/learn-by-feedback.png", alt: "检查失败的积木桥，通过讨论与重建从错误中学习" },
  { src: "/illustrations/chapter-02/local-context.png", alt: "零散资料进入本地有序档案，供不同 AI 工具调用" },
  { src: "/illustrations/chapter-02/reason-verify.png", alt: "围绕多个作品方案进行比较、测试、检查与迭代" },
] as const;

function summarize(text: string): string {
  const firstSentence = text.split(/[。；]/, 1)[0]?.trim();
  return firstSentence ? `${firstSentence}。` : text;
}

function inGroups<T>(items: readonly T[], size: number): readonly (readonly T[])[] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, index * size + size),
  );
}

export function buildChapterSlides(chapter: PublishedChapter): readonly ChapterSlide[] {
  const isChapter02 = chapter.id === "chapter-02";
  const coreSlides = chapter.coreStructure.map((item, index) => ({
    eyebrow: `理解系统 · ${String(index + 1).padStart(2, "0")}`,
    title: item.title,
    lead: summarize(item.body),
    visual: isChapter02 ? index : coreVisuals[index] ?? 0,
  }));

  const explanationSlides = inGroups(chapter.explanation, 2).map((group, index) => ({
    eyebrow: "深入理解",
    title: group[0].heading,
    lead: summarize(group[0].body),
    items: group.slice(1).map((item) => ({
      title: item.heading,
      summary: summarize(item.body),
    })),
    visual: isChapter02 ? ([0, 1, 1, 2, 2, 3, 3][index] ?? 0) : explanationVisuals[index] ?? 0,
  }));

  const conceptSlides = inGroups(chapter.concepts, 5).map((group, index) => ({
      eyebrow: "关键概念",
      title: index === 0 ? "把关键词连成系统" : "继续扩展你的概念地图",
      lead: "先抓住概念之间的关系，理解它们如何组成同一套系统。",
      items: group.map((concept) => ({
        title: concept.term,
        summary: summarize(concept.meaning),
      })),
      visual: isChapter02 ? (index === 0 ? 1 : 2) : conceptVisuals[index] ?? 0,
    }));

  return [
    {
      eyebrow: `第 ${chapter.order} 章`,
      title: chapter.title,
      lead: chapter.problem,
      items: [{ title: "一句话理解", summary: chapter.oneSentence }],
      visual: 0,
    },
    ...coreSlides,
    ...explanationSlides,
    ...conceptSlides,
    {
      eyebrow: "落到日常",
      title: isChapter02 ? "把协作语感用在真实任务中" : "把语音放回真实场景",
      lead: chapter.scenarios[0],
      items: chapter.scenarios.slice(1, 4).map((scenario) => ({ title: scenario })),
      visual: isChapter02 ? 0 : 3,
    },
    {
      eyebrow: "校正方向",
      title: "这些误区会把你拉回原点",
      lead: chapter.misconceptions[0],
      items: chapter.misconceptions.slice(1, 4).map((misconception) => ({
        title: misconception,
      })),
      visual: 1,
    },
    {
      eyebrow: "从理解到行动",
      title: "让新能力与现实发生接触",
      lead: chapter.actionPrompt.question,
      visual: isChapter02 ? 3 : 7,
      closing: true,
    },
  ];
}

export function ChapterDeck({
  chapter,
  onEnterPractice,
}: Readonly<{
  chapter: PublishedChapter;
  onEnterPractice: () => void;
}>) {
  const slides = buildChapterSlides(chapter);
  const [currentIndex, setCurrentIndex] = useState(0);
  const current = slides[currentIndex];
  const chapterVisuals = chapter.id === "chapter-02" ? chapter02Visuals : visuals;
  const visual = chapterVisuals[current.visual] ?? chapterVisuals[0];

  function goTo(index: number) {
    setCurrentIndex(Math.max(0, Math.min(index, slides.length - 1)));
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.matches("input, textarea, select, [contenteditable='true']")
      ) return;
      if (event.key === "ArrowLeft") {
        setCurrentIndex((index) => Math.max(0, index - 1));
      }
      if (event.key === "ArrowRight") {
        setCurrentIndex((index) => Math.min(slides.length - 1, index + 1));
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [slides.length]);

  return (
    <section className="chapter-deck" aria-label="章节幻灯片">
      <header className="chapter-deck__header">
        <p>学习阶段 · 理解系统</p>
        <p aria-live="polite">
          {currentIndex + 1} / {slides.length}
        </p>
      </header>
      <div className="chapter-deck__progress" aria-hidden="true">
        <span style={{ width: `${((currentIndex + 1) / slides.length) * 100}%` }} />
      </div>

      <div className="chapter-deck__slide" aria-live="polite">
        <div className="chapter-deck__copy">
          <p className="chapter-deck__eyebrow">{current.eyebrow}</p>
          <h1>{current.title.replaceAll("Vibe Coding", "Vibe\u00a0Coding")}</h1>
          <p className="chapter-deck__lead">{current.lead}</p>

          {current.items?.length ? (
            <div className="chapter-deck__items">
              {current.items.map((item) => (
                <div key={item.title}>
                  <strong>{item.title}</strong>
                  {item.summary ? <span>{item.summary}</span> : null}
                </div>
              ))}
            </div>
          ) : null}

          {current.closing ? (
            <button type="button" onClick={onEnterPractice}>
              进入实践
            </button>
          ) : null}
        </div>

        <div className="chapter-deck__visual">
          <Image
            src={visual.src}
            alt={visual.alt}
            fill
            sizes="(max-width: 980px) 360px, (max-width: 1228px) 40vw, 472px"
            unoptimized
          />
        </div>

      </div>

      <footer className="chapter-deck__controls">
        <button
          type="button"
          className="chapter-deck__page-button"
          disabled={currentIndex === 0}
          onClick={() => goTo(currentIndex - 1)}
        >
          ← 上一页
        </button>
        <span>可使用键盘方向键翻页</span>
        <button
          type="button"
          className="chapter-deck__page-button"
          disabled={currentIndex === slides.length - 1}
          onClick={() => goTo(currentIndex + 1)}
        >
          下一页 →
        </button>
      </footer>
    </section>
  );
}
