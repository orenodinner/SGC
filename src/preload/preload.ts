import { contextBridge, ipcRenderer } from "electron";
import type { RendererApi } from "../shared/contracts";

const api: RendererApi = {
  home: {
    getSummary: () => ipcRenderer.invoke("home:getSummary"),
  },
  portfolio: {
    getSummary: () => ipcRenderer.invoke("portfolio:getSummary"),
    getProjectPhases: (projectId) => ipcRenderer.invoke("portfolio:getProjectPhases", projectId),
  },
  dependencies: {
    listByProject: (projectId) => ipcRenderer.invoke("dependency:listByProject", projectId),
    create: (input) => ipcRenderer.invoke("dependency:create", input),
    delete: (dependencyId) => ipcRenderer.invoke("dependency:delete", dependencyId),
  },
  projects: {
    list: () => ipcRenderer.invoke("project:list"),
    create: (input) => ipcRenderer.invoke("project:create", input),
    update: (input) => ipcRenderer.invoke("project:update", input),
    get: (projectId) => ipcRenderer.invoke("project:get", projectId),
    previewImport: (projectId) => ipcRenderer.invoke("project:previewImport", projectId),
    commitImport: (projectId, sourcePath) =>
      ipcRenderer.invoke("project:commitImport", { projectId, sourcePath }),
    exportWorkbook: (projectId) => ipcRenderer.invoke("project:exportWorkbook", projectId),
  },
  items: {
    create: (input) => ipcRenderer.invoke("item:create", input),
    update: (input) => ipcRenderer.invoke("item:update", input),
    archive: (itemId) => ipcRenderer.invoke("item:archive", itemId),
    bulkPostponeOverdue: (input) => ipcRenderer.invoke("item:bulkPostponeOverdue", input),
    moveHierarchy: (input) => ipcRenderer.invoke("item:moveHierarchy", input),
  },
  quickCapture: {
    create: (input) => ipcRenderer.invoke("quickCapture:create", input),
  },
};

contextBridge.exposeInMainWorld("sgc", api);
