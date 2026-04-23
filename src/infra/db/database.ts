import fs from "node:fs";
import path from "node:path";
import initSqlJs, { type Database as SqlJsDatabase, type SqlValue } from "sql.js";
import { migrations } from "./migrations";

export const DEFAULT_WORKSPACE_ID = "ws-default";
export const DEFAULT_AUTO_BACKUP_RETENTION_LIMIT = 7;

type BackupKind = "manual" | "auto" | "safety";

export class DatabaseManager {
  private db: SqlJsDatabase | null = null;
  private inTransaction = false;

  constructor(private readonly dbPath: string) {}

  async initialize(): Promise<void> {
    const wasmPath = require.resolve("sql.js/dist/sql-wasm.wasm");
    const SQL = await initSqlJs({
      locateFile: () => wasmPath,
    });

    const directory = path.dirname(this.dbPath);
    fs.mkdirSync(directory, { recursive: true });

    if (fs.existsSync(this.dbPath)) {
      this.db = new SQL.Database(fs.readFileSync(this.dbPath));
    } else {
      this.db = new SQL.Database();
    }

    this.execRaw("PRAGMA foreign_keys = ON;");
    this.execRaw("PRAGMA journal_mode = WAL;");
    this.runMigrations();
    this.ensureDefaultWorkspace();
    this.persist();
  }

  query<T>(sql: string, params: SqlValue[] = []): T[] {
    const statement = this.getDatabase().prepare(sql);
    statement.bind(params);
    const rows: T[] = [];

    while (statement.step()) {
      rows.push(statement.getAsObject() as T);
    }

    statement.free();
    return rows;
  }

  run(sql: string, params: SqlValue[] = []): void {
    const statement = this.getDatabase().prepare(sql);
    statement.bind(params);
    statement.step();
    statement.free();

    if (!this.inTransaction) {
      this.persist();
    }
  }

  execRaw(sql: string): void {
    this.getDatabase().exec(sql);
    if (!this.inTransaction) {
      this.persist();
    }
  }

  withTransaction<T>(callback: () => T): T {
    this.execWithoutPersist("BEGIN");
    this.inTransaction = true;

    try {
      const result = callback();
      this.execWithoutPersist("COMMIT");
      this.inTransaction = false;
      this.persist();
      return result;
    } catch (error) {
      this.execWithoutPersist("ROLLBACK");
      this.inTransaction = false;
      throw error;
    }
  }

  private runMigrations(): void {
    this.execWithoutPersist(
      "CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL);"
    );

    for (const migration of migrations) {
      const applied = this.query<{ id: string }>(
        "SELECT id FROM schema_migrations WHERE id = ?",
        [migration.id]
      );

      if (applied.length > 0) {
        continue;
      }

      this.withTransaction(() => {
        this.execWithoutPersist(migration.sql);
        this.run(
          "INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)",
          [migration.id, new Date().toISOString()]
        );
      });
    }
  }

  private ensureDefaultWorkspace(): void {
    const existing = this.query<{ id: string }>("SELECT id FROM workspace WHERE id = ?", [
      DEFAULT_WORKSPACE_ID,
    ]);

    if (existing.length > 0) {
      return;
    }

    const now = new Date().toISOString();
    this.run(
      "INSERT INTO workspace (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)",
      [DEFAULT_WORKSPACE_ID, "Default Workspace", now, now]
    );
  }

  private execWithoutPersist(sql: string): void {
    this.getDatabase().exec(sql);
  }

  private persist(): void {
    const database = this.getDatabase();
    const data = database.export();
    fs.writeFileSync(this.dbPath, Buffer.from(data));
  }

  createBackup(input: { kind?: BackupKind; createdAt?: string } = {}): {
    filePath: string;
    fileName: string;
    createdAt: string;
    sizeBytes: number;
  } {
    this.persist();
    return this.copyDatabaseFileToBackup(this.dbPath, input);
  }

  ensureAutoBackup(input: {
    now?: Date;
    retentionLimit?: number;
  } = {}): {
    createdBackup: {
      filePath: string;
      fileName: string;
      createdAt: string;
      sizeBytes: number;
    } | null;
    prunedFileNames: string[];
    retentionLimit: number;
  } {
    const now = input.now ?? new Date();
    const retentionLimit = input.retentionLimit ?? DEFAULT_AUTO_BACKUP_RETENTION_LIMIT;
    const todayKey = formatLocalDateKey(now);
    const existingBackups = this.listBackups();
    const hasAutoBackupToday = existingBackups.some(
      (backup) =>
        getBackupKindFromFileName(backup.fileName) === "auto" &&
        formatLocalDateKey(new Date(backup.createdAt)) === todayKey
    );

    const createdBackup = hasAutoBackupToday
      ? null
      : this.createBackup({ kind: "auto", createdAt: now.toISOString() });
    const autoBackups = this.listBackups().filter(
      (backup) => getBackupKindFromFileName(backup.fileName) === "auto"
    );
    const prunedFileNames = autoBackups.slice(retentionLimit).map((backup) => backup.fileName);

    for (const backup of autoBackups.slice(retentionLimit)) {
      if (fs.existsSync(backup.filePath)) {
        fs.rmSync(backup.filePath, { force: true });
      }
    }

    return {
      createdBackup,
      prunedFileNames,
      retentionLimit,
    };
  }

