import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import initSqlJs from "sql.js";

const workspaceId = "ws-default";
const inboxProjectCode = "_INBOX";
const scriptDir = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/u, "$1");
const repoRoot = path.resolve(scriptDir, "..");
const fixturePath = path.join(repoRoot, "spec", "demo-workspace-data.json");

const options = parseArgs(process.argv.slice(2));
const dbPath = options.dbPath ?? resolveDefaultDbPath();
const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));

if (!fs.existsSync(dbPath)) {
  throw new Error(`Database not found: ${dbPath}`);
}

const backupPath = createBackup(dbPath);
const SQL = await initSqlJs({
  locateFile: (fileName) => path.join(repoRoot, "node_modules", "sql.js", "dist", fileName),
});
const db = new SQL.Database(fs.readFileSync(dbPath));
const now = new Date().toISOString();

try {
  resetDemoWorkspace(db, fixture, now);
  fs.writeFileSync(dbPath, Buffer.from(db.export()));
} finally {
  db.close();
}

console.log(`Demo data reset complete`);
console.log(`Database: ${dbPath}`);
console.log(`Backup:   ${backupPath}`);
console.log(`Projects: ${fixture.projects.length}`);
console.log(`Items:    ${fixture.projects.reduce((count, project) => count + project.tasks.length, 0)}`);

function resetDemoWorkspace(db, fixture, now) {
  exec(db, "BEGIN");
  try {
    ensureWorkspace(db, now);
    const removedItemIds = selectStrings(db, "SELECT id FROM item");
    const removedProjectIds = selectStrings(db, "SELECT id FROM project WHERE code != ?", [inboxProjectCode]);

    if (removedItemIds.length > 0) {
      runInChunks(db, "DELETE FROM recurrence_rule WHERE item_id IN", removedItemIds);
      runInChunks(db, "DELETE FROM item_tag WHERE item_id IN", removedItemIds);
    }
    if (removedProjectIds.length > 0) {
      runInChunks(db, "DELETE FROM dependency WHERE project_id IN", removedProjectIds);
      runInChunks(db, "DELETE FROM item WHERE project_id IN", removedProjectIds);
      runInChunks(db, "DELETE FROM project WHERE id IN", removedProjectIds);
    }
    run(db, "DELETE FROM item WHERE project_id IN (SELECT id FROM project WHERE code = ?)", [inboxProjectCode]);

    ensureInboxProject(db, now);

    for (const [projectIndex, project] of fixture.projects.entries()) {
      const projectId = `demo-project-${String(projectIndex + 1).padStart(2, "0")}`;
      const startDate = project.tasks[0].startDate;
      const endDate = project.tasks[project.tasks.length - 1].endDate;
      const progressCached =
        project.tasks.reduce((sum, task) => sum + Number(task.percentComplete ?? 0), 0) / project.tasks.length;
      const status = progressCached >= 100 ? "done" : progressCached > 0 ? "in_progress" : "not_started";

      run(
        db,
        `INSERT INTO project (
          id, workspace_id, portfolio_id, code, name, description, owner_name, status, priority, color,
          start_date, end_date, target_date, progress_cached, risk_level, archived, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          projectId,
          workspaceId,
          "2026_DEMO",
          project.code,
          project.name,
          project.description,
          project.ownerName,
          status,
          project.priority,
          project.color,
          startDate,
          endDate,
          endDate,
          Number(progressCached.toFixed(1)),
          "normal",
          0,
          now,
          now,
        ]
      );

      for (const [taskIndex, task] of project.tasks.entries()) {
        const taskId = `${projectId}-item-${String(taskIndex + 1).padStart(2, "0")}`;
        const type = task.type ?? "task";
        run(
          db,
          `INSERT INTO item (
            id, workspace_id, project_id, parent_id, wbs_code, type, title, note, status, priority,
            assignee_name, start_date, end_date, due_date, duration_days, percent_complete, estimate_hours,
            actual_hours, sort_order, is_scheduled, is_recurring, archived, created_at, updated_at, completed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            taskId,
            workspaceId,
            projectId,
            null,
            String(taskIndex + 1),
            type,
            task.title,
            "",
            task.status,
            project.priority,
            task.assigneeName,
            task.startDate,
            task.endDate,
            task.endDate,
            durationDays(task.startDate, task.endDate),
            Number(task.percentComplete ?? 0),
            type === "milestone" ? 0 : 16,
            0,
            taskIndex + 1,
            1,
            0,
            0,
            now,
            now,
            task.status === "done" ? task.endDate : null,
          ]
        );
      }
    }

    exec(db, "COMMIT");
  } catch (error) {
    exec(db, "ROLLBACK");
    throw error;
  }
}

function ensureWorkspace(db, now) {
  run(
    db,
    "INSERT OR IGNORE INTO workspace (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)",
    [workspaceId, "Default Workspace", now, now]
  );
}

function ensureInboxProject(db, now) {
  run(
    db,
    `INSERT OR IGNORE INTO project (
      id, workspace_id, code, name, description, owner_name, status, priority, color, archived, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ["inbox-project", workspaceId, inboxProjectCode, "Inbox", "", "", "not_started", "low", "", 0, now, now]
  );
}

function run(db, sql, params = []) {
  const statement = db.prepare(sql);
  try {
    statement.bind(params);
    statement.step();
  } finally {
    statement.free();
  }
}

function exec(db, sql) {
  db.exec(sql);
}

function selectStrings(db, sql, params = []) {
  const statement = db.prepare(sql);
  const values = [];
  try {
    statement.bind(params);
    while (statement.step()) {
      values.push(String(statement.get()[0]));
    }
    return values;
  } finally {
    statement.free();
  }
}

function runInChunks(db, prefix, values) {
  for (let index = 0; index < values.length; index += 500) {
    const chunk = values.slice(index, index + 500);
    const placeholders = chunk.map(() => "?").join(", ");
    run(db, `${prefix} (${placeholders})`, chunk);
  }
}

function durationDays(startDate, endDate) {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  return Math.floor((end - start) / 86400000) + 1;
}

function createBackup(dbPath) {
  const backupDir = path.join(path.dirname(dbPath), "..", "backups");
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, `sgc-demo-reset-backup-${formatTimestamp(new Date())}.sqlite`);
  fs.copyFileSync(dbPath, backupPath);
  return backupPath;
}

function formatTimestamp(date) {
  return date.toISOString().replace(/[-:]/gu, "").replace(/\.\d+Z$/u, "Z");
}

function resolveDefaultDbPath() {
  if (process.env.SGC_USER_DATA_DIR) {
    return path.join(process.env.SGC_USER_DATA_DIR, "data", "sgc.sqlite");
  }
  const appData = process.env.APPDATA ?? path.join(os.homedir(), "AppData", "Roaming");
  return path.join(appData, "sgc", "data", "sgc.sqlite");
}

function parseArgs(args) {
  const parsed = { dbPath: null };
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--db") {
      parsed.dbPath = path.resolve(args[index + 1] ?? "");
      index += 1;
    }
  }
  return parsed;
}
