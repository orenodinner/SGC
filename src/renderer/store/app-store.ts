import { create } from "zustand";
import { browserApi } from "../lib/browser-api";
import type {
  PostponeTarget,
  CreateProjectInput,
  HierarchyMoveDirection,
  HomeSummary,
  ItemRecord,
  ProjectImportCommitResult,
  PortfolioSummary,
  ProjectDetail,
  ProjectImportPreview,
  ProjectExportResult,
  ProjectSummary,
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
  projects: ProjectSummary[];
  selectedProjectId: string | null;
  projectDetail: ProjectDetail | null;
  homeSummary: HomeSummary | null;
  portfolioSummary: PortfolioSummary | null;
  importPreview: ProjectImportPreview | null;
  itemEditHistory: ItemEditHistoryState;
  canUndoItemEdit: boolean;
  canRedoItemEdit: boolean;
  loading: boolean;
  error: string | null;
  notice: string | null;
  bootstrap: () => Promise<void>;
  refreshHome: () => Promise<void>;
  selectProject: (projectId: string) => Promise<void>;
  createProject: (input: CreateProjectInput) => Promise<void>;
  updateProject: (input: UpdateProjectInput) => Promise<void>;
  createItem: (projectId: string, parentId?: string | null) => Promise<void>;
  updateItem: (input: UpdateItemInput) => Promise<void>;
  archiveItem: (itemId: string) => Promise<void>;
  captureQuickEntry: (text: string) => Promise<void>;
  bulkPostponeOverdue: (target: PostponeTarget) => Promise<void>;
  moveItemHierarchy: (itemId: string, direction: HierarchyMoveDirection) => Promise<void>;
  previewProjectImport: () => Promise<ProjectImportPreview | null>;
  commitProjectImport: () => Promise<ProjectImportCommitResult | null>;
  clearImportPreview: () => void;
  exportProjectWorkbook: () => Promise<ProjectExportResult | null>;
  undoItemEdit: () => Promise<void>;
  redoItemEdit: () => Promise<void>;
}

const emptyItemEditHistory = createEmptyItemEditHistory();

export const useAppStore = create<AppState>((set, get) => ({
  projects: [],
  selectedProjectId: null,
  projectDetail: null,
  homeSummary: null,
  portfolioSummary: null,
  importPreview: null,
  itemEditHistory: emptyItemEditHistory,
  canUndoItemEdit: false,
  canRedoItemEdit: false,
  loading: false,
  error: null,
  notice: null,

  async bootstrap() {
    set({ loading: true, error: null });

    try {
      const [projects, homeSummary, portfolioSummary] = await Promise.all([
        api.projects.list(),
        api.home.getSummary(),
        api.portfolio.getSummary(),
      ]);
      const selectedProjectId = projects[0]?.id ?? null;
      const projectDetail = selectedProjectId
        ? await api.projects.get(selectedProjectId)
        : null;

      set({
        projects,
        selectedProjectId,
        projectDetail,
        homeSummary,
        portfolioSummary,
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
      const [projects, homeSummary, portfolioSummary] = await Promise.all([
        api.projects.list(),
        api.home.getSummary(),
        api.portfolio.getSummary(),
      ]);

      set({
        projects,
        homeSummary,
        portfolioSummary,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to refresh home",
      });
    }
  },

  async selectProject(projectId) {
    set({ loading: true, error: null });
    try {
      const projectDetail = await api.projects.get(projectId);
      set({
        selectedProjectId: projectId,
        projectDetail,
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
