import { DEFAULT_WORKSPACE_ID, type DatabaseManager } from "../../infra/db/database";
import type { ProjectSummary } from "../../shared/contracts";

interface ProjectRow {
  id: string;
  workspace_id: string;
  code: string;
  name: string;
  description: string;
  owner_name: string;
  status: ProjectSummary["status"];
  priority: ProjectSummary["priority"];
  color: string;
  start_date: string | null;
  end_date: string | null;
  target_date: string | null;
  progress_cached: number;
  risk_level: string;
  archived: number;
  created_at: string;
  updated_at: string;
}

export interface InsertProjectRow {
  id: string;
  code: string;
  name: string;
  description?: string;
  ownerName?: string;
  status: ProjectSummary["status"];
  priority: ProjectSummary["priority"];
  color?: string;
  createdAt: string;
  updatedAt: string;
}

export class ProjectRepository {
  constructor(private readonly db: DatabaseManager) {}

  list(): ProjectSummary[] {
    return this.listByCodes([]);
  }

  listByCodes(excludedCodes: string[]): ProjectSummary[] {
    const whereClause =
      excludedCodes.length === 0
        ? "WHERE archived = 0"
        : `WHERE archived = 0 AND code NOT IN (${excludedCodes.map(() => "?").join(", ")})`;
    return this.db
      .query<ProjectRow>(
        `SELECT
          id,
          workspace_id,
          code,
          name,
          description,
          owner_name,
          status,
          priority,
          color,
          start_date,
          end_date,
          target_date,
          progress_cached,
          risk_level,
          archived,
          created_at,
          updated_at
        FROM project
        ${whereClause}
        ORDER BY updated_at DESC, name ASC`,
        excludedCodes
      )
      .map(mapProjectRow);
  }

  getById(id: string): ProjectSummary | null {
    const rows = this.db.query<ProjectRow>(
      `SELECT
        id,
        workspace_id,
        code,
        name,
        description,
        owner_name,
        status,
        priority,
        color,
        start_date,
        end_date,
        target_date,
        progress_cached,
        risk_level,
        archived,
        created_at,
        updated_at
      FROM project
      WHERE id = ?`,
      [id]
    );

    return rows.length > 0 ? mapProjectRow(rows[0]) : null;
  }

  getByCode(code: string): ProjectSummary | null {
    const rows = this.db.query<ProjectRow>(
      `SELECT
        id,
        workspace_id,
        code,
        name,
        description,
        owner_name,
        status,
        priority,
        color,
        start_date,
        end_date,
        target_date,
        progress_cached,
        risk_level,
        archived,
        created_at,
        updated_at
      FROM project
      WHERE code = ?`,
      [code]
    );

    return rows.length > 0 ? mapProjectRow(rows[0]) : null;
  }

  insert(project: InsertProjectRow): void {
    this.db.run(
      `INSERT INTO project (
        id,
        workspace_id,
        code,
        name,
        description,
        owner_name,
        status,
        priority,
        color,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        project.id,
        DEFAULT_WORKSPACE_ID,
        project.code,
        project.name,
        project.description ?? "",
        project.ownerName ?? "",
        project.status,
        project.priority,
        project.color ?? "",
        project.createdAt,
        project.updatedAt,
      ]
    );
  }

  update(project: { id: string; name: string; code: string; updatedAt: string }): void {
    this.db.run("UPDATE project SET name = ?, code = ?, updated_at = ? WHERE id = ?", [
      project.name,
      project.code,
      project.updatedAt,
      project.id,
    ]);
  }

  updateDerived(project: {
    id: string;
    startDate: string | null;
    endDate: string | null;
    progressCached: number;
    updatedAt: string;
  }): void {
    this.db.run(
      `UPDATE project
      SET start_date = ?, end_date = ?, progress_cached = ?, updated_at = ?
      WHERE id = ?`,
      [project.startDate, project.endDate, project.progressCached, project.updatedAt, project.id]
    );
  }
}

function mapProjectRow(row: ProjectRow): ProjectSummary {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    code: row.code,
    name: row.name,
    description: row.description,
    ownerName: row.owner_name,
    status: row.status,
    priority: row.priority,
    color: row.color,
    startDate: row.start_date,
    endDate: row.end_date,
    targetDate: row.target_date,
    progressCached: row.progress_cached,
    riskLevel: row.risk_level,
    archived: row.archived === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
