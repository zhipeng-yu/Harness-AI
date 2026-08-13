import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

export type ActionPlan = {
  id: string;
  ownerId: string;
  chapterId: string;
  problem: string;
  action: string;
  successCriteria: string;
  createdAt: string;
  updatedAt: string;
};

type ActionPlanRow = {
  id: string;
  owner_id: string;
  chapter_id: string;
  problem: string;
  action: string;
  success_criteria: string;
  created_at: string;
  updated_at: string;
};

function mapActionPlan(row: ActionPlanRow): ActionPlan {
  return {
    id: row.id,
    ownerId: row.owner_id,
    chapterId: row.chapter_id,
    problem: row.problem,
    action: row.action,
    successCriteria: row.success_criteria,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function actionPlanRepository(db: DatabaseSync) {
  const getStatement = db.prepare(`
    SELECT id, owner_id, chapter_id, problem, action, success_criteria, created_at, updated_at
    FROM action_plans
    WHERE owner_id = ? AND chapter_id = ?
  `);
  const upsertStatement = db.prepare(`
    INSERT INTO action_plans (
      id, owner_id, chapter_id, problem, action, success_criteria, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (owner_id, chapter_id) DO UPDATE SET
      problem = excluded.problem,
      action = excluded.action,
      success_criteria = excluded.success_criteria,
      updated_at = excluded.updated_at
    WHERE action_plans.owner_id = excluded.owner_id
  `);

  function get(ownerId: string, chapterId: string): ActionPlan | undefined {
    const row = getStatement.get(ownerId, chapterId) as
      | ActionPlanRow
      | undefined;
    return row ? mapActionPlan(row) : undefined;
  }

  return {
    get,

    upsert(input: {
      ownerId: string;
      chapterId: string;
      problem: string;
      action: string;
      successCriteria: string;
    }): ActionPlan {
      const now = new Date().toISOString();
      upsertStatement.run(
        randomUUID(),
        input.ownerId,
        input.chapterId,
        input.problem,
        input.action,
        input.successCriteria,
        now,
        now,
      );
      return get(input.ownerId, input.chapterId)!;
    },
  };
}
