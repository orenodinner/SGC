import { create } from "zustand";
import { browserApi } from "../lib/browser-api";
import type {
  BackupEntry,
  BackupPreview,
  BackupRestoreResult,
  TextBackupResult,
  AppSettings,
  PostponeTarget,
  CreateProjectInput,
  HierarchyMoveDirection,
  HomeSummary,
  ItemRecord,
  RowReorderPlacement,
  ProjectImportCommitResult,
  PortfolioSummary,
  ProjectDetail,
  ProjectImportPreview,
  ProjectExportResult,
  ProjectSummary,
  RecurrenceRule,
  StartupContext,
  TemplateRecord,
  UpsertRecurrenceRuleInput,
  UpdateAppSettingsInput,
  UpdateItemInput,
  UpdateProjectInput,
} from "../../shared/contracts";
import {
  createEmptyItemEditHistory,
  hasItemEditDifference,
  pushItemEditHistory,
  snapshotItemForHistory,
  snapshotToUpdateItemInput,
  takeRedoHistoryEntry,
  takeUndoHistoryEntry,
  type ItemEditHistoryState,
} from "./item-edit-history";

const api = window.sgc ?? browserApi;

interface AppState {
  settings: AppSettings | null;
  projects: ProjectSummary[];
  selectedProjectId: string | null;
  projectDetail: ProjectDetail | null;
  homeSummary: HomeSummary | null;
  backups: BackupEntry[];
  backupPreview: BackupPreview | null;
  startupContext: StartupContext | null;
  portfolioSummary: PortfolioSummary | null;
  importPreview: ProjectImportPreview | null;
  templates: TemplateRecord[];
  itemEditHistory: ItemEditHistoryState;
  canUndoItemEdit: boolean;
  canRedoItemEdit: boolean;
  loading: boolean;
  error: string | null;
  notice: string | null;
  bootstrap: () => Promise<void>;
  refreshHome: () => Promise<void>;
  createBackup: () => Promise<BackupEntry | null>;
  createTextBackup: () => Promise<TextBackupResult | null>;
  previewBackup: (entry: BackupEntry) => Promise<BackupPreview | null>;
  restoreBackup: (entry: BackupEntry) => Promise<BackupRestoreResult | null>;
  updateSettings: (input: UpdateAppSettingsInput) => Promise<AppSettings | null>;
  clearBackupPreview: () => void;
  selectProject: (projectId: string) => Promise<void>;
  createProject: (input: CreateProjectInput) => Promise<void>;
  convertInboxItemToTemplateProject: (
    itemId: string
  ) => Promise<{ projectId: string; itemId: string } | null>;
  saveWbsTemplate: (rootItemId: string) => Promise<void>;
  saveProjectTemplate: (projectId: string) => Promise<void>;
  applyWbsTemplate: (templateId: string) => Promise<void>;
  applyProjectTemplate: (templateId: string) => Promise<void>;
  upsertRecurrenceRule: (input: UpsertRecurrenceRuleInput) => Promise<RecurrenceRule | null>;
  deleteRecurrenceRule: (itemId: string) => Promise<boolean>;
  updateProject: (input: UpdateProjectInput) => Promise<void>;
  createItem: (projectId: string, parentId?: string | null) => Promise<void>;
  updateItem: (input: UpdateItemInput) => Promise<void>;
  archiveItem: (itemId: string) => Promise<void>;
  captureQuickEntry: (text: string) => Promise<void>;
  bulkPostponeOverdue: (target: PostponeTarget) => Promise<void>;
  moveItemHierarchy: (itemId: string, direction: HierarchyMoveDirection) => Promise<void>;
  reorderItemRow: (
    itemId: string,
    targetItemId: string,
    placement: RowReorderPlacement
  ) => Promise<void>;
  previewProjectImport: () => Promise<ProjectImportPreview | null>;
  commitProjectImport: () => Promise<ProjectImportCommitResult | null>;
  clearImportPreview: () => void;
  exportProjectWorkbook: () => Promise<ProjectExportResult | null>;
  undoItemEdit: () => Promise<void>;
  redoItemEdit: () => Promise<void>;
}

const emptyItemEditHistory = createEmptyItemEditHistory();

