export interface Migration {
  id: string;
  sql: string;
}

export const migrations: Migration[] = [
  {
    id: "001_init_core",
    sql: `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS workspace (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS project (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        portfolio_id TEXT,
        code TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        owner_name TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL,
        priority TEXT NOT NULL,
        color TEXT NOT NULL DEFAULT '',
        start_date TEXT,
        end_date TEXT,
        target_date TEXT,
        progress_cached REAL NOT NULL DEFAULT 0,
        risk_level TEXT NOT NULL DEFAULT 'normal',
        archived INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS item (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        parent_id TEXT,
        wbs_code TEXT NOT NULL DEFAULT '',
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL,
        priority TEXT NOT NULL,
        assignee_name TEXT NOT NULL DEFAULT '',
        start_date TEXT,
        end_date TEXT,
        due_date TEXT,
        duration_days REAL NOT NULL DEFAULT 1,
        percent_complete REAL NOT NULL DEFAULT 0,
        estimate_hours REAL NOT NULL DEFAULT 0,
        actual_hours REAL NOT NULL DEFAULT 0,
        sort_order REAL NOT NULL DEFAULT 0,
        is_scheduled INTEGER NOT NULL DEFAULT 0,
        is_recurring INTEGER NOT NULL DEFAULT 0,
        archived INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_project_workspace ON project(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_item_project_parent ON item(project_id, parent_id);
      CREATE INDEX IF NOT EXISTS idx_item_status ON item(status);
    `,
  },
  {
    id: "002_add_tags",
    sql: `
      CREATE TABLE IF NOT EXISTS tag (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        name TEXT NOT NULL,
        color TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS item_tag (
        item_id TEXT NOT NULL,
        tag_id TEXT NOT NULL,
        PRIMARY KEY (item_id, tag_id)
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_tag_workspace_name ON tag(workspace_id, name);
      CREATE INDEX IF NOT EXISTS idx_item_tag_item ON item_tag(item_id);
    `,
  },
  {
    id: "003_add_dependencies",
    sql: `
      CREATE TABLE IF NOT EXISTS dependency (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        predecessor_item_id TEXT NOT NULL,
        successor_item_id TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'finish_to_start',
        lag_days INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_dependency_project ON dependency(project_id);
      CREATE UNIQUE INDEX IF NOT EXISTS uq_dependency_edge
        ON dependency(project_id, predecessor_item_id, successor_item_id, type);
    `,
  },
  {
    id: "004_add_recurrence_rules",
    sql: `
      CREATE TABLE IF NOT EXISTS recurrence_rule (
        id TEXT PRIMARY KEY,
        item_id TEXT NOT NULL,
        rrule_text TEXT NOT NULL,
        next_occurrence_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE UNIQUE INDEX IF NOT EXISTS uq_recurrence_rule_item
        ON recurrence_rule(item_id);
    `,
  },
  {
    id: "005_add_templates",
    sql: `
      CREATE TABLE IF NOT EXISTS template (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        name TEXT NOT NULL,
        body_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_template_workspace_kind
        ON template(workspace_id, kind, updated_at);
    `,
  },
  {
    id: "006_add_app_settings",
    sql: `
      CREATE TABLE IF NOT EXISTS app_settings (
        workspace_id TEXT PRIMARY KEY,
        week_starts_on TEXT NOT NULL DEFAULT 'monday',
        fy_start_month INTEGER NOT NULL DEFAULT 4,
        default_view TEXT NOT NULL DEFAULT 'home',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `,
  },
  {
    id: "007_add_working_day_numbers_to_app_settings",
    sql: `
      ALTER TABLE app_settings
      ADD COLUMN working_day_numbers TEXT NOT NULL DEFAULT '1,2,3,4,5';
    `,
  },
  {
    id: "008_add_language_to_app_settings",
    sql: `
      ALTER TABLE app_settings
      ADD COLUMN language TEXT NOT NULL DEFAULT 'ja';
    `,
  },
  {
    id: "009_add_theme_to_app_settings",
    sql: `
      ALTER TABLE app_settings
      ADD COLUMN theme TEXT NOT NULL DEFAULT 'light';
    `,
  },
  {
    id: "010_add_auto_backup_settings_to_app_settings",
    sql: `
      ALTER TABLE app_settings
      ADD COLUMN auto_backup_enabled INTEGER NOT NULL DEFAULT 1;

      ALTER TABLE app_settings
      ADD COLUMN auto_backup_retention_limit INTEGER NOT NULL DEFAULT 7;
    `,
  },
  {
    id: "011_add_excel_default_settings_to_app_settings",
    sql: `
      ALTER TABLE app_settings
      ADD COLUMN excel_default_priority TEXT NOT NULL DEFAULT 'medium';

      ALTER TABLE app_settings
      ADD COLUMN excel_default_assignee TEXT NOT NULL DEFAULT '';
    `,
  },
  {
    id: "012_add_roadmap_workload_setting_to_app_settings",
    sql: `
      ALTER TABLE app_settings
      ADD COLUMN show_roadmap_workload INTEGER NOT NULL DEFAULT 0;
    `,
  },
];
