import type { ChapterDefinition } from "../schema";

export const publishedChapterFixture: Extract<
  ChapterDefinition,
  { status: "published" }
> = {
  id: "chapter-01",
  slug: "chapter-01",
  order: 1,
  title: "测试用已发布章节",
  status: "published",
  problem: "这是用于端到端测试的合成内容，不代表任何未经审核的真实课程。",
  oneSentence: "用清晰的步骤把理解转化为可重复的行动。",
  coreStructure: [
    { title: "观察", body: "先准确描述当下发生的情况。" },
    { title: "行动", body: "选择一个小而明确的下一步。" },
  ],
  explanation: [{ heading: "从理解到行动", body: "把抽象想法写成可执行的具体动作。" }],
  concepts: [{ term: "最小行动", meaning: "能够立刻开始并获得反馈的下一步。" }],
  scenarios: ["当任务看起来太大时，先完成最小行动。"],
  misconceptions: ["等待完全准备好才开始，往往会延迟真实反馈。"],
  reflectionPrompts: [
    { id: "chapter-01-reflection-01", question: "我现在遇到什么问题？" },
  ],
  actionPrompt: { id: "chapter-01-action-01", question: "我接下来愿意采取什么最小行动？" },
  artifactTemplate: {
    title: "最小行动记录",
    fields: [
      { id: "chapter-01-artifact-problem", label: "当前问题" },
      { id: "chapter-01-artifact-action", label: "最小行动" },
      { id: "chapter-01-artifact-time", label: "开始时间" },
      { id: "chapter-01-artifact-result", label: "行动结果" },
    ],
  },
  reviewPrompts: [
    { id: "chapter-01-review-01", question: "我是否完成了计划中的行动？" },
    { id: "chapter-01-review-02", question: "这次行动带来了什么反馈？" },
    { id: "chapter-01-review-03", question: "下一次我会如何调整行动？" },
  ],
};