export const useAppStore = create<AppState>((set, get) => ({
  settings: null,
  projects: [],
  selectedProjectId: null,
  projectDetail: null,
  homeSummary: null,
  backups: [],
  backupPreview: null,
  startupContext: null,
  portfolioSummary: null,
  importPreview: null,
  templates: [],
  itemEditHistory: emptyItemEditHistory,
  canUndoItemEdit: false,
  canRedoItemEdit: false,
  loading: false,
  error: null,
  notice: null,

  async bootstrap() {
    set({ loading: true, error: null });

    try {
      const startupContext = await api.system.getStartupContext();
      if (startupContext.mode === "recovery") {
        set({
          projects: [],
          backups: startupContext.recentBackups,
          selectedProjectId: null,
          projectDetail: null,
          homeSummary: null,
          portfolioSummary: null,
          templates: [],
          backupPreview: null,
          importPreview: null,
          startupContext,
          ...historyPatch(emptyItemEditHistory),
          loading: false,
          notice: null,
        });
        return;
      }

      await api.backups.ensureAuto();
      const [settings, projects, backups, homeSummary, portfolioSummary, templates] = await Promise.all([
        api.settings.get(),
        api.projects.list(),
        api.backups.list(),
        api.home.getSummary(),
        api.portfolio.getSummary(),
        api.templates.list(),
      ]);
      const selectedProjectId = projects[0]?.id ?? null;
      const projectDetail = selectedProjectId
        ? await api.projects.get(selectedProjectId)
        : null;

        set({
          settings,
          projects,
        backups,
        templates,
        selectedProjectId,
        projectDetail,
        homeSummary,
        portfolioSummary,
        startupContext,
        backupPreview: null,
        importPreview: null,
        ...historyPatch(emptyItemEditHistory),
        loading: false,
      });
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : "Failed to bootstrap app",
      });
    }
  },

  async refreshHome() {
    try {
      const [settings, projects, backups, homeSummary, portfolioSummary, templates] = await Promise.all([
        api.settings.get(),
        api.projects.list(),
        api.backups.list(),
        api.home.getSummary(),
        api.portfolio.getSummary(),
        api.templates.list(),
      ]);

      set({
        settings,
        projects,
        backups,
        homeSummary,
        portfolioSummary,
        templates,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to refresh home",
      });
    }
  },

  async createBackup() {
    set({ loading: true, error: null });
    try {
      const backup = await api.backups.create();
      const backups = await api.backups.list();
      set({
        backups,
        loading: false,
        notice: backup.filePath ? `Backup created: ${backup.filePath}` : `Backup created: ${backup.fileName}`,
      });
      return backup;
    } catch (error) {
      set({
        loading: false,
        notice: null,
        error: error instanceof Error ? error.message : "Failed to create backup",
      });
      return null;
    }
  },

  async createTextBackup() {
    set({ loading: true, error: null });
    try {
      const result = await api.backups.createText();
      const suffix = result.gitCommitted
        ? ` / commit ${result.commitSha ?? "created"}`
        : result.warning
          ? ` / ${result.warning}`
          : "";
      set({
        loading: false,
        notice: `Text backup created: ${result.directoryPath}${suffix}`,
      });
      return result;
    } catch (error) {
      set({
        loading: false,
        notice: null,
        error: error instanceof Error ? error.message : "Failed to create text backup",
      });
      return null;
    }
  },

  async previewBackup(entry) {
    set({ loading: true, error: null });
    try {
      const backupPreview = await api.backups.preview(entry);
      set({
        backupPreview,
        loading: false,
        notice: null,
      });
      return backupPreview;
    } catch (error) {
      set({
        backupPreview: null,
        loading: false,
        notice: null,
        error: error instanceof Error ? error.message : "Failed to preview backup",
      });
      return null;
    }
  },

  async restoreBackup(entry) {
    set({ loading: true, error: null });
    try {
      const result = await api.backups.restore(entry);
      const [startupContext, settings, projects, backups, homeSummary, portfolioSummary, templates] = await Promise.all([
        api.system.getStartupContext(),
        api.settings.get(),
        api.projects.list(),
        api.backups.list(),
        api.home.getSummary(),
        api.portfolio.getSummary(),
        api.templates.list(),
      ]);
      const previousSelectedProjectId = get().selectedProjectId;
      const nextSelectedProjectId =
        projects.find((project) => project.id === previousSelectedProjectId)?.id ??
        projects[0]?.id ??
        null;
      const projectDetail = nextSelectedProjectId
        ? await api.projects.get(nextSelectedProjectId)
        : null;

      set({
        settings,
        projects,
        backups,
        selectedProjectId: nextSelectedProjectId,
        projectDetail,
        homeSummary,
        portfolioSummary,
        templates,
        startupContext,
        backupPreview: null,
        importPreview: null,
        ...historyPatch(emptyItemEditHistory),
        loading: false,
        notice: `Backup restored: ${result.restoredBackup.fileName} / safety: ${result.safetyBackup.fileName}`,
      });
      return result;
    } catch (error) {
      set({
        loading: false,
        notice: null,
        error: error instanceof Error ? error.message : "Failed to restore backup",
      });
      return null;
    }
  },

  clearBackupPreview() {
    set({ backupPreview: null });
  },

  async updateSettings(input) {
    set({ loading: true, error: null });
    try {
      const settings = await api.settings.update(input);
      const [homeSummary] = await Promise.all([api.home.getSummary()]);
      set({
        settings,
        homeSummary,
        loading: false,
        notice: "Settings saved",
      });
      return settings;
    } catch (error) {
      set({
        loading: false,
        notice: null,
        error: error instanceof Error ? error.message : "Failed to save settings",
      });
      return null;
    }
  },

  async selectProject(projectId) {
    set({ loading: true, error: null });
    try {
      const projectDetail = await api.projects.get(projectId);
      set({
        selectedProjectId: projectId,
        projectDetail,
        backupPreview: null,
        importPreview: null,
        ...historyPatch(emptyItemEditHistory),
        loading: false,
      });
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : "Failed to load project",
      });
    }
  },

  async createProject(input) {
    set({ loading: true, error: null });
    try {
      const project = await api.projects.create(input);
      const [projects, projectDetail, homeSummary, portfolioSummary] = await Promise.all([
        api.projects.list(),
        api.projects.get(project.id),
        api.home.getSummary(),
        api.portfolio.getSummary(),
      ]);
      set({
        projects,
        selectedProjectId: project.id,
        projectDetail,
        homeSummary,
        portfolioSummary,
        backupPreview: null,
        importPreview: null,
        ...historyPatch(emptyItemEditHistory),
        loading: false,
      });
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : "Failed to create project",
      });
    }
  },

  async convertInboxItemToTemplateProject(itemId) {
    set({ loading: true, error: null });
    try {
      const sourceItem =
        get().homeSummary?.inboxItems.find((item) => item.id === itemId) ?? null;
      if (!sourceItem) {
        throw new Error("Inbox item not found");
      }

      const project = await api.projects.create({
        name: sourceItem.title,
        code: undefined,
      });
      await api.items.update({
        id: sourceItem.id,
        projectId: project.id,
      });

      const [projects, projectDetail, homeSummary, portfolioSummary, templates] =
        await Promise.all([
          api.projects.list(),
          api.projects.get(project.id),
          api.home.getSummary(),
          api.portfolio.getSummary(),
          api.templates.list(),
        ]);
      set({
        projects,
        selectedProjectId: project.id,
        projectDetail,
        homeSummary,
        portfolioSummary,
        templates,
        backupPreview: null,
        importPreview: null,
        ...historyPatch(emptyItemEditHistory),
        loading: false,
        notice: `Template conversion ready: ${project.name}`,
      });
      return {
        projectId: project.id,
        itemId: sourceItem.id,
      };
    } catch (error) {
      set({
        loading: false,
        notice: null,
        error:
          error instanceof Error
            ? error.message
            : "Failed to start inbox template conversion",
      });
      return null;
    }
  },

  async saveWbsTemplate(rootItemId) {
    set({ loading: true, error: null });
    try {
      const saved = await api.templates.saveWbs({ rootItemId, name: undefined });
      const templates = await api.templates.list();
      set({
        templates,
        loading: false,
        notice: `WBS template saved: ${saved.name}`,
      });
    } catch (error) {
      set({
        loading: false,
        notice: null,
        error: error instanceof Error ? error.message : "Failed to save WBS template",
      });
    }
  },

  async saveProjectTemplate(projectId) {
    set({ loading: true, error: null });
    try {
      const saved = await api.templates.saveProject({ projectId, name: undefined });
      const templates = await api.templates.list();
      set({
        templates,
        loading: false,
        notice: `Project template saved: ${saved.name}`,
      });
    } catch (error) {
      set({
        loading: false,
        notice: null,
        error: error instanceof Error ? error.message : "Failed to save project template",
      });
    }
  },

  async applyWbsTemplate(templateId) {
    const projectId = get().selectedProjectId;
    if (!projectId) {
      return;
    }

    set({ loading: true, error: null });
    try {
      await api.templates.applyWbs({ templateId, projectId });
      const [projects, projectDetail, homeSummary, portfolioSummary, templates] = await Promise.all([
        api.projects.list(),
        api.projects.get(projectId),
        api.home.getSummary(),
        api.portfolio.getSummary(),
        api.templates.list(),
      ]);
      set({
        projects,
        projectDetail,
        homeSummary,
        portfolioSummary,
        templates,
        loading: false,
        notice: "WBS template applied",
      });
    } catch (error) {
      set({
        loading: false,
        notice: null,
        error: error instanceof Error ? error.message : "Failed to apply WBS template",
      });
    }
  },

  async applyProjectTemplate(templateId) {
    set({ loading: true, error: null });
    try {
      const projectDetail = await api.templates.applyProject({ templateId });
      const [projects, homeSummary, portfolioSummary, templates] = await Promise.all([
        api.projects.list(),
        api.home.getSummary(),
        api.portfolio.getSummary(),
        api.templates.list(),
      ]);
      set({
        projects,
        selectedProjectId: projectDetail.project.id,
        projectDetail,
        homeSummary,
        portfolioSummary,
        templates,
        backupPreview: null,
        importPreview: null,
        ...historyPatch(emptyItemEditHistory),
        loading: false,
        notice: `Project template created: ${projectDetail.project.name}`,
      });
    } catch (error) {
      set({
        loading: false,
        notice: null,
        error: error instanceof Error ? error.message : "Failed to create project from template",
      });
    }
  },

  async upsertRecurrenceRule(input) {
    const projectId = get().selectedProjectId;
    if (!projectId) {
      return null;
    }

    set({ loading: true, error: null });
    try {
      const saved = await api.recurrenceRules.upsert(input);
      const [projects, projectDetail, homeSummary, portfolioSummary] = await Promise.all([
        api.projects.list(),
        api.projects.get(projectId),
        api.home.getSummary(),
        api.portfolio.getSummary(),
      ]);
      set({
        projects,
        projectDetail,
        homeSummary,
        portfolioSummary,
        loading: false,
        notice: "Recurrence saved",
      });
      return saved;
    } catch (error) {
      set({
        loading: false,
        notice: null,
        error: error instanceof Error ? error.message : "Failed to save recurrence",
      });
      return null;
    }
  },

  async deleteRecurrenceRule(itemId) {
    const projectId = get().selectedProjectId;
    if (!projectId) {
      return false;
    }

    set({ loading: true, error: null });
    try {
      await api.recurrenceRules.deleteByItem(itemId);
      const [projects, projectDetail, homeSummary, portfolioSummary] = await Promise.all([
        api.projects.list(),
        api.projects.get(projectId),
        api.home.getSummary(),
        api.portfolio.getSummary(),
      ]);
      set({
        projects,
        projectDetail,
        homeSummary,
        portfolioSummary,
        loading: false,
        notice: "Recurrence removed",
      });
      return true;
    } catch (error) {
      set({
        loading: false,
        notice: null,
        error: error instanceof Error ? error.message : "Failed to remove recurrence",
      });
      return false;
    }
  },

  async updateProject(input) {
    const { selectedProjectId } = get();
    if (!selectedProjectId) {
      return;
    }

    set({ loading: true, error: null });
    try {
      await api.projects.update(input);
      const [projects, projectDetail, homeSummary, portfolioSummary] = await Promise.all([
        api.projects.list(),
        api.projects.get(selectedProjectId),
        api.home.getSummary(),
        api.portfolio.getSummary(),
      ]);
      set({
        projects,
        projectDetail,
        homeSummary,
        portfolioSummary,
        loading: false,
      });
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : "Failed to update project",
      });
    }
  },

  async createItem(projectId, parentId = null) {
    set({ loading: true, error: null });
    try {
      await api.items.create({
        projectId,
        parentId,
        title: parentId ? "新しい子タスク" : "新しいタスク",
        type: parentId ? "task" : "group",
      });

      const [projects, projectDetail, homeSummary, portfolioSummary] = await Promise.all([
        api.projects.list(),
        api.projects.get(projectId),
        api.home.getSummary(),
        api.portfolio.getSummary(),
      ]);
      set({
        projects,
        projectDetail,
        homeSummary,
        portfolioSummary,
        loading: false,
      });
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : "Failed to create item",
      });
    }
  },

  async updateItem(input) {
    const state = get();
    const projectId = state.selectedProjectId;
    const previousItem = findItemById(state.projectDetail, input.id);
    set({ loading: true, error: null });
    try {
      const updatedItem = await api.items.update(input);
      let nextHistory = get().itemEditHistory;

      if (previousItem) {
        const before = snapshotItemForHistory(previousItem);
        const after = snapshotItemForHistory(updatedItem);
        if (hasItemEditDifference(before, after)) {
          nextHistory = pushItemEditHistory(get().itemEditHistory, {
            itemId: updatedItem.id,
            before,
            after,
          });
        }
      }

      const [projects, projectDetail, homeSummary, portfolioSummary] = await Promise.all([
        api.projects.list(),
        projectId ? api.projects.get(projectId) : Promise.resolve(null),
        api.home.getSummary(),
        api.portfolio.getSummary(),
      ]);
      set({
        projects,
        projectDetail,
        homeSummary,
        portfolioSummary,
        ...historyPatch(nextHistory),
        loading: false,
      });
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : "Failed to update item",
      });
    }
  },

  async archiveItem(itemId) {
    const projectId = get().selectedProjectId;
    set({ loading: true, error: null });

    try {
      await api.items.archive(itemId);
      const [projects, homeSummary, portfolioSummary, projectDetail] = await Promise.all([
        api.projects.list(),
        api.home.getSummary(),
        api.portfolio.getSummary(),
        projectId ? api.projects.get(projectId) : Promise.resolve(null),
      ]);
      set({
        projects,
        homeSummary,
        portfolioSummary,
        projectDetail,
        loading: false,
      });
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : "Failed to archive item",
      });
    }
  },

  async captureQuickEntry(text) {
    set({ loading: true, error: null });
    try {
      await api.quickCapture.create({ text });
      const { selectedProjectId } = get();
      const [projects, homeSummary, portfolioSummary, projectDetail] = await Promise.all([
        api.projects.list(),
        api.home.getSummary(),
        api.portfolio.getSummary(),
        selectedProjectId ? api.projects.get(selectedProjectId) : Promise.resolve(null),
      ]);
      set({
        projects,
        homeSummary,
        portfolioSummary,
        projectDetail,
        loading: false,
      });
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : "Failed to capture task",
      });
    }
  },

  async bulkPostponeOverdue(target) {
    set({ loading: true, error: null });
    try {
      const { selectedProjectId } = get();
      await api.items.bulkPostponeOverdue({ target });
      const [projects, homeSummary, portfolioSummary, projectDetail] = await Promise.all([
        api.projects.list(),
        api.home.getSummary(),
        api.portfolio.getSummary(),
        selectedProjectId ? api.projects.get(selectedProjectId) : Promise.resolve(null),
      ]);
      set({
        projects,
        homeSummary,
        portfolioSummary,
        projectDetail,
        loading: false,
      });
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : "Failed to postpone overdue items",
      });
    }
  },

  async moveItemHierarchy(itemId, direction) {
    const projectId = get().selectedProjectId;
    if (!projectId) {
      return;
    }

    set({ loading: true, error: null });
    try {
      await api.items.moveHierarchy({ itemId, direction });
      const [projects, projectDetail, homeSummary, portfolioSummary] = await Promise.all([
        api.projects.list(),
        api.projects.get(projectId),
        api.home.getSummary(),
        api.portfolio.getSummary(),
      ]);
      set({
        projects,
        projectDetail,
        homeSummary,
        portfolioSummary,
        loading: false,
      });
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : "Failed to move item hierarchy",
      });
    }
  },

  async reorderItemRow(itemId, targetItemId, placement) {
    const projectId = get().selectedProjectId;
    if (!projectId) {
      return;
    }

    set({ loading: true, error: null });
    try {
      await api.items.reorderRow({ itemId, targetItemId, placement });
      const [projects, projectDetail, homeSummary, portfolioSummary] = await Promise.all([
        api.projects.list(),
        api.projects.get(projectId),
        api.home.getSummary(),
        api.portfolio.getSummary(),
      ]);
      set({
        projects,
        projectDetail,
        homeSummary,
        portfolioSummary,
        loading: false,
      });
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : "Failed to reorder item row",
      });
    }
  },

  async previewProjectImport() {
    const { selectedProjectId } = get();
    if (!selectedProjectId) {
      return null;
    }

    set({ loading: true, error: null });
    try {
      const result = await api.projects.previewImport(selectedProjectId);
      set({
        loading: false,
        importPreview: result,
        notice: null,
      });
      return result;
    } catch (error) {
      set({
        loading: false,
        importPreview: null,
        notice: null,
        error: error instanceof Error ? error.message : "Failed to preview import",
      });
      return null;
    }
  },

  async commitProjectImport() {
    const { selectedProjectId, importPreview } = get();
    if (!selectedProjectId || !importPreview) {
      return null;
    }

    set({ loading: true, error: null });
    try {
      const result = await api.projects.commitImport(selectedProjectId, importPreview.sourcePath ?? "");
      const [projects, projectDetail, homeSummary, portfolioSummary] = await Promise.all([
        api.projects.list(),
        api.projects.get(selectedProjectId),
        api.home.getSummary(),
        api.portfolio.getSummary(),
      ]);
      set({
        projects,
        projectDetail,
        homeSummary,
        portfolioSummary,
        importPreview: null,
        loading: false,
        notice: `Excel import applied: +${result.createdCount} new / ${result.updatedCount} updated / ${result.skippedCount} skipped`,
      });
      return result;
    } catch (error) {
      set({
        loading: false,
        notice: null,
        error: error instanceof Error ? error.message : "Failed to commit import",
      });
      return null;
    }
  },

  clearImportPreview() {
    set({ importPreview: null });
  },

  async exportProjectWorkbook() {
    const { selectedProjectId } = get();
    if (!selectedProjectId) {
      return null;
    }

    set({ loading: true, error: null });
    try {
      const result = await api.projects.exportWorkbook(selectedProjectId);
      set({
        loading: false,
        notice: result.filePath ? `Excel export: ${result.filePath}` : null,
      });
      return result;
    } catch (error) {
      set({
        loading: false,
        notice: null,
        error: error instanceof Error ? error.message : "Failed to export workbook",
      });
      return null;
    }
  },

  async undoItemEdit() {
    const { selectedProjectId, itemEditHistory } = get();
    if (!selectedProjectId) {
      return;
    }

    const { entry, nextState } = takeUndoHistoryEntry(itemEditHistory);
    if (!entry) {
      return;
    }

    set({ loading: true, error: null });
    try {
      await api.items.update(snapshotToUpdateItemInput(entry.before));
      const [projects, projectDetail, homeSummary, portfolioSummary] = await Promise.all([
        api.projects.list(),
        api.projects.get(selectedProjectId),
        api.home.getSummary(),
        api.portfolio.getSummary(),
      ]);
      set({
        projects,
        projectDetail,
        homeSummary,
        portfolioSummary,
        ...historyPatch(nextState),
        loading: false,
      });
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : "Failed to undo item edit",
      });
    }
  },

  async redoItemEdit() {
    const { selectedProjectId, itemEditHistory } = get();
    if (!selectedProjectId) {
      return;
    }

    const { entry, nextState } = takeRedoHistoryEntry(itemEditHistory);
    if (!entry) {
      return;
    }

    set({ loading: true, error: null });
    try {
      await api.items.update(snapshotToUpdateItemInput(entry.after));
      const [projects, projectDetail, homeSummary, portfolioSummary] = await Promise.all([
        api.projects.list(),
        api.projects.get(selectedProjectId),
        api.home.getSummary(),
        api.portfolio.getSummary(),
      ]);
      set({
        projects,
        projectDetail,
        homeSummary,
        portfolioSummary,
        ...historyPatch(nextState),
        loading: false,
      });
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : "Failed to redo item edit",
      });
    }
  },
}));

function historyPatch(itemEditHistory: ItemEditHistoryState) {
  return {
    itemEditHistory,
    canUndoItemEdit: itemEditHistory.undoStack.length > 0,
    canRedoItemEdit: itemEditHistory.redoStack.length > 0,
  };
}

function findItemById(projectDetail: ProjectDetail | null, itemId: string): ItemRecord | null {
  return projectDetail?.items.find((item) => item.id === itemId) ?? null;
}
