export const anomalyTypes = ["homework", "attendance", "refund_complaint"] as const;
export type AnomalyType = (typeof anomalyTypes)[number];

export const anomalyTypeLabels: Record<AnomalyType, string> = {
  homework: "作业",
  attendance: "出勤",
  refund_complaint: "退费/投诉",
};

export const evidenceChecklists: Record<AnomalyType, readonly string[]> = {
  homework: [
    "作业难度",
    "未提交学生分布",
    "布置、提醒与批改情况",
    "同期出勤",
    "家长反馈",
  ],
  attendance: [
    "班级或时段集中度",
    "调课、换老师或难度变化",
    "缺勤学生共性",
    "老师是否联系",
  ],
  refund_complaint: [
    "此前出勤、作业或满意度变化",
    "家长原始诉求",
    "老师已有沟通",
    "课程、排课或服务因素",
  ],
};

export const diagnosisSteps = [
  "看变化",
  "查证据",
  "作判断",
  "去验证",
  "定动作",
  "看结果",
] as const;

export type DiagnosisStatus = "ongoing" | "completed";
export type Confirmation = "" | "yes" | "partly" | "no";

export type Diagnosis = {
  id: string;
  ownerId: string;
  name: string;
  anomalyType: AnomalyType;
  anomalyFact: string;
  status: DiagnosisStatus;
  currentStep: number;
  changeFacts: string;
  evidenceChecks: string[];
  evidenceNotes: string;
  primaryJudgment: string;
  alternativeExplanation: string;
  falsifyingEvidence: string;
  validationFacts: string;
  judgmentConfirmed: Confirmation;
  teacherSupport: string;
  confirmedProblem: string;
  action: string;
  responsible: string;
  validationMetric: string;
  reviewDate: string;
  resultImproved: Confirmation;
  effectiveAction: string;
  ineffectiveAction: string;
  nextCheck: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type DiagnosisDraft = Pick<
  Diagnosis,
  | "currentStep"
  | "changeFacts"
  | "evidenceChecks"
  | "evidenceNotes"
  | "primaryJudgment"
  | "alternativeExplanation"
  | "falsifyingEvidence"
  | "validationFacts"
  | "judgmentConfirmed"
  | "teacherSupport"
  | "confirmedProblem"
  | "action"
  | "responsible"
  | "validationMetric"
  | "reviewDate"
  | "resultImproved"
  | "effectiveAction"
  | "ineffectiveAction"
  | "nextCheck"
  | "status"
>;
