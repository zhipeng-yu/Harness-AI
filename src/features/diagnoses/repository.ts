import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type {
  AnomalyType,
  Confirmation,
  Diagnosis,
  DiagnosisDraft,
  DiagnosisStatus,
} from "./model";

type DiagnosisRow = {
  id: string;
  owner_id: string;
  name: string;
  anomaly_type: AnomalyType;
  anomaly_fact: string;
  status: DiagnosisStatus;
  current_step: number;
  change_facts: string;
  evidence_checks: string;
  evidence_notes: string;
  primary_judgment: string;
  alternative_explanation: string;
  falsifying_evidence: string;
  validation_facts: string;
  judgment_confirmed: Confirmation;
  teacher_support: string;
  confirmed_problem: string;
  action: string;
  responsible: string;
  validation_metric: string;
  review_date: string;
  result_improved: Confirmation;
  effective_action: string;
  ineffective_action: string;
  next_check: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

const columns = `
  id, owner_id, name, anomaly_type, anomaly_fact, status, current_step,
  change_facts, evidence_checks, evidence_notes, primary_judgment,
  alternative_explanation, falsifying_evidence, validation_facts,
  judgment_confirmed, teacher_support, confirmed_problem, action, responsible,
  validation_metric, review_date, result_improved, effective_action,
  ineffective_action, next_check, created_at, updated_at, completed_at
`;

function mapDiagnosis(row: DiagnosisRow): Diagnosis {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    anomalyType: row.anomaly_type,
    anomalyFact: row.anomaly_fact,
    status: row.status,
    currentStep: row.current_step,
    changeFacts: row.change_facts,
    evidenceChecks: JSON.parse(row.evidence_checks) as string[],
    evidenceNotes: row.evidence_notes,
    primaryJudgment: row.primary_judgment,
    alternativeExplanation: row.alternative_explanation,
    falsifyingEvidence: row.falsifying_evidence,
    validationFacts: row.validation_facts,
    judgmentConfirmed: row.judgment_confirmed,
    teacherSupport: row.teacher_support,
    confirmedProblem: row.confirmed_problem,
    action: row.action,
    responsible: row.responsible,
    validationMetric: row.validation_metric,
    reviewDate: row.review_date,
    resultImproved: row.result_improved,
    effectiveAction: row.effective_action,
    ineffectiveAction: row.ineffective_action,
    nextCheck: row.next_check,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  };
}

export function diagnosisRepository(db: DatabaseSync) {
  const getStatement = db.prepare(`SELECT ${columns} FROM diagnoses WHERE owner_id = ? AND id = ?`);
  const listStatement = db.prepare(`
    SELECT ${columns} FROM diagnoses
    WHERE owner_id = ?
    ORDER BY status ASC, updated_at DESC
  `);
  const createStatement = db.prepare(`
    INSERT INTO diagnoses (
      id, owner_id, name, anomaly_type, anomaly_fact, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const updateStatement = db.prepare(`
    UPDATE diagnoses SET
      status = ?, current_step = ?, change_facts = ?, evidence_checks = ?,
      evidence_notes = ?, primary_judgment = ?, alternative_explanation = ?,
      falsifying_evidence = ?, validation_facts = ?, judgment_confirmed = ?,
      teacher_support = ?, confirmed_problem = ?, action = ?, responsible = ?,
      validation_metric = ?, review_date = ?, result_improved = ?,
      effective_action = ?, ineffective_action = ?, next_check = ?,
      updated_at = ?, completed_at = ?
    WHERE owner_id = ? AND id = ?
  `);

  function get(ownerId: string, id: string) {
    const row = getStatement.get(ownerId, id) as DiagnosisRow | undefined;
    return row ? mapDiagnosis(row) : undefined;
  }

  return {
    get,

    listForOwner(ownerId: string): Diagnosis[] {
      return (listStatement.all(ownerId) as DiagnosisRow[]).map(mapDiagnosis);
    },

    create(input: {
      ownerId: string;
      name: string;
      anomalyType: AnomalyType;
      anomalyFact: string;
    }): Diagnosis {
      const id = randomUUID();
      const now = new Date().toISOString();
      createStatement.run(
        id,
        input.ownerId,
        input.name,
        input.anomalyType,
        input.anomalyFact,
        now,
        now,
      );
      return get(input.ownerId, id)!;
    },

    update(ownerId: string, id: string, draft: DiagnosisDraft): Diagnosis | undefined {
      const now = new Date().toISOString();
      updateStatement.run(
        draft.status,
        draft.currentStep,
        draft.changeFacts,
        JSON.stringify(draft.evidenceChecks),
        draft.evidenceNotes,
        draft.primaryJudgment,
        draft.alternativeExplanation,
        draft.falsifyingEvidence,
        draft.validationFacts,
        draft.judgmentConfirmed,
        draft.teacherSupport,
        draft.confirmedProblem,
        draft.action,
        draft.responsible,
        draft.validationMetric,
        draft.reviewDate,
        draft.resultImproved,
        draft.effectiveAction,
        draft.ineffectiveAction,
        draft.nextCheck,
        now,
        draft.status === "completed" ? now : null,
        ownerId,
        id,
      );
      return get(ownerId, id);
    },
  };
}