  listBackups(): Array<{
    filePath: string;
    fileName: string;
    createdAt: string;
    sizeBytes: number;
  }> {
    const backupDir = this.getBackupDirectory();
    if (!fs.existsSync(backupDir)) {
      return [];
    }

    return fs
      .readdirSync(backupDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".sqlite"))
      .map((entry) => {
        const filePath = path.join(backupDir, entry.name);
        const stat = fs.statSync(filePath);
        return {
          filePath,
          fileName: entry.name,
          createdAt: stat.mtime.toISOString(),
          sizeBytes: stat.size,
        };
      })
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async previewBackup(filePath: string): Promise<{
    projectCount: number;
    itemCount: number;
    latestUpdatedAt: string | null;
  }> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Backup file not found: ${filePath}`);
    }

    const SQL = await loadSqlJs();
    const database = new SQL.Database(fs.readFileSync(filePath));

    try {
      return {
        projectCount: querySingleNumber(
          database,
          "SELECT COUNT(*) AS count FROM project WHERE archived = 0 AND code != ?",
          ["_INBOX"]
        ),
        itemCount: querySingleNumber(
          database,
          "SELECT COUNT(*) AS count FROM item WHERE archived = 0"
        ),
        latestUpdatedAt: querySingleText(
          database,
          "SELECT MAX(updated_at) AS value FROM (SELECT updated_at FROM project UNION ALL SELECT updated_at FROM item)"
        ),
      };
    } finally {
      database.close();
    }
  }

  async restoreBackup(filePath: string): Promise<{
    filePath: string;
    fileName: string;
    createdAt: string;
    sizeBytes: number;
  }> {
    const safetyBackup = this.restoreBackupFile(filePath);
    const SQL = await loadSqlJs();
    this.db = new SQL.Database(fs.readFileSync(this.dbPath));
    this.execRaw("PRAGMA foreign_keys = ON;");
    this.execRaw("PRAGMA journal_mode = WAL;");
    this.runMigrations();
    this.ensureDefaultWorkspace();
    this.persist();

    return safetyBackup;
  }

  restoreBackupFile(filePath: string): {
    filePath: string;
    fileName: string;
    createdAt: string;
    sizeBytes: number;
  } {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Backup file not found: ${filePath}`);
    }
    if (!fs.existsSync(this.dbPath)) {
      throw new Error(`Current database file not found: ${this.dbPath}`);
    }

    if (this.db) {
      this.persist();
      this.db.close();
      this.db = null;
    }

    const safetyBackup = this.copyDatabaseFileToBackup(this.dbPath, { kind: "safety" });
    const directory = path.dirname(this.dbPath);
    fs.mkdirSync(directory, { recursive: true });
    fs.copyFileSync(filePath, this.dbPath);

    return safetyBackup;
  }

  private copyDatabaseFileToBackup(
    sourcePath: string,
    input: { kind?: BackupKind; createdAt?: string } = {}
  ): {
    filePath: string;
    fileName: string;
    createdAt: string;
    sizeBytes: number;
  } {
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Database file not found for backup: ${sourcePath}`);
    }

    const backupDir = this.getBackupDirectory();
    fs.mkdirSync(backupDir, { recursive: true });
    const createdAt = input.createdAt ?? new Date().toISOString();
    const fileName = `${getBackupFilePrefix(input.kind ?? "manual")}${formatBackupTimestamp(createdAt)}.sqlite`;
    const filePath = path.join(backupDir, fileName);
    fs.copyFileSync(sourcePath, filePath);
    const createdAtDate = new Date(createdAt);
    fs.utimesSync(filePath, createdAtDate, createdAtDate);
    const stat = fs.statSync(filePath);

    return {
      filePath,
      fileName,
      createdAt,
      sizeBytes: stat.size,
    };
  }

  private getBackupDirectory(): string {
    return path.join(path.dirname(this.dbPath), "..", "backups");
  }

  private getDatabase(): SqlJsDatabase {
    if (!this.db) {
      throw new Error("Database is not initialized");
    }

    return this.db;
  }
}

async function loadSqlJs() {
  const wasmPath = require.resolve("sql.js/dist/sql-wasm.wasm");
  return initSqlJs({
    locateFile: () => wasmPath,
  });
}

function querySingleNumber(
  database: SqlJsDatabase,
  sql: string,
  params: SqlValue[] = []
): number {
  const statement = database.prepare(sql);
  try {
    statement.bind(params);
    if (!statement.step()) {
      return 0;
    }

    const value = Number((statement.getAsObject() as { count?: number | string }).count ?? 0);
    return Number.isFinite(value) ? value : 0;
  } finally {
    statement.free();
  }
}

function querySingleText(
  database: SqlJsDatabase,
  sql: string,
  params: SqlValue[] = []
): string | null {
  const statement = database.prepare(sql);
  try {
    statement.bind(params);
    if (!statement.step()) {
      return null;
    }

    const value = (statement.getAsObject() as { value?: string | null }).value;
    return typeof value === "string" && value ? value : null;
  } finally {
    statement.free();
  }
}

function formatBackupTimestamp(isoText: string): string {
  const date = new Date(isoText);
  const year = String(date.getUTCFullYear());
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hour = String(date.getUTCHours()).padStart(2, "0");
  const minute = String(date.getUTCMinutes()).padStart(2, "0");
  const second = String(date.getUTCSeconds()).padStart(2, "0");
  const millisecond = String(date.getUTCMilliseconds()).padStart(3, "0");
  return `${year}${month}${day}-${hour}${minute}${second}-${millisecond}`;
}

function getBackupFilePrefix(kind: BackupKind): string {
  switch (kind) {
    case "auto":
      return "sgc-auto-backup-";
    case "safety":
      return "sgc-safety-backup-";
    default:
      return "sgc-backup-";
  }
}

function getBackupKindFromFileName(fileName: string): BackupKind {
  if (fileName.startsWith("sgc-auto-backup-")) {
    return "auto";
  }
  if (fileName.startsWith("sgc-safety-backup-")) {
    return "safety";
  }
  return "manual";
}

function formatLocalDateKey(date: Date): string {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
