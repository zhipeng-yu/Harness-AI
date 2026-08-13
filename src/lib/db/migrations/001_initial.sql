PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
) STRICT;

CREATE TABLE owners (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL
) STRICT;

CREATE TABLE chapter_progress (
  owner_id TEXT NOT NULL REFERENCES owners(id),
  chapter_id TEXT NOT NULL,
  learning_stage TEXT NOT NULL DEFAULT 'not_started'
    CHECK (learning_stage IN ('not_started', 'understanding', 'learned')),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (owner_id, chapter_id)
) STRICT;

CREATE TABLE responses (
  owner_id TEXT NOT NULL REFERENCES owners(id),
  chapter_id TEXT NOT NULL,
  prompt_id TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (owner_id, chapter_id, prompt_id)
) STRICT;

CREATE TABLE action_plans (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES owners(id),
  chapter_id TEXT NOT NULL,
  problem TEXT NOT NULL,
  action TEXT NOT NULL,
  success_criteria TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (owner_id, chapter_id)
) STRICT;

CREATE TABLE artifacts (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES owners(id),
  chapter_id TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'in_practice', 'review_ready', 'reviewed', 'archived')),
  current_version INTEGER NOT NULL DEFAULT 1 CHECK (current_version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT
) STRICT;

CREATE TABLE artifact_versions (
  id TEXT PRIMARY KEY,
  artifact_id TEXT NOT NULL REFERENCES artifacts(id),
  version INTEGER NOT NULL CHECK (version > 0),
  problem TEXT NOT NULL,
  principles TEXT NOT NULL,
  rules TEXT NOT NULL,
  success_criteria TEXT NOT NULL,
  revision_note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  UNIQUE (artifact_id, version)
) STRICT;

CREATE TABLE reviews (
  id TEXT PRIMARY KEY,
  artifact_id TEXT NOT NULL REFERENCES artifacts(id),
  artifact_version_id TEXT NOT NULL REFERENCES artifact_versions(id),
  actual_result TEXT NOT NULL,
  effective TEXT NOT NULL,
  next_change TEXT NOT NULL,
  created_at TEXT NOT NULL
) STRICT;

CREATE TABLE backup_records (
  id TEXT PRIMARY KEY,
  path TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('manual', 'automatic', 'pre_restore')),
  verified_at TEXT NOT NULL,
  created_at TEXT NOT NULL
) STRICT;

INSERT OR IGNORE INTO owners (id, display_name, created_at)
VALUES ('owner-local', '我的成长系统', CURRENT_TIMESTAMP);
