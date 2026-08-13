import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { withTransaction } from "@/src/lib/db/connection";
import type { ArtifactEvent, ArtifactStatus } from "@/src/types/learning";
import { transitionArtifact } from "./lifecycle";

export type ArtifactTransitionEvent = Exclude<
  ArtifactEvent,
  "submit_review"
>;

export type ArtifactVersion = {
  id: string;
  artifactId: string;
  version: number;
  problem: string;
  principles: string;
  rules: string;
  successCriteria: string;
  revisionNote: string;
  createdAt: string;
};

export type ArtifactReview = {
  id: string;
  artifactId: string;
  artifactVersionId: string;
  actualResult: string;
  effective: string;
  nextChange: string;
  createdAt: string;
};

export type Artifact = {
  id: string;
  ownerId: string;
  chapterId: string;
  title: string;
  status: ArtifactStatus;
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  versions: ArtifactVersion[];
  reviews: ArtifactReview[];
};

type ArtifactRow = {
  id: string;
  owner_id: string;
  chapter_id: string;
  title: string;
  status: ArtifactStatus;
  current_version: number;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

type ArtifactVersionRow = {
  id: string;
  artifact_id: string;
  version: number;
  problem: string;
  principles: string;
  rules: string;
  success_criteria: string;
  revision_note: string;
  created_at: string;
};

type ArtifactReviewRow = {
  id: string;
  artifact_id: string;
  artifact_version_id: string;
  actual_result: string;
  effective: string;
  next_change: string;
  created_at: string;
};

type OwnedArtifactRow = ArtifactRow & { artifact_version_id: string };

export class ArtifactNotFoundError extends Error {
  constructor() {
    super("Artifact not found");
    this.name = "ArtifactNotFoundError";
  }
}

function mapVersion(row: ArtifactVersionRow): ArtifactVersion {
  return {
    id: row.id,
    artifactId: row.artifact_id,
    version: row.version,
    problem: row.problem,
    principles: row.principles,
    rules: row.rules,
    successCriteria: row.success_criteria,
    revisionNote: row.revision_note,
    createdAt: row.created_at,
  };
}

function mapReview(row: ArtifactReviewRow): ArtifactReview {
  return {
    id: row.id,
    artifactId: row.artifact_id,
    artifactVersionId: row.artifact_version_id,
    actualResult: row.actual_result,
    effective: row.effective,
    nextChange: row.next_change,
    createdAt: row.created_at,
  };
}

export function artifactRepository(db: DatabaseSync) {
  const artifactColumns = `
    id, owner_id, chapter_id, title, status, current_version,
    created_at, updated_at, archived_at
  `;
  const getByIdStatement = db.prepare(`
    SELECT ${artifactColumns}
    FROM artifacts
    WHERE owner_id = ? AND id = ?
  `);
  const getByChapterStatement = db.prepare(`
    SELECT ${artifactColumns}
    FROM artifacts
    WHERE owner_id = ? AND chapter_id = ? AND archived_at IS NULL
    ORDER BY updated_at DESC, id DESC
    LIMIT 1
  `);
  const listForOwnerStatement = db.prepare(`
    SELECT ${artifactColumns}
    FROM artifacts
    WHERE owner_id = ?
    ORDER BY updated_at DESC, id DESC
  `);
  const listVersionsStatement = db.prepare(`
    SELECT
      id, artifact_id, version, problem, principles, rules,
      success_criteria, revision_note, created_at
    FROM artifact_versions
    WHERE artifact_id = ?
    ORDER BY version
  `);
  const listReviewsStatement = db.prepare(`
    SELECT
      id, artifact_id, artifact_version_id, actual_result,
      effective, next_change, created_at
    FROM reviews
    WHERE artifact_id = ?
    ORDER BY created_at, id
  `);
  const requireOwnedStatement = db.prepare(`
    SELECT
      a.id, a.owner_id, a.chapter_id, a.title, a.status,
      a.current_version, a.created_at, a.updated_at, a.archived_at,
      v.id AS artifact_version_id
    FROM artifacts a
    JOIN artifact_versions v
      ON v.artifact_id = a.id AND v.version = a.current_version
    WHERE a.owner_id = ? AND a.id = ?
  `);
  const latestReviewStatement = db.prepare(`
    SELECT next_change
    FROM reviews
    WHERE artifact_id = ? AND artifact_version_id = ?
    ORDER BY created_at DESC, id DESC
    LIMIT 1
  `);
  const copyVersionStatement = db.prepare(`
    INSERT INTO artifact_versions (
      id, artifact_id, version, problem, principles, rules,
      success_criteria, revision_note, created_at
    )
    SELECT ?, artifact_id, ?, problem, principles, rules,
      success_criteria, ?, ?
    FROM artifact_versions
    WHERE artifact_id = ? AND version = ?
  `);
  const updateVersionAndStatusStatement = db.prepare(`
    UPDATE artifacts
    SET current_version = ?, status = ?, updated_at = ?
    WHERE id = ? AND owner_id = ?
  `);

  function hydrate(row: ArtifactRow): Artifact {
    return {
      id: row.id,
      ownerId: row.owner_id,
      chapterId: row.chapter_id,
      title: row.title,
      status: row.status,
      currentVersion: row.current_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      archivedAt: row.archived_at,
      versions: (
        listVersionsStatement.all(row.id) as ArtifactVersionRow[]
      ).map(mapVersion),
      reviews: (listReviewsStatement.all(row.id) as ArtifactReviewRow[]).map(
        mapReview,
      ),
    };
  }

  function getById(ownerId: string, artifactId: string): Artifact | undefined {
    const row = getByIdStatement.get(ownerId, artifactId) as
      | ArtifactRow
      | undefined;
    return row ? hydrate(row) : undefined;
  }

  function requireOwnedArtifact(
    ownerId: string,
    artifactId: string,
  ): OwnedArtifactRow {
    const row = requireOwnedStatement.get(ownerId, artifactId) as
      | OwnedArtifactRow
      | undefined;
    if (!row) throw new ArtifactNotFoundError();
    return row;
  }

  return {
    createWithVersion(input: {
      ownerId: string;
      chapterId: string;
      title: string;
      problem: string;
      principles: string;
      rules: string;
      successCriteria: string;
    }): Artifact {
      const artifactId = randomUUID();
      const now = new Date().toISOString();

      withTransaction(db, () => {
        db.prepare(`
          INSERT INTO artifacts (
            id, owner_id, chapter_id, title, status, current_version,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, 'draft', 1, ?, ?)
        `).run(
          artifactId,
          input.ownerId,
          input.chapterId,
          input.title,
          now,
          now,
        );
        db.prepare(`
          INSERT INTO artifact_versions (
            id, artifact_id, version, problem, principles, rules,
            success_criteria, revision_note, created_at
          ) VALUES (?, ?, 1, ?, ?, ?, ?, '', ?)
        `).run(
          randomUUID(),
          artifactId,
          input.problem,
          input.principles,
          input.rules,
          input.successCriteria,
          now,
        );
      });

      return getById(input.ownerId, artifactId)!;
    },

    transition(
      ownerId: string,
      artifactId: string,
      event: ArtifactTransitionEvent,
    ): { status: ArtifactStatus; version: number } {
      return withTransaction(db, () => {
        const artifact = requireOwnedArtifact(ownerId, artifactId);
        const status = transitionArtifact(artifact.status, event);
        const now = new Date().toISOString();
        if (event === "create_next_version") {
          const review = latestReviewStatement.get(
            artifact.id,
            artifact.artifact_version_id,
          ) as { next_change: string } | undefined;
          if (!review) throw new Error("Artifact review not found");
          const nextVersion = artifact.current_version + 1;
          copyVersionStatement.run(
            randomUUID(),
            nextVersion,
            review.next_change,
            now,
            artifact.id,
            artifact.current_version,
          );
          updateVersionAndStatusStatement.run(
            nextVersion,
            status,
            now,
            artifact.id,
            ownerId,
          );
          return { status, version: nextVersion };
        }
        db.prepare(`
          UPDATE artifacts
          SET status = ?, updated_at = ?, archived_at = CASE WHEN ? = 'archived' THEN ? ELSE archived_at END
          WHERE id = ? AND owner_id = ?
        `).run(status, now, status, now, artifact.id, ownerId);
        return { status, version: artifact.current_version };
      });
    },

    addReviewAndNextVersion(
      ownerId: string,
      artifactId: string,
      input: {
        actualResult: string;
        effective: string;
        nextChange: string;
        createNextVersion: boolean;
      },
    ): { status: ArtifactStatus; version: number } {
      return withTransaction(db, () => {
        const artifact = requireOwnedArtifact(ownerId, artifactId);
        const reviewedStatus = transitionArtifact(
          artifact.status,
          "submit_review",
        );
        const now = new Date().toISOString();
        db.prepare(`
          INSERT INTO reviews (
            id, artifact_id, artifact_version_id, actual_result,
            effective, next_change, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          randomUUID(),
          artifact.id,
          artifact.artifact_version_id,
          input.actualResult,
          input.effective,
          input.nextChange,
          now,
        );

        if (!input.createNextVersion) {
          db.prepare(`
            UPDATE artifacts
            SET status = ?, updated_at = ?
            WHERE id = ? AND owner_id = ?
          `).run(reviewedStatus, now, artifact.id, ownerId);
          return {
            status: reviewedStatus,
            version: artifact.current_version,
          };
        }

        const nextStatus = transitionArtifact(
          reviewedStatus,
          "create_next_version",
        );
        const nextVersion = artifact.current_version + 1;
        copyVersionStatement.run(
          randomUUID(),
          nextVersion,
          input.nextChange,
          now,
          artifact.id,
          artifact.current_version,
        );
        updateVersionAndStatusStatement.run(
          nextVersion,
          nextStatus,
          now,
          artifact.id,
          ownerId,
        );
        return { status: nextStatus, version: nextVersion };
      });
    },

    getByChapter(ownerId: string, chapterId: string): Artifact | undefined {
      const row = getByChapterStatement.get(ownerId, chapterId) as
        | ArtifactRow
        | undefined;
      return row ? hydrate(row) : undefined;
    },

    listForOwner(ownerId: string): Artifact[] {
      return (listForOwnerStatement.all(ownerId) as ArtifactRow[]).map(hydrate);
    },
  };
}
