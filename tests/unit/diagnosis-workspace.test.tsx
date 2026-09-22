import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DiagnosisWorkspace } from "@/src/components/diagnosis-workspace";
import type { Diagnosis } from "@/src/features/diagnoses/model";

function diagnosis(overrides: Partial<Diagnosis> = {}): Diagnosis {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    ownerId: "owner-local",
    name: "王老师作业异常",
    anomalyType: "homework",
    anomalyFact: "未交人数连续三周上升",
    status: "ongoing",
    currentStep: 2,
    changeFacts: "从 2 人增加到 8 人",
    evidenceChecks: [],
    evidenceNotes: "",
    primaryJudgment: "",
    alternativeExplanation: "",
    falsifyingEvidence: "",
    validationFacts: "",
    judgmentConfirmed: "",
    teacherSupport: "",
    confirmedProblem: "",
    action: "",
    responsible: "",
    validationMetric: "",
    reviewDate: "",
    resultImproved: "",
    effectiveAction: "",
    ineffectiveAction: "",
    nextCheck: "",
    createdAt: "2026-09-22T00:00:00.000Z",
    updatedAt: "2026-09-22T00:00:00.000Z",
    completedAt: null,
    ...overrides,
  };
}

describe("DiagnosisWorkspace", () => {
  it("shows the fixed evidence branch for the selected anomaly type", () => {
    render(<DiagnosisWorkspace initialDiagnoses={[diagnosis()]} />);

    expect(screen.getByRole("checkbox", { name: "作业难度" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "未提交学生分布" })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "老师是否联系" })).not.toBeInTheDocument();
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
    expect(screen.queryByText(/分数|排名|积分/)).not.toBeInTheDocument();
  });

  it("renders a completed case as a read-only five-part summary", () => {
    render(<DiagnosisWorkspace initialDiagnoses={[diagnosis({
      status: "completed",
      currentStep: 6,
      evidenceChecks: ["作业难度"],
      evidenceNotes: "难度没有变化",
      primaryJudgment: "提醒没有触达",
      judgmentConfirmed: "yes",
      confirmedProblem: "提醒方式单一",
      action: "按名单联系",
      responsible: "主讲老师",
      validationMetric: "未交人数下降",
      reviewDate: "2026-09-30",
      resultImproved: "yes",
      effectiveAction: "名单联系",
      ineffectiveAction: "群提醒",
      nextCheck: "未交学生分布",
      completedAt: "2026-09-22T01:00:00.000Z",
    })]} />);

    for (const label of ["问题", "证据", "判断", "动作", "结果"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(within(screen.getByRole("article")).queryByRole("textbox")).not.toBeInTheDocument();
  });
});
