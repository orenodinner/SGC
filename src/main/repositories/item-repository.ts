import { DEFAULT_WORKSPACE_ID, type DatabaseManager } from "../../infra/db/database";
import type { ItemRecord } from "../../shared/contracts";

interface ItemRow {
  id: string;
  workspace_id: string;
  project_id: string;
  project_name?: string;
  parent_id: string | null;
  wbs_code: string;
  type: ItemRecord["type"];
  title: string;
  note: string;
  status: ItemRecord["status"];
  priority: ItemRecord["priority"];
  assignee_name: string;
  start_date: string | null;
  end_date: string | null;
  due_date: string | null;
  duration_days: number;
  percent_complete: number;
  estimate_hours: number;
  actual_hours: number;
  sort_order: number;
  is_scheduled: number;
  is_recurring: number;
  archived: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  tag_names: string;
}

export interface InsertItemRow {
  id: string;
  projectId: string;
  parentId: string | null;
  title: string;
  type: ItemRecord["type"];
  note: string;
  status: ItemRecord["status"];
  priority: ItemRecord["priority"];
  assigneeName: string;
  startDate: string | null;
  endDate: string | null;
  dueDate: string | null;
  estimateHours: number;
  durationDays: number;
  percentComplete?: number;
  actualHours?: number;
  isScheduled: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
}

export class ItemRepository {
  constructor(private readonly db: DatabaseManager) {}

  listByProject(projectId: string): ItemRecord[] {
    return this.db
      .query<ItemRow>(
        `${selectClause()}
        WHERE item.project_id = ? AND item.archived = 0
        GROUP BY item.id
        ORDER BY item.sort_order ASC, item.created_at ASC`,
        [projectId]
      )
      .map(mapItemRow);
  }

  getById(id: string): ItemRecord | null {
    const rows = this.db.query<ItemRow>(
      `${selectClause()}
      WHERE item.id = ?
      GROUP BY item.id`,
      [id]
    );

    return rows.length > 0 ? mapItemRow(rows[0]) : null;
  }

  listForDashboard(): ItemRecord[] {
    return this.db
      .query<ItemRow>(
        `${selectClause()}
        WHERE item.archived = 0
        GROUP BY item.id
        ORDER BY item.updated_at DESC`
      )
      .map(mapItemRow);
  }

  listInboxItems(inboxProjectId: string): ItemRecord[] {
    return this.listByProject(inboxProjectId);
  }

  insert(item: InsertItemRow): void {
    this.db.run(
      `INSERT INTO item (
        id,
        workspace_id,
        project_id,
        parent_id,
        type,
        title,
        note,
        status,
        priority,
        assignee_name,
        start_date,
        end_date,
        due_date,
        estimate_hours,
        percent_complete,
        actual_hours,
        duration_days,
        is_scheduled,
        sort_order,
        created_at,
        updated_at,
        completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
      [
        item.id,
        DEFAULT_WORKSPACE_ID,
        item.projectId,
        item.parentId,
        item.type,
        item.title,
        item.note,
        item.status,
        item.priority,
        item.assigneeName,
        item.startDate,
        item.endDate,
        item.dueDate,
        item.estimateHours,
        item.percentComplete ?? 0,
        item.actualHours ?? 0,
        item.durationDays,
        item.isScheduled ? 1 : 0,
        item.sortOrder,
        item.createdAt,
        item.updatedAt,
        item.completedAt ?? null,
      ]
    );
  }

  updateEditable(item: ItemRecord): void {
    this.db.run(
      `UPDATE item
      SET project_id = ?, parent_id = ?, title = ?, type = ?, note = ?, status = ?, priority = ?, percent_complete = ?, start_date = ?,
          end_date = ?, due_date = ?, assignee_name = ?, duration_days = ?, estimate_hours = ?, is_scheduled = ?, sort_order = ?, updated_at = ?,
          completed_at = ?
      WHERE id = ?`,
      [
        item.projectId,
        item.parentId,
        item.title,
        item.type,
        item.note,
        item.status,
        item.priority,
        item.percentComplete,
        item.startDate,
        item.endDate,
        item.dueDate,
        item.assigneeName,
        item.durationDays,
        item.estimateHours,
        item.isScheduled ? 1 : 0,
        item.sortOrder,
        item.updatedAt,
        item.completedAt,
        item.id,
      ]
    );
  }

  updateDerived(item: ItemRecord): void {
    this.db.run(
      `UPDATE item
      SET parent_id = ?, wbs_code = ?, status = ?, start_date = ?, end_date = ?,
          duration_days = ?, percent_complete = ?, sort_order = ?, updated_at = ?
      WHERE id = ?`,
      [
        item.parentId,
        item.wbsCode,
        item.status,
        item.startDate,
        item.endDate,
        item.durationDays,
        item.percentComplete,
        item.sortOrder,
        item.updatedAt,
        item.id,
      ]
    );
  }

  archiveMany(ids: string[], updatedAt: string): void {
    if (ids.length === 0) {
      return;
    }

    const placeholders = ids.map(() => "?").join(", ");
    this.db.run(
      `UPDATE item SET archived = 1, status = 'archived', updated_at = ? WHERE id IN (${placeholders})`,
      [updatedAt, ...ids]
    );
  }

  setRecurringFlag(itemId: string, isRecurring: boolean, updatedAt: string): void {
    this.db.run(
      `UPDATE item
       SET is_recurring = ?, updated_at = ?
       WHERE id = ?`,
      [isRecurring ? 1 : 0, updatedAt, itemId]
    );
  }

  nextSortOrder(projectId: string, parentId: string | null): number {
    const rows = this.db.query<{ max_sort_order: number | null }>(
      "SELECT MAX(sort_order) AS max_sort_order FROM item WHERE project_id = ? AND archived = 0 AND parent_id IS ?",
      [projectId, parentId]
    );

    return (rows[0]?.max_sort_order ?? 0) + 1;
  }
}

function mapItemRow(row: ItemRow): ItemRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    projectId: row.project_id,
    projectName: row.project_name,
    parentId: row.parent_id,
    wbsCode: row.wbs_code,
    type: row.type,
    title: row.title,
    note: row.note,
    status: row.status,
    priority: row.priority,
    assigneeName: row.assignee_name,
    startDate: row.start_date,
    endDate: row.end_date,
    dueDate: row.due_date,
    durationDays: row.duration_days,
    percentComplete: row.percent_complete,
    estimateHours: row.estimate_hours,
    actualHours: row.actual_hours,
    sortOrder: row.sort_order,
    isScheduled: row.is_scheduled === 1,
    isRecurring: row.is_recurring === 1,
    archived: row.archived === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
    tags: row.tag_names ? row.tag_names.split("\u001f").filter(Boolean) : [],
  };
}

function selectClause(): string {
  return `SELECT
    item.id,
    item.workspace_id,
    item.project_id,
    project.name AS project_name,
    item.parent_id,
    item.wbs_code,
    item.type,
    item.title,
    item.note,
    item.status,
    item.priority,
    item.assignee_name,
    item.start_date,
    item.end_date,
    item.due_date,
    item.duration_days,
    item.percent_complete,
    item.estimate_hours,
    item.actual_hours,
    item.sort_order,
    item.is_scheduled,
    item.is_recurring,
    item.archived,
    item.created_at,
    item.updated_at,
    item.completed_at,
    COALESCE(GROUP_CONCAT(tag.name, '\u001f'), '') AS tag_names
  FROM item
  LEFT JOIN project ON project.id = item.project_id
  LEFT JOIN item_tag ON item_tag.item_id = item.id
  LEFT JOIN tag ON tag.id = item_tag.tag_id`;
}
