CREATE TABLE diagnoses (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES owners(id),
  name TEXT NOT NULL,
  anomaly_type TEXT NOT NULL
    CHECK (anomaly_type IN ('homework', 'attendance', 'refund_complaint')),
  anomaly_fact TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ongoing'
    CHECK (status IN ('ongoing', 'completed')),
  current_step INTEGER NOT NULL DEFAULT 1 CHECK (current_step BETWEEN 1 AND 6),
  change_facts TEXT NOT NULL DEFAULT '',
  evidence_checks TEXT NOT NULL DEFAULT '[]',
  evidence_notes TEXT NOT NULL DEFAULT '',
  primary_judgment TEXT NOT NULL DEFAULT '',
  alternative_explanation TEXT NOT NULL DEFAULT '',
  falsifying_evidence TEXT NOT NULL DEFAULT '',
  validation_facts TEXT NOT NULL DEFAULT '',
  judgment_confirmed TEXT NOT NULL DEFAULT ''
    CHECK (judgment_confirmed IN ('', 'yes', 'partly', 'no')),
  teacher_support TEXT NOT NULL DEFAULT '',
  confirmed_problem TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL DEFAULT '',
  responsible TEXT NOT NULL DEFAULT '',
  validation_metric TEXT NOT NULL DEFAULT '',
  review_date TEXT NOT NULL DEFAULT '',
  result_improved TEXT NOT NULL DEFAULT ''
    CHECK (result_improved IN ('', 'yes', 'partly', 'no')),
  effective_action TEXT NOT NULL DEFAULT '',
  ineffective_action TEXT NOT NULL DEFAULT '',
  next_check TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT
) STRICT;

CREATE INDEX diagnoses_owner_status_updated
  ON diagnoses (owner_id, status, updated_at DESC);
