import { backupEntrySchema, startupContextSchema, type StartupContext } from "../shared/contracts";
import { DatabaseManager } from "../infra/db/database";

export function createNormalStartupContext(): StartupContext {
  return startupContextSchema.parse({
    mode: "normal",
  });
}

export function createRecoveryStartupContext(input: {
  dbPath: string;
  error: unknown;
}): StartupContext {
  const backups = new DatabaseManager(input.dbPath)
    .listBackups()
    .slice(0, 5)
    .map((entry) => backupEntrySchema.parse(entry));

  return startupContextSchema.parse({
    mode: "recovery",
    errorMessage: input.error instanceof Error ? input.error.message : "Database bootstrap failed",
    recentBackups: backups,
  });
}
