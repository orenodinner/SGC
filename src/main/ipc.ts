import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { app, BrowserWindow, dialog, ipcMain } from "electron";
import type { OpenDialogOptions } from "electron";
import { DatabaseManager } from "../infra/db/database";
import {
  backupEntrySchema,
  backupRestoreResultSchema,
  type StartupContext,
} from "../shared/contracts";
import { createNormalStartupContext } from "./startup-context";
import { WorkspaceService } from "./services/workspace-service";

export function registerIpcHandlers(
  service: WorkspaceService | null,
  startupContext: StartupContext,
  dbPath: string
): void {
  const runtime = {
    service,
    startupContext,
    dbPath,
  };
  const requireService = (): WorkspaceService => {
    assertWorkspaceServiceAvailable(runtime.service);
    return runtime.service;
  };

  ipcMain.handle("settings:get", () => requireService().getAppSettings());
  ipcMain.handle("settings:update", (_event, input) => requireService().updateAppSettings(input));
  ipcMain.handle("system:getStartupContext", () => runtime.startupContext);
  ipcMain.handle("home:getSummary", () => requireService().getHomeSummary());
  ipcMain.handle("backup:list", () =>
    runtime.service
      ? runtime.service.listBackups()
      : runtime.startupContext.mode === "recovery"
        ? runtime.startupContext.recentBackups
        : []
  );
  ipcMain.handle("backup:create", () => {
    return requireService().createBackup();
  });
  ipcMain.handle("backup:createText", () => {
    return requireService().createTextBackup();
  });
  ipcMain.handle("backup:ensureAuto", () => {
    return requireService().ensureAutoBackup();
  });
  ipcMain.handle("backup:preview", (_event, entry) => {
    if (runtime.service) {
      return runtime.service.previewBackup(entry);
    }
    if (runtime.startupContext.mode === "recovery") {
      return new DatabaseManager(runtime.dbPath)
        .previewBackup(entry.filePath ?? "")
        .then((summary) => ({ ...entry, ...summary }));
    }
    throw new Error("Backup preview is unavailable");
  });
  ipcMain.handle("backup:restore", async (_event, entry) => {
    if (runtime.service) {
      return runtime.service.restoreBackup(entry);
    }
    if (runtime.startupContext.mode !== "recovery") {
      throw new Error("Backup restore is unavailable");
    }

    const parsedEntry = backupEntrySchema.parse(entry);
    if (!parsedEntry.filePath) {
      throw new Error("Backup restore requires a local backup file");
    }

    const database = new DatabaseManager(runtime.dbPath);
    const safetyBackup = database.restoreBackupFile(parsedEntry.filePath);
    await database.initialize();
    runtime.service = new WorkspaceService(database);
    runtime.startupContext = createNormalStartupContext();

    return backupRestoreResultSchema.parse({
      restoredBackup: parsedEntry,
      safetyBackup,
    });
  });
  ipcMain.handle("portfolio:getSummary", () => requireService().getPortfolioSummary());
  ipcMain.handle("portfolio:getProjectPhases", (_event, projectId: string) =>
    requireService().getPortfolioProjectPhases(projectId)
  );
  ipcMain.handle("dependency:listByProject", (_event, projectId: string) =>
    requireService().listDependenciesByProject(projectId)
  );
  ipcMain.handle("dependency:create", (_event, input) => requireService().createDependency(input));
  ipcMain.handle("dependency:delete", (_event, dependencyId: string) =>
    requireService().deleteDependency(dependencyId)
  );
  ipcMain.handle("template:list", () => requireService().listTemplates());
  ipcMain.handle("template:saveWbs", (_event, input) => requireService().saveWbsTemplate(input));
  ipcMain.handle("template:saveProject", (_event, input) =>
    requireService().saveProjectTemplate(input)
  );
  ipcMain.handle("template:applyWbs", (_event, input) => requireService().applyWbsTemplate(input));
  ipcMain.handle("template:applyProject", (_event, input) =>
    requireService().applyProjectTemplate(input)
  );
  ipcMain.handle("recurrenceRule:getByItem", (_event, itemId: string) =>
    requireService().getRecurrenceRuleByItem(itemId)
  );
  ipcMain.handle("recurrenceRule:upsert", (_event, input) =>
    requireService().upsertRecurrenceRule(input)
  );
  ipcMain.handle("recurrenceRule:deleteByItem", (_event, itemId: string) =>
    requireService().deleteRecurrenceRuleByItem(itemId)
  );
  ipcMain.handle("project:list", () => requireService().listProjects());
  ipcMain.handle("project:create", (_event, input) => requireService().createProject(input));
  ipcMain.handle("project:update", (_event, input) => requireService().updateProject(input));
  ipcMain.handle("project:get", (_event, projectId: string) => requireService().getProjectDetail(projectId));
  ipcMain.handle("project:previewImport", async (event, projectId: string) => {
    const browserWindow = BrowserWindow.fromWebContents(event.sender) ?? undefined;
    const openDialogOptions: OpenDialogOptions = {
      title: "Excel Import",
      filters: [{ name: "Excel Workbook", extensions: ["xlsx"] }],
      properties: ["openFile"],
    };
    const result = browserWindow
      ? await dialog.showOpenDialog(browserWindow, openDialogOptions)
      : await dialog.showOpenDialog(openDialogOptions);

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const sourcePath = result.filePaths[0];
    const workbookBytes = new Uint8Array(await readFile(sourcePath));
    return requireService().previewProjectImport({
      projectId,
      sourcePath,
      workbookBytes,
    });
  });
  ipcMain.handle("project:commitImport", async (_event, input: { projectId: string; sourcePath: string }) => {
    const workbookBytes = new Uint8Array(await readFile(input.sourcePath));
    return requireService().commitProjectImport({
      projectId: input.projectId,
      sourcePath: input.sourcePath,
      workbookBytes,
    });
  });
  ipcMain.handle("project:exportWorkbook", async (event, projectId: string) => {
    const detail = requireService().getProjectDetail(projectId);
    const fileNameBase = sanitizeFileName(detail.project.code || detail.project.name || "project");
    const browserWindow = BrowserWindow.fromWebContents(event.sender) ?? undefined;
    const saveDialogOptions = {
      title: "Excel Export",
      defaultPath: path.join(app.getPath("documents"), `${fileNameBase}.xlsx`),
      filters: [{ name: "Excel Workbook", extensions: ["xlsx"] }],
    };
    const result = browserWindow
      ? await dialog.showSaveDialog(browserWindow, saveDialogOptions)
      : await dialog.showSaveDialog(saveDialogOptions);

    if (result.canceled || !result.filePath) {
      return { filePath: null };
    }

    const outputPath =
      path.extname(result.filePath).toLowerCase() === ".xlsx"
        ? result.filePath
        : `${result.filePath}.xlsx`;
    await writeFile(outputPath, requireService().exportProjectWorkbook(projectId));
    return { filePath: outputPath };
  });
  ipcMain.handle("item:create", (_event, input) => requireService().createItem(input));
  ipcMain.handle("item:update", (_event, input) => requireService().updateItem(input));
  ipcMain.handle("item:archive", (_event, itemId: string) => requireService().archiveItem(itemId));
  ipcMain.handle("item:bulkPostponeOverdue", (_event, input) => requireService().bulkPostponeOverdue(input));
  ipcMain.handle("item:moveHierarchy", (_event, input) => requireService().moveItemHierarchy(input));
  ipcMain.handle("item:reorderRow", (_event, input) => requireService().reorderItemRow(input));
  ipcMain.handle("quickCapture:create", (_event, input) => requireService().createQuickCapture(input));
}

function assertWorkspaceServiceAvailable(
  service: WorkspaceService | null
): asserts service is WorkspaceService {
  if (!service) {
    throw new Error("Workspace is unavailable during recovery mode");
  }
}

function sanitizeFileName(value: string): string {
  return [...value]
    .map((character) => {
      const code = character.charCodeAt(0);
      if ('<>:"/\\|?*'.includes(character) || code <= 31) {
        return "_";
      }
      return character;
    })
    .join("")
    .trim() || "project";
}
