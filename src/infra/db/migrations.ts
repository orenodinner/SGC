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
];
