import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import DiagnosisPage from "@/app/diagnosis/page";
import { PATCH, POST } from "@/app/api/diagnoses/route";
import { diagnosisRepository } from "@/src/features/diagnoses/repository";
import { openDatabase } from "@/src/lib/db/connection";

function request(method: "POST" | "PATCH", body: unknown) {
  return new Request("http://localhost/api/diagnoses", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const completedDraft = {
  status: "completed",
  currentStep: 6,
  changeFacts: "连续三周未交人数上升",
  evidenceChecks: ["作业难度", "未提交学生分布"],
  evidenceNotes: "难度未变，未提交集中在同一组学生",
  primaryJudgment: "提醒没有覆盖到这组学生",
  alternativeExplanation: "学生本周活动较多",
  falsifyingEvidence: "提醒记录完整且学生已经确认收到",
  validationFacts: "沟通后发现群提醒被折叠",
  judgmentConfirmed: "yes",
  teacherSupport: "提供一对一提醒名单",
  confirmedProblem: "固定群提醒没有触达部分学生",
  action: "未交当天按名单单独联系",
  responsible: "主讲老师",
  validationMetric: "下周未交人数降至两人以内",
  reviewDate: "2026-09-30",
  resultImproved: "yes",
  effectiveAction: "单独联系有效",
  ineffectiveAction: "继续增加群提醒无效",
  nextCheck: "先检查未交学生分布",
} as const;

beforeEach(() => {
  process.env.HARNESS_DB_PATH = join(mkdtempSync(join(tmpdir(), "harness-diagnoses-")), "test.sqlite");
  process.env.HARNESS_TEST = "1";
});

afterEach(() => {
  delete process.env.HARNESS_DB_PATH;
  delete process.env.HARNESS_TEST;
});

describe("diagnosis API", () => {
  it("creates a case for owner-local and ignores a supplied owner", async () => {
    const response = await POST(request("POST", {
      name: "王老师作业异常",
      anomalyType: "homework",
      anomalyFact: "三周未交人数从 2 人增至 8 人",
      ownerId: "owner-other",
    }));

    expect(response.status).toBe(201);
    const saved = await response.json();
    expect(saved).toMatchObject({ ownerId: "owner-local", status: "ongoing", currentStep: 1 });

    const db = openDatabase(process.env.HARNESS_DB_PATH);
    try {
      expect(diagnosisRepository(db).listForOwner("owner-local")).toHaveLength(1);
      expect(diagnosisRepository(db).listForOwner("owner-other")).toHaveLength(0);
    } finally {
      db.close();
    }
  });

  it.each([
    { name: "", anomalyType: "homework", anomalyFact: "事实" },
    { name: "案例", anomalyType: "score", anomalyFact: "事实" },
    { name: "案例", anomalyType: "attendance", anomalyFact: "" },
  ])("rejects invalid creation input %#", async (body) => {
    const response = await POST(request("POST", body));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "invalid_diagnosis" });
  });

  it("rejects checklist items from another anomaly type", async () => {
    const created = await (await POST(request("POST", {
      name: "作业异常",
      anomalyType: "homework",
      anomalyFact: "未交人数增加",
    }))).json();
    const response = await PATCH(request("PATCH", {
      id: created.id,
      ...completedDraft,
      status: "ongoing",
      evidenceChecks: ["老师是否联系"],
    }));

    expect(response.status).toBe(400);
  });

  it("only completes a fully filled six-step case", async () => {
    const created = await (await POST(request("POST", {
      name: "作业异常",
      anomalyType: "homework",
      anomalyFact: "未交人数增加",
    }))).json();
    const incomplete = await PATCH(request("PATCH", {
      id: created.id,
      ...completedDraft,
      nextCheck: "",
    }));
    expect(incomplete.status).toBe(400);

    const response = await PATCH(request("PATCH", { id: created.id, ...completedDraft }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      id: created.id,
      ownerId: "owner-local",
      status: "completed",
      completedAt: expect.any(String),
    });
  });
});

describe("diagnosis page", () => {
  it("uses the temporary database and shows the fixed local workflow", () => {
    render(DiagnosisPage());
    expect(screen.getByRole("heading", { name: "教学诊断", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("暂无进行中的诊断案例。")).toBeInTheDocument();
    expect(screen.getByText("完成六步后，摘要卡会显示在这里。")).toBeInTheDocument();
  });
});
