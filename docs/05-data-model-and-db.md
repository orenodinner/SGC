# 05 Data Model and DB

## 5.1 保存方針
- SQLite を唯一の永続ストアとする
- local-first
- UI は repository / service 層経由でアクセスする
- 物理削除ではなく soft delete / archive を基本とする

## 5.2 エンティティ一覧
- workspace
- portfolio
- project
- item
- dependency
- tag
- item_tag
- template
- recurrence_rule
- calendar_rule
- app_setting
- import_job
- export_job
- audit_log

## 5.3 主要テーブル定義

### workspace
- id TEXT PK
- name TEXT NOT NULL
- created_at TEXT NOT NULL
- updated_at TEXT NOT NULL

### portfolio
- id TEXT PK
- workspace_id TEXT NOT NULL
- code TEXT NOT NULL
- name TEXT NOT NULL
- sort_order INTEGER NOT NULL DEFAULT 0
- archived INTEGER NOT NULL DEFAULT 0
- created_at TEXT NOT NULL
- updated_at TEXT NOT NULL

### project
- id TEXT PK
- workspace_id TEXT NOT NULL
- portfolio_id TEXT NULL
- code TEXT NOT NULL
- name TEXT NOT NULL
- description TEXT NOT NULL DEFAULT ''
- owner_name TEXT NOT NULL DEFAULT ''
- status TEXT NOT NULL
- priority TEXT NOT NULL
- color TEXT NOT NULL DEFAULT ''
- start_date TEXT NULL
- end_date TEXT NULL
- target_date TEXT NULL
- progress_cached REAL NOT NULL DEFAULT 0
- risk_level TEXT NOT NULL DEFAULT 'normal'
- archived INTEGER NOT NULL DEFAULT 0
- created_at TEXT NOT NULL
- updated_at TEXT NOT NULL

### item
- id TEXT PK
- workspace_id TEXT NOT NULL
- project_id TEXT NOT NULL
- parent_id TEXT NULL
- wbs_code TEXT NOT NULL DEFAULT ''
- type TEXT NOT NULL
- title TEXT NOT NULL
- note TEXT NOT NULL DEFAULT ''
- status TEXT NOT NULL
- priority TEXT NOT NULL
- assignee_name TEXT NOT NULL DEFAULT ''
- start_date TEXT NULL
- end_date TEXT NULL
- due_date TEXT NULL
- duration_days REAL NOT NULL DEFAULT 1
- percent_complete REAL NOT NULL DEFAULT 0
- estimate_hours REAL NOT NULL DEFAULT 0
- actual_hours REAL NOT NULL DEFAULT 0
- sort_order REAL NOT NULL DEFAULT 0
- is_scheduled INTEGER NOT NULL DEFAULT 0
- is_recurring INTEGER NOT NULL DEFAULT 0
- archived INTEGER NOT NULL DEFAULT 0
- created_at TEXT NOT NULL
- updated_at TEXT NOT NULL
- completed_at TEXT NULL

### dependency
- id TEXT PK
- project_id TEXT NOT NULL
- predecessor_item_id TEXT NOT NULL
- successor_item_id TEXT NOT NULL
- type TEXT NOT NULL DEFAULT 'finish_to_start'
- lag_days INTEGER NOT NULL DEFAULT 0
- created_at TEXT NOT NULL
- updated_at TEXT NOT NULL

### tag
- id TEXT PK
- workspace_id TEXT NOT NULL
- name TEXT NOT NULL
- color TEXT NOT NULL DEFAULT ''
- created_at TEXT NOT NULL
- updated_at TEXT NOT NULL

### item_tag
- item_id TEXT NOT NULL
- tag_id TEXT NOT NULL
- PRIMARY KEY (item_id, tag_id)

### template
- id TEXT PK
- workspace_id TEXT NOT NULL
- kind TEXT NOT NULL
- name TEXT NOT NULL
- body_json TEXT NOT NULL
- created_at TEXT NOT NULL
- updated_at TEXT NOT NULL

### recurrence_rule
- id TEXT PK
- item_id TEXT NOT NULL
- rrule_text TEXT NOT NULL
- next_occurrence_at TEXT NULL
- created_at TEXT NOT NULL
- updated_at TEXT NOT NULL

### app_setting
- key TEXT PK
- value_json TEXT NOT NULL
- updated_at TEXT NOT NULL

## 5.4 SQLite 初期DDL（案）

```sql
CREATE TABLE workspace (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE portfolio (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE project (
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

CREATE TABLE item (
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

CREATE TABLE dependency (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  predecessor_item_id TEXT NOT NULL,
  successor_item_id TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'finish_to_start',
  lag_days INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE tag (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE item_tag (
  item_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  PRIMARY KEY (item_id, tag_id)
);

CREATE INDEX idx_project_portfolio ON project(portfolio_id);
CREATE INDEX idx_item_project_parent ON item(project_id, parent_id);
CREATE INDEX idx_item_dates ON item(start_date, end_date);
CREATE INDEX idx_item_status ON item(status);
CREATE INDEX idx_dependency_project ON dependency(project_id);
CREATE UNIQUE INDEX uq_dependency_edge ON dependency(project_id, predecessor_item_id, successor_item_id, type);
```

## 5.5 派生計算

### WBSコード
- sibling の sort_order から再計算
- 例: `1`, `1.1`, `1.2`, `1.2.1`

### progress_cached
- project 単位の一覧性能のためキャッシュ
- item 更新時に project 集計を再計算

### risk_level
- overdue 件数、近接マイルストーン、blocked 件数から算出
- MVP の簡易ルール:
  - overdue >= 5 -> high
  - overdue 1..4 -> medium
  - blocked > 0 and next milestone <= 7日 -> high
  - それ以外 -> normal

## 5.6 サービス層

- `ProjectService`
- `ItemService`
- `TimelineService`
- `PortfolioService`
- `SchedulerService`
- `ExcelImportService`
- `ExcelExportService`
- `TemplateService`
- `BackupService`

## 5.7 日付取り扱い
- DB には ISO 8601 文字列で保存
- 日付のみは `YYYY-MM-DD`
- 日時は `YYYY-MM-DDTHH:mm:ss`
- UI ではローカルタイムで表示
- ロジックでは date utility を経由する

## 5.8 削除ポリシー
- MVP はアーカイブ優先
- ハード削除は import rollback やテスト時の内部用途に限定
