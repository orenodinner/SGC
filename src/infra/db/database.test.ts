import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DatabaseManager } from "./database";

describe("DatabaseManager", () => {
  let tempDir: string;
  let dbPath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sgc-db-"));
    dbPath = path.join(tempDir, "data", "sgc.sqlite");
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("creates the SQLite file and base tables", async () => {
    const manager = new DatabaseManager(dbPath);
    await manager.initialize();

    const tables = manager.query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
    );

    expect(fs.existsSync(dbPath)).toBe(true);
    expect(tables.map((table) => table.name)).toContain("project");
    expect(tables.map((table) => table.name)).toContain("item");
    expect(tables.map((table) => table.name)).toContain("dependency");
    expect(tables.map((table) => table.name)).toContain("recurrence_rule");
    expect(tables.map((table) => table.name)).toContain("template");
    expect(tables.map((table) => table.name)).toContain("app_settings");
    expect(tables.map((table) => table.name)).toContain("workspace");

    const appSettingsColumns = manager.query<{ name: string }>(
      "PRAGMA table_info(app_settings)"
    );
    expect(appSettingsColumns.map((column) => column.name)).toContain("working_day_numbers");
    expect(appSettingsColumns.map((column) => column.name)).toContain("language");
    expect(appSettingsColumns.map((column) => column.name)).toContain("theme");
    expect(appSettingsColumns.map((column) => column.name)).toContain("auto_backup_enabled");
    expect(appSettingsColumns.map((column) => column.name)).toContain("auto_backup_retention_limit");
    expect(appSettingsColumns.map((column) => column.name)).toContain("excel_default_priority");
    expect(appSettingsColumns.map((column) => column.name)).toContain("excel_default_assignee");
    expect(appSettingsColumns.map((column) => column.name)).toContain("show_roadmap_workload");
  });

  it("creates and lists timestamped backup files", async () => {
    const manager = new DatabaseManager(dbPath);
    await manager.initialize();

    const firstBackup = manager.createBackup();
    const secondBackup = manager.createBackup();
    const backups = manager.listBackups();

    expect(fs.existsSync(firstBackup.filePath)).toBe(true);
    expect(fs.existsSync(secondBackup.filePath)).toBe(true);
    expect(firstBackup.fileName).toMatch(/^sgc-backup-\d{8}-\d{6}-\d{3}\.sqlite$/);
    expect(backups).toHaveLength(2);
    expect(backups[0].createdAt >= backups[1].createdAt).toBe(true);
  });

  it("reads a backup preview without mutating the current database", async () => {
    const manager = new DatabaseManager(dbPath);
    await manager.initialize();

    manager.run(
      `INSERT INTO project (
        id, workspace_id, code, name, status, priority, archived, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "prj-preview",
        "ws-default",
        "PRJ-PREVIEW",
        "Preview案件",
        "not_started",
        "medium",
        0,
        "2026-04-23T00:00:00.000Z",
        "2026-04-23T00:10:00.000Z",
      ]
    );
    manager.run(
      `INSERT INTO item (
        id, workspace_id, project_id, parent_id, wbs_code, type, title, note, status, priority,
        assignee_name, start_date, end_date, due_date, estimate_hours, percent_complete, actual_hours,
        duration_days, is_scheduled, is_recurring, archived, created_at, updated_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "itm-preview",
        "ws-default",
        "prj-preview",
        null,
        "1",
        "task",
        "Preview Item",
        "",
        "not_started",
        "medium",
        "",
        "2026-04-24",
        "2026-04-25",
        "2026-04-25",
        0,
        0,
        0,
        2,
        1,
        0,
        0,
        "2026-04-23T00:00:00.000Z",
        "2026-04-23T00:20:00.000Z",
        null,
      ]
    );

    const backup = manager.createBackup();
    const preview = await manager.previewBackup(backup.filePath);
    const liveProjects = manager.query<{ count: number }>(
      "SELECT COUNT(*) AS count FROM project WHERE code = ?",
      ["PRJ-PREVIEW"]
    );

    expect(preview).toMatchObject({
      projectCount: 1,
      itemCount: 1,
      latestUpdatedAt: "2026-04-23T00:20:00.000Z",
    });
    expect(liveProjects[0]?.count).toBe(1);
  });

  it("restores the database file from a backup and creates a safety backup", async () => {
    const manager = new DatabaseManager(dbPath);
    await manager.initialize();

    manager.run(
      `INSERT INTO project (
        id, workspace_id, code, name, status, priority, archived, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "prj-restore-base",
        "ws-default",
        "PRJ-RESTORE-BASE",
        "Restore Base",
        "not_started",
        "medium",
        0,
        "2026-04-23T00:00:00.000Z",
        "2026-04-23T00:00:00.000Z",
      ]
    );
    const backup = manager.createBackup();

    manager.run(
      `INSERT INTO project (
        id, workspace_id, code, name, status, priority, archived, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "prj-after-backup",
        "ws-default",
        "PRJ-AFTER-BACKUP",
        "After Backup",
        "not_started",
        "medium",
        0,
        "2026-04-23T00:10:00.000Z",
        "2026-04-23T00:10:00.000Z",
      ]
    );

    const safetyBackup = await manager.restoreBackup(backup.filePath);
    const restoredProjects = manager.query<{ code: string }>(
      "SELECT code FROM project WHERE code IN (?, ?) ORDER BY code",
      ["PRJ-RESTORE-BASE", "PRJ-AFTER-BACKUP"]
    );

    expect(fs.existsSync(safetyBackup.filePath)).toBe(true);
    expect(safetyBackup.filePath).not.toBe(backup.filePath);
    expect(restoredProjects.map((row) => row.code)).toEqual(["PRJ-RESTORE-BASE"]);
  });

  it("restores a backup file without an initialized live database instance", async () => {
    const manager = new DatabaseManager(dbPath);
    await manager.initialize();

    manager.run(
      `INSERT INTO project (
        id, workspace_id, code, name, status, priority, archived, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "prj-recovery-base",
        "ws-default",
        "PRJ-RECOVERY-BASE",
        "Recovery Base",
        "not_started",
        "medium",
        0,
        "2026-04-23T00:00:00.000Z",
        "2026-04-23T00:00:00.000Z",
      ]
    );
    const backup = manager.createBackup();

    fs.writeFileSync(dbPath, Buffer.from("broken-sqlite"));

    const recoveryManager = new DatabaseManager(dbPath);
    const safetyBackup = recoveryManager.restoreBackupFile(backup.filePath);
    await recoveryManager.initialize();
    const restoredProjects = recoveryManager.query<{ code: string }>(
      "SELECT code FROM project WHERE code = ?",
      ["PRJ-RECOVERY-BASE"]
    );

    expect(fs.existsSync(safetyBackup.filePath)).toBe(true);
    expect(safetyBackup.filePath).not.toBe(backup.filePath);
    expect(restoredProjects.map((row) => row.code)).toEqual(["PRJ-RECOVERY-BASE"]);
  });

  it("creates one auto backup per local day and prunes old auto backups only", async () => {
    const manager = new DatabaseManager(dbPath);
    await manager.initialize();

    for (let index = 0; index < 8; index += 1) {
      const autoBackup = manager.createBackup({
        kind: "auto",
        createdAt: `2026-04-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
      });
      const datedAt = new Date(`2026-04-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`);
      fs.utimesSync(autoBackup.filePath, datedAt, datedAt);
    }
    const manualBackup = manager.createBackup({
      kind: "manual",
      createdAt: "2026-04-08T12:00:00.000Z",
    });

    const firstRun = manager.ensureAutoBackup({
      now: new Date("2026-04-09T09:00:00+09:00"),
      retentionLimit: 7,
    });
    const secondRun = manager.ensureAutoBackup({
      now: new Date("2026-04-09T18:00:00+09:00"),
      retentionLimit: 7,
    });
    const backups = manager.listBackups();
    const autoBackups = backups.filter((entry) => entry.fileName.startsWith("sgc-auto-backup-"));

    expect(firstRun.createdBackup?.fileName).toMatch(/^sgc-auto-backup-\d{8}-\d{6}-\d{3}\.sqlite$/);
    expect(firstRun.prunedFileNames).toHaveLength(2);
    expect(secondRun.createdBackup).toBeNull();
    expect(autoBackups).toHaveLength(7);
    expect(backups.some((entry) => entry.fileName === manualBackup.fileName)).toBe(true);
  });
});
