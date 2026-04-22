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
    dbPath = path.join(tempDir, "sgc.sqlite");
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
    expect(tables.map((table) => table.name)).toContain("workspace");
  });
});
