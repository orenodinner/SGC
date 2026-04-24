import { contextBridge, ipcRenderer } from "electron";
import type { RendererApi } from "../shared/contracts";

const api: RendererApi = {
  settings: {
    get: () => ipcRenderer.invoke("settings:get"),
    update: (input) => ipcRenderer.invoke("settings:update", input),
  },
  home: {
    getSummary: () => ipcRenderer.invoke("home:getSummary"),
  },
  system: {
    getStartupContext: () => ipcRenderer.invoke("system:getStartupContext"),
  },
  backups: {
    list: () => ipcRenderer.invoke("backup:list"),
    create: () => ipcRenderer.invoke("backup:create"),
    ensureAuto: () => ipcRenderer.invoke("backup:ensureAuto"),
    preview: (entry) => ipcRenderer.invoke("backup:preview", entry),
    restore: (entry) => ipcRenderer.invoke("backup:restore", entry),
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
  templates: {
    list: () => ipcRenderer.invoke("template:list"),
    saveWbs: (input) => ipcRenderer.invoke("template:saveWbs", input),
    saveProject: (input) => ipcRenderer.invoke("template:saveProject", input),
    applyWbs: (input) => ipcRenderer.invoke("template:applyWbs", input),
    applyProject: (input) => ipcRenderer.invoke("template:applyProject", input),
  },
  recurrenceRules: {
    getByItem: (itemId) => ipcRenderer.invoke("recurrenceRule:getByItem", itemId),
    upsert: (input) => ipcRenderer.invoke("recurrenceRule:upsert", input),
    deleteByItem: (itemId) => ipcRenderer.invoke("recurrenceRule:deleteByItem", itemId),
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
    reorderRow: (input) => ipcRenderer.invoke("item:reorderRow", input),
  },
  quickCapture: {
    create: (input) => ipcRenderer.invoke("quickCapture:create", input),
  },
};

contextBridge.exposeInMainWorld("sgc", api);
