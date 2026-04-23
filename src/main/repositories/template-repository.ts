import { DEFAULT_WORKSPACE_ID, type DatabaseManager } from "../../infra/db/database";
import { templateRecordSchema, type ProjectTemplateBody, type TemplateRecord, type WbsTemplateBody } from "../../shared/contracts";

interface TemplateRow {
  id: string;
  workspace_id: string;
  kind: TemplateRecord["kind"];
  name: string;
  body_json: string;
  created_at: string;
  updated_at: string;
}

export interface InsertTemplateRow {
  id: string;
  workspaceId?: string;
  kind: TemplateRecord["kind"];
  name: string;
  body: WbsTemplateBody | ProjectTemplateBody;
  createdAt: string;
  updatedAt: string;
}

export class TemplateRepository {
  constructor(private readonly db: DatabaseManager) {}

  getById(id: string): TemplateRecord | null {
    const rows = this.db.query<TemplateRow>(
      `SELECT id, workspace_id, kind, name, body_json, created_at, updated_at
       FROM template
       WHERE id = ?`,
      [id]
    );

    return rows[0] ? mapTemplateRow(rows[0]) : null;
  }

  list(): TemplateRecord[] {
    return this.db
      .query<TemplateRow>(
        `SELECT id, workspace_id, kind, name, body_json, created_at, updated_at
         FROM template
         ORDER BY updated_at DESC, created_at DESC`
      )
      .map(mapTemplateRow);
  }

  insert(template: InsertTemplateRow): void {
    this.db.run(
      `INSERT INTO template (
        id, workspace_id, kind, name, body_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        template.id,
        template.workspaceId ?? DEFAULT_WORKSPACE_ID,
        template.kind,
        template.name,
        JSON.stringify(template.body),
        template.createdAt,
        template.updatedAt,
      ]
    );
  }
}

function mapTemplateRow(row: TemplateRow): TemplateRecord {
  return templateRecordSchema.parse({
    id: row.id,
    workspaceId: row.workspace_id,
    kind: row.kind,
    name: row.name,
    body: JSON.parse(row.body_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}
