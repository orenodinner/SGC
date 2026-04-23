import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DatabaseManager } from "../infra/db/database";
import { createNormalStartupContext, createRecoveryStartupContext } from "./startup-context";

describe("startup context", () => {
  let tempDir: string;
  let dbPath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sgc-startup-"));
    dbPath = path.join(tempDir, "data", "sgc.sqlite");
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("creates a normal startup context", () => {
    expect(createNormalStartupContext()).toEqual({ mode: "normal" });
  });

  it("creates a recovery startup context with recent backups", async () => {
    const manager = new DatabaseManager(dbPath);
    await manager.initialize();
    manager.createBackup({
      kind: "manual",
      createdAt: "2026-04-23T00:00:00.000Z",
    });

    const context = createRecoveryStartupContext({
      dbPath,
      error: new Error("Database bootstrap failed"),
    });

    expect(context.mode).toBe("recovery");
    if (context.mode !== "recovery") {
      throw new Error("Expected recovery mode");
    }
    expect(context.errorMessage).toContain("Database bootstrap failed");
    expect(context.recentBackups).toHaveLength(1);
    expect(context.recentBackups[0]?.fileName).toMatch(/^sgc-backup-/);
  });
});
