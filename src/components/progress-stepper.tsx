import type { LearningStage } from "@/src/types/learning";

const stages = [
  "进入本章",
  "理解系统",
  "照见自己",
  "行动设计",
  "创建 Artifact",
  "实践复盘",
] as const;

export function ProgressStepper({
  learningStage,
}: Readonly<{ learningStage: LearningStage }>) {
  return (
    <nav aria-label="章节学习阶段">
      <ol className="progress-stepper">
        {stages.map((stage, index) => (
          <li key={stage} aria-current={index === 1 && learningStage === "understanding" ? "step" : undefined}>
            <span>{index + 1}</span>
            {stage}
          </li>
        ))}
      </ol>
    </nav>
  );
}
