import { DEFAULT_WORKSPACE_ID, type DatabaseManager } from "../../infra/db/database";
import type { AppSettings } from "../../shared/contracts";
import { parseWorkingDayNumbers, serializeWorkingDayNumbers } from "../../domain/working-days";

interface AppSettingsRow {
  workspace_id: string;
  language: AppSettings["language"];
  theme: AppSettings["theme"];
  auto_backup_enabled: number;
  auto_backup_retention_limit: number;
  excel_default_priority: AppSettings["excelDefaultPriority"];
  excel_default_assignee: AppSettings["excelDefaultAssignee"];
  week_starts_on: AppSettings["weekStartsOn"];
  fy_start_month: number;
  show_roadmap_workload: number;
  working_day_numbers: string;
  default_view: AppSettings["defaultView"];
  created_at: string;
  updated_at: string;
}

export interface UpsertAppSettingsRow {
  language: AppSettings["language"];
  theme: AppSettings["theme"];
  autoBackupEnabled: AppSettings["autoBackupEnabled"];
  autoBackupRetentionLimit: AppSettings["autoBackupRetentionLimit"];
  excelDefaultPriority: AppSettings["excelDefaultPriority"];
  excelDefaultAssignee: AppSettings["excelDefaultAssignee"];
  weekStartsOn: AppSettings["weekStartsOn"];
  fyStartMonth: number;
  showRoadmapWorkload: AppSettings["showRoadmapWorkload"];
  workingDayNumbers: AppSettings["workingDayNumbers"];
  defaultView: AppSettings["defaultView"];
  createdAt: string;
  updatedAt: string;
}

export class SettingsRepository {
  constructor(private readonly db: DatabaseManager) {}

  get(): AppSettings | null {
    const rows = this.db.query<AppSettingsRow>(
      `SELECT
        workspace_id,
        language,
        theme,
        auto_backup_enabled,
        auto_backup_retention_limit,
        excel_default_priority,
        excel_default_assignee,
        week_starts_on,
        fy_start_month,
        show_roadmap_workload,
        working_day_numbers,
        default_view,
        created_at,
        updated_at
      FROM app_settings
      WHERE workspace_id = ?`,
      [DEFAULT_WORKSPACE_ID]
    );

    return rows.length > 0 ? mapSettingsRow(rows[0]) : null;
  }

  insert(input: UpsertAppSettingsRow): void {
    this.db.run(
      `INSERT INTO app_settings (
        workspace_id,
        language,
        theme,
        auto_backup_enabled,
        auto_backup_retention_limit,
        excel_default_priority,
        excel_default_assignee,
        week_starts_on,
        fy_start_month,
        show_roadmap_workload,
        working_day_numbers,
        default_view,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        DEFAULT_WORKSPACE_ID,
        input.language,
        input.theme,
        input.autoBackupEnabled ? 1 : 0,
        input.autoBackupRetentionLimit,
        input.excelDefaultPriority,
        input.excelDefaultAssignee,
        input.weekStartsOn,
        input.fyStartMonth,
        input.showRoadmapWorkload ? 1 : 0,
        serializeWorkingDayNumbers(input.workingDayNumbers),
        input.defaultView,
        input.createdAt,
        input.updatedAt,
      ]
    );
  }

  update(input: Omit<UpsertAppSettingsRow, "createdAt">): void {
    this.db.run(
      `UPDATE app_settings
       SET language = ?, theme = ?, auto_backup_enabled = ?, auto_backup_retention_limit = ?, excel_default_priority = ?, excel_default_assignee = ?, week_starts_on = ?, fy_start_month = ?, show_roadmap_workload = ?, working_day_numbers = ?, default_view = ?, updated_at = ?
       WHERE workspace_id = ?`,
      [
        input.language,
        input.theme,
        input.autoBackupEnabled ? 1 : 0,
        input.autoBackupRetentionLimit,
        input.excelDefaultPriority,
        input.excelDefaultAssignee,
        input.weekStartsOn,
        input.fyStartMonth,
        input.showRoadmapWorkload ? 1 : 0,
        serializeWorkingDayNumbers(input.workingDayNumbers),
        input.defaultView,
        input.updatedAt,
        DEFAULT_WORKSPACE_ID,
      ]
    );
  }
}

function mapSettingsRow(row: AppSettingsRow): AppSettings {
  return {
    workspaceId: row.workspace_id,
    language: row.language,
    theme: row.theme,
    autoBackupEnabled: row.auto_backup_enabled === 1,
    autoBackupRetentionLimit: row.auto_backup_retention_limit,
    excelDefaultPriority: row.excel_default_priority,
    excelDefaultAssignee: row.excel_default_assignee,
    weekStartsOn: row.week_starts_on,
    fyStartMonth: row.fy_start_month,
    showRoadmapWorkload: row.show_roadmap_workload === 1,
    workingDayNumbers: parseWorkingDayNumbers(row.working_day_numbers),
    defaultView: row.default_view,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
