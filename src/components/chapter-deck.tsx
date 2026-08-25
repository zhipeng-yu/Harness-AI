"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { ChapterDefinition } from "@/content/schema";

type PublishedChapter = Extract<ChapterDefinition, { status: "published" }>;

type SlideItem = Readonly<{
  title: string;
  summary?: string;
}>;

type SlideDetail = Readonly<{
  heading: string;
  body: string;
}>;

type ChapterSlide = Readonly<{
  id: string;
  eyebrow: string;
  title: string;
  lead: string;
  items?: readonly SlideItem[];
  details?: readonly SlideDetail[];
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
  const coreSlides = chapter.coreStructure.map((item, index) => ({
    id: `core-${index + 1}`,
    eyebrow: `理解系统 · ${String(index + 1).padStart(2, "0")}`,
    title: item.title,
    lead: summarize(item.body),
    details: [{ heading: item.title, body: item.body }],
    visual: (index + 1) % visuals.length,
  }));

  const explanationSlides = inGroups(chapter.explanation, 2).map((group, index) => ({
    id: `explanation-${index + 1}`,
    eyebrow: "深入理解",
    title: group[0].heading,
    lead: summarize(group[0].body),
    items: group.slice(1).map((item) => ({
      title: item.heading,
      summary: summarize(item.body),
    })),
    details: group.map((item) => ({ heading: item.heading, body: item.body })),
    visual: (index + 1) % visuals.length,
  }));

  const conceptSlides = inGroups(chapter.concepts, 5).map((group, index) => ({
      id: `concepts-${index + 1}`,
      eyebrow: "关键概念",
      title: index === 0 ? "把关键词连成系统" : "继续扩展你的概念地图",
      lead: "先抓住概念之间的关系，再打开讲义查看完整定义。",
      items: group.map((concept) => ({
        title: concept.term,
        summary: summarize(concept.meaning),
      })),
      details: group.map((concept) => ({ heading: concept.term, body: concept.meaning })),
      visual: (index + 4) % visuals.length,
    }));

  return [
    {
      id: "opening",
      eyebrow: `第 ${chapter.order} 章`,
      title: chapter.title,
      lead: chapter.problem,
      items: [{ title: "一句话理解", summary: chapter.oneSentence }],
      details: [
        { heading: "本章要解决的问题", body: chapter.problem },
        { heading: "一句话理解", body: chapter.oneSentence },
      ],
      visual: 0,
    },
    ...coreSlides,
    ...explanationSlides,
    ...conceptSlides,
    {
      id: "scenarios",
      eyebrow: "落到日常",
      title: "把语音放回真实场景",
      lead: chapter.scenarios[0],
      items: chapter.scenarios.slice(1, 4).map((scenario) => ({ title: scenario })),
      details: chapter.scenarios.map((scenario, index) => ({
        heading: `场景 ${index + 1}`,
        body: scenario,
      })),
      visual: 3,
    },
    {
      id: "misconceptions",
      eyebrow: "校正方向",
      title: "这些误区会把你拉回原点",
      lead: chapter.misconceptions[0],
      items: chapter.misconceptions.slice(1, 4).map((misconception) => ({
        title: misconception,
      })),
      details: chapter.misconceptions.map((misconception, index) => ({
        heading: `误区 ${index + 1}`,
        body: misconception,
      })),
      visual: 1,
    },
    {
      id: "practice",
      eyebrow: "从理解到行动",
      title: "让新能力与现实发生接触",
      lead: chapter.actionPrompt.question,
      visual: 7,
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
  const [notesOpen, setNotesOpen] = useState(false);
  const current = slides[currentIndex];
  const visual = visuals[current.visual];

  function goTo(index: number) {
    setCurrentIndex(Math.max(0, Math.min(index, slides.length - 1)));
    setNotesOpen(false);
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
        setNotesOpen(false);
      }
      if (event.key === "ArrowRight") {
        setCurrentIndex((index) => Math.min(slides.length - 1, index + 1));
        setNotesOpen(false);
      }
      if (event.key === "Escape") setNotesOpen(false);
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
          <h1>{current.title}</h1>
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
          <Image src={visual.src} alt={visual.alt} fill sizes="(max-width: 1180px) 52vw, 620px" />
        </div>

        {current.details?.length ? (
          <button
            type="button"
            className="chapter-deck__notes-button"
            aria-expanded={notesOpen}
            aria-controls={`deck-notes-${current.id}`}
            onClick={() => setNotesOpen(true)}
          >
            展开完整讲义
          </button>
        ) : null}

        {notesOpen && current.details ? (
          <aside
            id={`deck-notes-${current.id}`}
            className="chapter-deck__notes"
            aria-label={`${current.title}完整讲义`}
          >
            <div className="chapter-deck__notes-heading">
              <p>{current.eyebrow}</p>
              <h2>完整讲义</h2>
              <button type="button" onClick={() => setNotesOpen(false)}>
                返回幻灯片
              </button>
            </div>
            <div className="chapter-deck__notes-body">
              {current.details.map((detail) => (
                <section key={detail.heading}>
                  <h3>{detail.heading}</h3>
                  <p>{detail.body}</p>
                </section>
              ))}
            </div>
          </aside>
        ) : null}
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
