import type { DatabaseManager } from "../../infra/db/database";
import type { DependencyRecord, DependencyType } from "../../shared/contracts";

interface DependencyRow {
  id: string;
  project_id: string;
  predecessor_item_id: string;
  successor_item_id: string;
  type: DependencyType;
  lag_days: number;
  created_at: string;
  updated_at: string;
}

export interface InsertDependencyRow {
  id: string;
  projectId: string;
  predecessorItemId: string;
  successorItemId: string;
  type: DependencyType;
  lagDays: number;
  createdAt: string;
  updatedAt: string;
}

export class DependencyRepository {
  constructor(private readonly db: DatabaseManager) {}

  listByProject(projectId: string): DependencyRecord[] {
    return this.db
      .query<DependencyRow>(
        `SELECT
          id,
          project_id,
          predecessor_item_id,
          successor_item_id,
          type,
          lag_days,
          created_at,
          updated_at
        FROM dependency
        WHERE project_id = ?
        ORDER BY created_at ASC`,
        [projectId]
      )
      .map(mapDependencyRow);
  }

  getById(id: string): DependencyRecord | null {
    const rows = this.db.query<DependencyRow>(
      `SELECT
        id,
        project_id,
        predecessor_item_id,
        successor_item_id,
        type,
        lag_days,
        created_at,
        updated_at
      FROM dependency
      WHERE id = ?`,
      [id]
    );

    return rows.length > 0 ? mapDependencyRow(rows[0]) : null;
  }

  findByEdge(input: {
    projectId: string;
    predecessorItemId: string;
    successorItemId: string;
    type: DependencyType;
  }): DependencyRecord | null {
    const rows = this.db.query<DependencyRow>(
      `SELECT
        id,
        project_id,
        predecessor_item_id,
        successor_item_id,
        type,
        lag_days,
        created_at,
        updated_at
      FROM dependency
      WHERE project_id = ? AND predecessor_item_id = ? AND successor_item_id = ? AND type = ?`,
      [input.projectId, input.predecessorItemId, input.successorItemId, input.type]
    );

    return rows.length > 0 ? mapDependencyRow(rows[0]) : null;
  }

  insert(input: InsertDependencyRow): void {
    this.db.run(
      `INSERT INTO dependency (
        id,
        project_id,
        predecessor_item_id,
        successor_item_id,
        type,
        lag_days,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.projectId,
        input.predecessorItemId,
        input.successorItemId,
        input.type,
        input.lagDays,
        input.createdAt,
        input.updatedAt,
      ]
    );
  }

  delete(id: string): void {
    this.db.run("DELETE FROM dependency WHERE id = ?", [id]);
  }

  deleteBySuccessorItemIds(projectId: string, successorItemIds: string[]): void {
    if (successorItemIds.length === 0) {
      return;
    }

    const placeholders = successorItemIds.map(() => "?").join(", ");
    this.db.run(
      `DELETE FROM dependency
      WHERE project_id = ? AND successor_item_id IN (${placeholders})`,
      [projectId, ...successorItemIds]
    );
  }
}

function mapDependencyRow(row: DependencyRow): DependencyRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    predecessorItemId: row.predecessor_item_id,
    successorItemId: row.successor_item_id,
    type: row.type,
    lagDays: row.lag_days,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
