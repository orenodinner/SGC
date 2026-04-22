import fs from "node:fs";
import path from "node:path";
import initSqlJs, { type Database as SqlJsDatabase, type SqlValue } from "sql.js";
import { migrations } from "./migrations";

export const DEFAULT_WORKSPACE_ID = "ws-default";

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

  private getDatabase(): SqlJsDatabase {
    if (!this.db) {
      throw new Error("Database is not initialized");
    }

    return this.db;
  }
}
