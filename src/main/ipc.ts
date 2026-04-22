import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { app, BrowserWindow, dialog, ipcMain } from "electron";
import type { OpenDialogOptions } from "electron";
import { WorkspaceService } from "./services/workspace-service";

export function registerIpcHandlers(service: WorkspaceService): void {
  ipcMain.handle("home:getSummary", () => service.getHomeSummary());
  ipcMain.handle("portfolio:getSummary", () => service.getPortfolioSummary());
  ipcMain.handle("portfolio:getProjectPhases", (_event, projectId: string) =>
    service.getPortfolioProjectPhases(projectId)
  );
  ipcMain.handle("dependency:listByProject", (_event, projectId: string) =>
    service.listDependenciesByProject(projectId)
  );
  ipcMain.handle("dependency:create", (_event, input) => service.createDependency(input));
  ipcMain.handle("dependency:delete", (_event, dependencyId: string) =>
    service.deleteDependency(dependencyId)
  );
  ipcMain.handle("project:list", () => service.listProjects());
  ipcMain.handle("project:create", (_event, input) => service.createProject(input));
  ipcMain.handle("project:update", (_event, input) => service.updateProject(input));
  ipcMain.handle("project:get", (_event, projectId: string) => service.getProjectDetail(projectId));
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
    return service.previewProjectImport({
      projectId,
      sourcePath,
      workbookBytes,
    });
  });
  ipcMain.handle("project:commitImport", async (_event, input: { projectId: string; sourcePath: string }) => {
    const workbookBytes = new Uint8Array(await readFile(input.sourcePath));
    return service.commitProjectImport({
      projectId: input.projectId,
      sourcePath: input.sourcePath,
      workbookBytes,
    });
  });
  ipcMain.handle("project:exportWorkbook", async (event, projectId: string) => {
    const detail = service.getProjectDetail(projectId);
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
    await writeFile(outputPath, service.exportProjectWorkbook(projectId));
    return { filePath: outputPath };
  });
  ipcMain.handle("item:create", (_event, input) => service.createItem(input));
  ipcMain.handle("item:update", (_event, input) => service.updateItem(input));
  ipcMain.handle("item:archive", (_event, itemId: string) => service.archiveItem(itemId));
  ipcMain.handle("item:bulkPostponeOverdue", (_event, input) => service.bulkPostponeOverdue(input));
  ipcMain.handle("item:moveHierarchy", (_event, input) => service.moveItemHierarchy(input));
  ipcMain.handle("quickCapture:create", (_event, input) => service.createQuickCapture(input));
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
