import { z } from "zod";
import {
  anomalyTypes,
  evidenceChecklists,
  type DiagnosisDraft,
} from "@/src/features/diagnoses/model";
import { diagnosisRepository } from "@/src/features/diagnoses/repository";
import { openDatabase } from "@/src/lib/db/connection";
import { migrate } from "@/src/lib/db/migrate";
import { OWNER_ID } from "@/src/lib/owner";

const text = z.string().max(10_000);
const requiredText = z.string().trim().min(1).max(10_000);

const createInput = z.object({
  name: z.string().trim().min(1).max(200),
  anomalyType: z.enum(anomalyTypes),
  anomalyFact: requiredText,
});

const updateInput = z.object({
  id: z.uuid(),
  status: z.enum(["ongoing", "completed"]),
  currentStep: z.number().int().min(1).max(6),
  changeFacts: text,
  evidenceChecks: z.array(z.string().max(100)).max(5),
  evidenceNotes: text,
  primaryJudgment: text,
  alternativeExplanation: text,
  falsifyingEvidence: text,
  validationFacts: text,
  judgmentConfirmed: z.enum(["", "yes", "partly", "no"]),
  teacherSupport: text,
  confirmedProblem: text,
  action: text,
  responsible: z.string().max(200),
  validationMetric: text,
  reviewDate: z.union([z.literal(""), z.iso.date()]),
  resultImproved: z.enum(["", "yes", "partly", "no"]),
  effectiveAction: text,
  ineffectiveAction: text,
  nextCheck: text,
});

function hasCompletedFlow(draft: DiagnosisDraft) {
  return draft.currentStep === 6 &&
    draft.changeFacts.trim() !== "" &&
    draft.evidenceChecks.length > 0 &&
    draft.evidenceNotes.trim() !== "" &&
    draft.primaryJudgment.trim() !== "" &&
    draft.alternativeExplanation.trim() !== "" &&
    draft.falsifyingEvidence.trim() !== "" &&
    draft.validationFacts.trim() !== "" &&
    draft.judgmentConfirmed !== "" &&
    draft.teacherSupport.trim() !== "" &&
    draft.confirmedProblem.trim() !== "" &&
    draft.action.trim() !== "" &&
    draft.responsible.trim() !== "" &&
    draft.validationMetric.trim() !== "" &&
    draft.reviewDate !== "" &&
    draft.resultImproved !== "" &&
    draft.effectiveAction.trim() !== "" &&
    draft.ineffectiveAction.trim() !== "" &&
    draft.nextCheck.trim() !== "";
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_diagnosis" }, { status: 400 });
  }
  const parsed = createInput.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid_diagnosis" }, { status: 400 });
  }

  const db = openDatabase();
  try {
    migrate(db);
    return Response.json(
      diagnosisRepository(db).create({ ownerId: OWNER_ID, ...parsed.data }),
      { status: 201 },
    );
  } finally {
    db.close();
  }
}

export async function PATCH(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_diagnosis" }, { status: 400 });
  }
  const parsed = updateInput.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid_diagnosis" }, { status: 400 });
  }

  const { id, ...draft } = parsed.data;
  const db = openDatabase();
  try {
    migrate(db);
    const repository = diagnosisRepository(db);
    const diagnosis = repository.get(OWNER_ID, id);
    if (!diagnosis) {
      return Response.json({ error: "diagnosis_not_found" }, { status: 404 });
    }
    const allowedChecks = new Set<string>(evidenceChecklists[diagnosis.anomalyType]);
    if (
      draft.evidenceChecks.some((item) => !allowedChecks.has(item)) ||
      (draft.status === "completed" && !hasCompletedFlow(draft))
    ) {
      return Response.json({ error: "invalid_diagnosis" }, { status: 400 });
    }
    return Response.json(repository.update(OWNER_ID, id, draft)!);
  } finally {
    db.close();
  }
}
