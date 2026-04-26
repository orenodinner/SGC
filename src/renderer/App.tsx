import {
  type CSSProperties,
  type DragEvent as ReactDragEvent,
  type FormEvent as ReactFormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type UIEvent,
} from "react";
import { endOfWeek, isWithinInterval, parseISO, startOfWeek } from "date-fns";
import { buildFilteredVisibleRows, buildVisibleRows } from "../domain/project-tree";
import {
  buildRoadmapBuckets,
  buildRoadmapLayout,
  buildRoadmapQuarterHeaders,
  buildRoadmapYearHeaders,
  type RoadmapBucket,
  type RoadmapScale,
} from "../domain/roadmap";
import {
  applyTimelineInteraction,
  buildTimelineColumns,
  buildTimelineLayout,
  type TimelineBarLayout,
  type TimelineInteractionMode,
  type TimelineScale,
} from "../domain/timeline";
import { buildVirtualWindow } from "../domain/virtual-window";
import {
  buildSearchFilterChips,
  createEmptySearchFilterState,
  hasActiveSearchFilters,
  isOverdueItem,
  isRoadmapEligibleItem,
  itemMatchesSearchFilter,
  projectMatchesSearchFilter,
  type SearchFilterChip,
  type SearchFilterState,
} from "../domain/view-filters";
import type {
  AppDefaultView,
  AppLanguage,
  AppTheme,
  AppSettings,
  BackupPreview,
  DependencyRecord,
  HierarchyMoveDirection,
  HomeSummary,
  ItemRecord,
  ProjectImportPreview,
  PortfolioPhaseSummary,
  PortfolioProjectSummary,
  PortfolioSummary,
  PostponeTarget,
  ProjectDetail,
  ProjectSummary,
  RecurrenceRule,
  RowReorderPlacement,
  RescheduleScope,
  TemplateRecord,
  UpdateItemInput,
  WorkingDayNumber,
} from "../shared/contracts";
import { browserApi } from "./lib/browser-api";
import { useAppStore } from "./store/app-store";
import {
  formatMonthLabel,
  getAutoBackupPolicyText,
  getDefaultViewLabel,
  getThemeLabel,
  getUiCopy,
  getWorkingDayOptions,
  type UiCopy,
} from "./ui-copy";

type ViewMode = AppDefaultView | "project" | "settings";
type SearchableViewMode = Exclude<ViewMode, "settings">;

const PROJECT_DETAIL_ROW_HEIGHT = 58;
const PROJECT_DETAIL_VIRTUAL_OVERSCAN = 6;
const PROJECT_DETAIL_DEFAULT_VIEWPORT_HEIGHT = 560;
const PROJECT_TIMELINE_SCALE: TimelineScale = "day";
const ROADMAP_MIN_YEAR_SPAN = 1;
const ROADMAP_MAX_YEAR_SPAN = 5;
const ROADMAP_ROW_HEIGHT = 62;
const ROADMAP_VIRTUAL_OVERSCAN = 6;
const ROADMAP_DEFAULT_VIEWPORT_HEIGHT = 620;

interface AssigneeSummary {
  name: string;
  projectCount: number;
  total: number;
  open: number;
  done: number;
  overdue: number;
}

interface WorkloadBucketSummary {
  key: string;
  label: string;
  shortLabel: string;
  count: number;
  assigneeCount: number;
}

export default function App() {
  const {
    settings,
    projects,
    selectedProjectId,
    projectDetail,
    homeSummary,
    backups,
    backupPreview,
    startupContext,
    portfolioSummary,
    importPreview,
    templates,
    loading,
    error,
    notice,
    bootstrap,
    selectProject,
    createProject,
    convertInboxItemToTemplateProject,
    saveWbsTemplate,
    saveProjectTemplate,
    updateProject,
    createItem,
    updateItem,
    archiveItem,
    captureQuickEntry,
    createBackup,
    createTextBackup,
    previewBackup,
    restoreBackup,
    updateSettings,
    clearBackupPreview,
    bulkPostponeOverdue,
    moveItemHierarchy,
    reorderItemRow,
    applyWbsTemplate,
    applyProjectTemplate,
    upsertRecurrenceRule,
    deleteRecurrenceRule,
    previewProjectImport,
    commitProjectImport,
    clearImportPreview,
    exportProjectWorkbook,
    canUndoItemEdit,
    canRedoItemEdit,
    undoItemEdit,
    redoItemEdit,
  } = useAppStore();
  const language = settings?.language ?? "ja";
  const theme = settings?.theme ?? "light";
  const copy = useMemo(() => getUiCopy(language), [language]);
  const autoBackupPolicyText = useMemo(
    () =>
      getAutoBackupPolicyText(
        language,
        settings?.autoBackupEnabled ?? true,
        settings?.autoBackupRetentionLimit ?? 7
      ),
    [language, settings?.autoBackupEnabled, settings?.autoBackupRetentionLimit]
  );

  const [viewMode, setViewMode] = useState<ViewMode>("home");
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectCode, setNewProjectCode] = useState("");
  const [projectListCollapsed, setProjectListCollapsed] = useState(false);
  const [projectListQuery, setProjectListQuery] = useState("");
  const [quickTaskTitle, setQuickTaskTitle] = useState("");
  const [bulkTaskTitles, setBulkTaskTitles] = useState("");
  const [eventDayTitle, setEventDayTitle] = useState("");
  const [eventDayDate, setEventDayDate] = useState("");
  const [quickCaptureText, setQuickCaptureText] = useState("");
  const [searchDrawerOpen, setSearchDrawerOpen] = useState(false);
  const [templatePanelOpen, setTemplatePanelOpen] = useState(false);
  const [searchFiltersByView, setSearchFiltersByView] = useState<Record<SearchableViewMode, SearchFilterState>>({
    home: createEmptySearchFilterState(),
    portfolio: createEmptySearchFilterState(),
    roadmap: createEmptySearchFilterState(),
    project: createEmptySearchFilterState(),
  });
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [activeTimelineEdit, setActiveTimelineEdit] = useState<ActiveTimelineEdit | null>(null);
  const [pendingRescheduleChange, setPendingRescheduleChange] = useState<PendingRescheduleChange | null>(null);
  const [pendingTimelineFocusRestoreItemId, setPendingTimelineFocusRestoreItemId] = useState<string | null>(null);
  const [itemContextMenu, setItemContextMenu] = useState<ItemContextMenuState | null>(null);
  const [activeRowDragItemId, setActiveRowDragItemId] = useState<string | null>(null);
  const [pendingRowDrop, setPendingRowDrop] = useState<ItemRowDropTarget | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [projectDetailScrollTop, setProjectDetailScrollTop] = useState(0);
  const [projectDetailViewportHeight, setProjectDetailViewportHeight] = useState(
    PROJECT_DETAIL_DEFAULT_VIEWPORT_HEIGHT
  );
  const hasHydratedInitialViewRef = useRef(false);
  const wbsScrollRef = useRef<HTMLDivElement | null>(null);
  const timelineScrollRef = useRef<HTMLDivElement | null>(null);
  const projectListScrollRef = useRef<HTMLDivElement | null>(null);
  const syncLockRef = useRef<"wbs" | "timeline" | null>(null);
  const activeRowDragItemIdRef = useRef<string | null>(null);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (!settings || hasHydratedInitialViewRef.current) {
      return;
    }

    hasHydratedInitialViewRef.current = true;
    setViewMode(settings.defaultView);
  }, [settings]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.body.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    projectListScrollRef.current?.scrollTo({ top: 0 });
  }, [projectListQuery]);

  const effectiveExpandedIds = useMemo(() => {
    const next = new Set(expandedIds);
    for (const item of projectDetail?.items ?? []) {
      if (!item.parentId) {
        next.add(item.id);
      }
    }
    return next;
  }, [expandedIds, projectDetail?.items]);

  const searchableViewMode: SearchableViewMode | null =
    viewMode === "settings"
      ? null
      : viewMode === "project" && !projectDetail
        ? null
        : viewMode;
  const activeSearchFilter = searchableViewMode
    ? searchFiltersByView[searchableViewMode]
    : createEmptySearchFilterState();
  const hasProjectSearchFilter =
    viewMode === "project" && hasActiveSearchFilters(activeSearchFilter);
  const projectFilterMatchesCurrentProject = useMemo(() => {
    if (viewMode !== "project" || !projectDetail) {
      return true;
    }
    return projectMatchesSearchFilter({
      project: projectDetail.project,
      detailItems: projectDetail.items,
      filter: activeSearchFilter,
    });
  }, [activeSearchFilter, projectDetail, viewMode]);
  const directlyMatchedProjectItemIds = useMemo(() => {
    if (viewMode !== "project" || !projectDetail || !hasProjectSearchFilter) {
      return new Set<string>();
    }

    return new Set(
      projectDetail.items
        .filter((item) =>
          itemMatchesSearchFilter({
            item,
            project: projectDetail.project,
            filter: activeSearchFilter,
          })
        )
        .map((item) => item.id)
    );
  }, [activeSearchFilter, hasProjectSearchFilter, projectDetail, viewMode]);
  const rows = useMemo(() => {
    if (viewMode !== "project" || !projectDetail) {
      return buildVisibleRows(projectDetail?.items ?? [], effectiveExpandedIds);
    }
    if (!hasProjectSearchFilter) {
      return buildVisibleRows(projectDetail.items, effectiveExpandedIds);
    }
    if (!projectFilterMatchesCurrentProject) {
      return [];
    }
    return buildFilteredVisibleRows({
      items: projectDetail.items,
      expandedIds: effectiveExpandedIds,
      includedItemIds: directlyMatchedProjectItemIds,
    });
  }, [
    directlyMatchedProjectItemIds,
    effectiveExpandedIds,
    hasProjectSearchFilter,
    projectDetail,
    projectFilterMatchesCurrentProject,
    viewMode,
  ]);
  const virtualWindow = useMemo(
    () =>
      buildVirtualWindow({
        itemCount: rows.length,
        scrollTop: projectDetailScrollTop,
        viewportHeight: projectDetailViewportHeight,
        rowHeight: PROJECT_DETAIL_ROW_HEIGHT,
        overscan: PROJECT_DETAIL_VIRTUAL_OVERSCAN,
      }),
    [projectDetailScrollTop, projectDetailViewportHeight, rows.length]
  );
  const visibleRows = useMemo(
    () => rows.slice(virtualWindow.startIndex, virtualWindow.endIndexExclusive),
    [rows, virtualWindow.endIndexExclusive, virtualWindow.startIndex]
  );
  const visibleProjectRowIds = useMemo(
    () => new Set(rows.map((row) => row.item.id)),
    [rows]
  );
  const timelineColumns = useMemo(
    () => buildTimelineColumns(projectDetail?.items ?? [], PROJECT_TIMELINE_SCALE),
    [projectDetail?.items]
  );
  const timelineLayout = useMemo(
    () => buildTimelineLayout(projectDetail?.items ?? [], timelineColumns),
    [projectDetail?.items, timelineColumns]
  );
  const selectedItem = useMemo(
    () => {
      const allItems = projectDetail?.items ?? [];
      if (viewMode === "project" && hasProjectSearchFilter) {
        return (
          allItems.find((item) => item.id === selectedItemId && visibleProjectRowIds.has(item.id)) ??
          rows[0]?.item ??
          null
        );
      }
      return allItems.find((item) => item.id === selectedItemId) ?? allItems[0] ?? null;
    },
    [hasProjectSearchFilter, projectDetail?.items, rows, selectedItemId, viewMode, visibleProjectRowIds]
  );
  const bulkTaskParent = selectedItemId && selectedItem?.id === selectedItemId ? selectedItem : null;
  const metricItems =
    viewMode === "project" && hasProjectSearchFilter
      ? (projectDetail?.items ?? []).filter((item) => visibleProjectRowIds.has(item.id))
      : projectDetail?.items ?? [];
  const openCount = metricItems.filter((item) => item.status !== "done").length;
  const completedCount = metricItems.filter((item) => item.status === "done").length;
  const projectAssigneeSummaries = useMemo(
    () =>
      projectDetail
        ? buildAssigneeSummaries([
            {
              project: projectDetail.project,
              items: projectDetail.items,
            },
          ])
        : [],
    [projectDetail]
  );
  const activeSearchFilterChips = useMemo(
    () =>
      searchableViewMode
        ? buildSearchFilterChips(activeSearchFilter, projects, language)
        : [],
    [activeSearchFilter, language, projects, searchableViewMode]
  );
  const sidebarProjects = useMemo(() => {
    const query = projectListQuery.trim().toLocaleLowerCase();
    if (!query) {
      return projects;
    }
    return projects.filter((project) =>
      `${project.code} ${project.name} ${project.ownerName}`.toLocaleLowerCase().includes(query)
    );
  }, [projectListQuery, projects]);
  const updateCurrentSearchFilter = useCallback(
    (patch: Partial<SearchFilterState>) => {
      if (!searchableViewMode) {
        return;
      }
      setSearchFiltersByView((current) => ({
        ...current,
        [searchableViewMode]: {
          ...current[searchableViewMode],
          ...patch,
        },
      }));
    },
    [searchableViewMode]
  );
  const clearCurrentSearchFilter = useCallback(() => {
    if (!searchableViewMode) {
      return;
    }
    setSearchFiltersByView((current) => ({
      ...current,
      [searchableViewMode]: createEmptySearchFilterState(),
    }));
  }, [searchableViewMode]);
  const switchView = useCallback((nextViewMode: ViewMode) => {
    setViewMode(nextViewMode);
    if (nextViewMode === "project" || nextViewMode === "settings") {
      setSearchDrawerOpen(false);
    }
  }, []);

  useEffect(() => {
    const viewportHeight =
      wbsScrollRef.current?.clientHeight ??
      timelineScrollRef.current?.clientHeight ??
      PROJECT_DETAIL_DEFAULT_VIEWPORT_HEIGHT;
    setProjectDetailViewportHeight(viewportHeight);
  }, [rows.length, viewMode]);

  useEffect(() => {
    if (wbsScrollRef.current) {
      wbsScrollRef.current.scrollTop = 0;
    }
    if (timelineScrollRef.current) {
      timelineScrollRef.current.scrollTop = 0;
    }
    syncLockRef.current = null;

    const timeoutId = window.setTimeout(() => {
      setProjectDetailScrollTop(0);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [projectDetail?.project.id]);

  useEffect(() => {
    if (!pendingTimelineFocusRestoreItemId || pendingRescheduleChange) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const timelineItem = document.querySelector<HTMLElement>(
        `[data-timeline-item-id="${pendingTimelineFocusRestoreItemId}"]`
      );
      timelineItem?.focus();
      setPendingTimelineFocusRestoreItemId(null);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [pendingRescheduleChange, pendingTimelineFocusRestoreItemId]);

  const requestProjectItemUpdate = (item: ItemRecord, patch: ProjectItemUpdatePatch) => {
    if (shouldPromptReschedule(item, patch, projectDetail?.items ?? [])) {
      setPendingRescheduleChange({
        item,
        patch: {
          startDate: patch.startDate ?? item.startDate,
          endDate: patch.endDate ?? item.endDate,
        },
      });
      return;
    }

    void updateItem({ id: item.id, ...patch });
  };

  const applyTimelineAdjustment = useCallback((
    item: ItemRecord,
    scale: TimelineScale,
    mode: TimelineInteractionMode,
    deltaUnits: number
  ) => {
    if (deltaUnits === 0) {
      return;
    }

    const nextDates = applyTimelineInteraction(item, scale, mode, deltaUnits);
    if (
      !nextDates ||
      (nextDates.startDate === item.startDate && nextDates.endDate === item.endDate)
    ) {
      return;
    }

    if (
      shouldPromptReschedule(
        item,
        {
          startDate: nextDates.startDate,
          endDate: nextDates.endDate,
        },
        projectDetail?.items ?? []
      )
    ) {
      setPendingTimelineFocusRestoreItemId(item.id);
      setPendingRescheduleChange({
        item,
        patch: {
          startDate: nextDates.startDate,
          endDate: nextDates.endDate,
        },
      });
      return;
    }

    void updateItem({
      id: item.id,
      startDate: nextDates.startDate,
      endDate: nextDates.endDate,
    });
  }, [projectDetail?.items, updateItem]);

  useEffect(() => {
    if (!activeTimelineEdit) {
      return;
    }

    const calculateDeltaUnits = (clientX: number, current: ActiveTimelineEdit) =>
      Math.round((clientX - current.startClientX) / current.columnWidth);

    const updatePreview = (clientX: number) => {
      setActiveTimelineEdit((current) =>
        current
          ? {
              ...current,
              deltaUnits: calculateDeltaUnits(clientX, current),
            }
          : null
      );
    };

    const finishEdit = (shouldCommit: boolean, clientX?: number) => {
      const current = activeTimelineEdit;
      setActiveTimelineEdit(null);
      const deltaUnits =
        clientX === undefined ? current.deltaUnits : calculateDeltaUnits(clientX, current);
      if (!shouldCommit) {
        return;
      }
      applyTimelineAdjustment(current.item, current.scale, current.mode, deltaUnits);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== activeTimelineEdit.pointerId) {
        return;
      }
      updatePreview(event.clientX);
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (event.pointerId !== activeTimelineEdit.pointerId) {
        return;
      }
      finishEdit(true, event.clientX);
    };

    const handlePointerCancel = (event: PointerEvent) => {
      if (event.pointerId !== activeTimelineEdit.pointerId) {
        return;
      }
      finishEdit(false);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerCancel);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
    };
  }, [activeTimelineEdit, applyTimelineAdjustment]);

  const beginTimelineEdit = (
    event: ReactPointerEvent<HTMLDivElement>,
    item: ItemRecord,
    mode: TimelineInteractionMode
  ) => {
    if (!item.startDate || !item.endDate || timelineColumns.length === 0) {
      return;
    }

    const row = event.currentTarget.closest(".timeline-row");
    if (!(row instanceof HTMLDivElement)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    setActiveTimelineEdit({
      item,
      itemId: item.id,
      mode,
      scale: PROJECT_TIMELINE_SCALE,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      columnWidth: Math.max(row.getBoundingClientRect().width / timelineColumns.length, 1),
      deltaUnits: 0,
    });
  };

  const focusAdjacentTimelineItem = (
    currentTarget: HTMLDivElement,
    direction: -1 | 1
  ) => {
    const timelineViewport = currentTarget.closest(".timeline-body");
    if (!(timelineViewport instanceof HTMLDivElement)) {
      return;
    }

    const focusableTimelineItems = Array.from(
      timelineViewport.querySelectorAll<HTMLElement>(".timeline-bar.interactive, .timeline-marker.interactive")
    ).filter((element) => element.tabIndex >= 0);
    const currentIndex = focusableTimelineItems.indexOf(currentTarget);
    if (currentIndex < 0) {
      return;
    }

    const nextTarget = focusableTimelineItems[currentIndex + direction];
    if (!nextTarget) {
      return;
    }

    nextTarget.focus();
  };

  const handleTimelineBarKeyDown = (
    event: ReactKeyboardEvent<HTMLDivElement>,
    item: ItemRecord,
    isMilestone: boolean
  ) => {
    if (
      (event.key === "ArrowUp" || event.key === "ArrowDown") &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.shiftKey
    ) {
      event.preventDefault();
      event.stopPropagation();
      focusAdjacentTimelineItem(event.currentTarget, event.key === "ArrowDown" ? 1 : -1);
      return;
    }

    if (!event.altKey) {
      return;
    }

    let mode: TimelineInteractionMode | null = null;
    let deltaUnits = 0;
    if (event.key === "ArrowLeft") {
      mode = event.shiftKey ? "resize_end" : "move";
      deltaUnits = -1;
    } else if (event.key === "ArrowRight") {
      mode = event.shiftKey ? "resize_end" : "move";
      deltaUnits = 1;
    }

    if (!mode || deltaUnits === 0) {
      return;
    }

    if (isMilestone && mode === "resize_end") {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setSelectedItemId(item.id);
    applyTimelineAdjustment(item, PROJECT_TIMELINE_SCALE, mode, deltaUnits);
  };

  useEffect(() => {
    if (viewMode !== "project") {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || isTextEditingElement(event.target)) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) {
        if (!canUndoItemEdit) {
          return;
        }
        event.preventDefault();
        void undoItemEdit();
        return;
      }

      if (key === "y" || (key === "z" && event.shiftKey)) {
        if (!canRedoItemEdit) {
          return;
        }
        event.preventDefault();
        void redoItemEdit();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [viewMode, canUndoItemEdit, canRedoItemEdit, undoItemEdit, redoItemEdit]);

  if (startupContext?.mode === "recovery") {
    return (
      <div className="app-shell">
        <main className="main-panel recovery-panel">
          <section className="recovery-screen">
            <div className="section-heading">
              <div>
                <p className="sidebar-label">{copy.recovery.label}</p>
                <h2>{copy.recovery.heading}</h2>
                <p className="capture-copy">{copy.recovery.copy}</p>
              </div>
            </div>
            <div className="error-banner">{startupContext.errorMessage}</div>
            <section className="backup-card" aria-label="Recovery Backups">
              <div className="section-heading">
                <div>
                  <p className="sidebar-label">{copy.recovery.recentBackupsLabel}</p>
                  <strong>{copy.recovery.candidatesHeading}</strong>
                </div>
              </div>
              {backups.length === 0 ? (
                <p className="empty-message">{copy.recovery.noBackups}</p>
              ) : (
                <div className="backup-list">
                  {backups.map((backup) => (
                    <div key={`${backup.fileName}-${backup.createdAt}`} className="backup-list-item">
                      <div className="backup-list-item-main">
                        <strong>
                          <span className={`backup-kind-badge ${getBackupKindLabel(backup.fileName)}`}>
                            {getBackupKindLabel(backup.fileName)}
                          </span>
                          {backup.fileName}
                        </strong>
                        <span>{formatBackupCreatedAt(backup.createdAt)}</span>
                        <span>{formatBackupSize(backup.sizeBytes)}</span>
                      </div>
                      <button
                        type="button"
                        className="nav-chip"
                        onClick={() => void previewBackup(backup)}
                      >
                        Restore Preview
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {backupPreview ? (
                <BackupPreviewCard
                  language={language}
                  preview={backupPreview}
                  onRestore={() => void restoreBackup(backupPreview)}
                  onClose={clearBackupPreview}
                />
              ) : null}
            </section>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="shell" data-theme={theme}>
      <aside className="sidebar">
        <div>
          <p className="sidebar-label">{copy.sidebar.workspaceLabel}</p>
          <h1>Simple Gantt Chart</h1>
          <p className="sidebar-copy">{copy.sidebar.copy}</p>
        </div>

        <div className="nav-stack">
          <button
            type="button"
            className={viewMode === "home" ? "nav-chip active" : "nav-chip"}
            onClick={() => switchView("home")}
            aria-label="Home / Today"
          >
            {copy.sidebar.nav.home}
          </button>
          <button
            type="button"
            className={viewMode === "portfolio" ? "nav-chip active" : "nav-chip"}
            onClick={() => switchView("portfolio")}
            aria-label="Portfolio"
          >
            {copy.sidebar.nav.portfolio}
          </button>
          <button
            type="button"
            className={viewMode === "roadmap" ? "nav-chip active" : "nav-chip"}
            onClick={() => switchView("roadmap")}
            aria-label="Year / FY"
          >
            {copy.sidebar.nav.roadmap}
          </button>
          <button
            type="button"
            className={viewMode === "project" ? "nav-chip active" : "nav-chip"}
            onClick={() => switchView("project")}
            disabled={!selectedProjectId}
            aria-label="Project Detail"
          >
            {copy.sidebar.nav.project}
          </button>
          <button
            type="button"
            className={viewMode === "settings" ? "nav-chip active" : "nav-chip"}
            onClick={() => switchView("settings")}
            aria-label="Settings"
          >
            {copy.sidebar.nav.settings}
          </button>
        </div>

        <form
          className="project-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!newProjectName.trim()) {
              return;
            }
            void createProject({
              name: newProjectName.trim(),
              code: newProjectCode.trim() || undefined,
            });
            switchView("project");
            setNewProjectName("");
            setNewProjectCode("");
          }}
        >
          <label>
            {copy.sidebar.projectNameLabel}
            <input
              value={newProjectName}
              onChange={(event) => setNewProjectName(event.target.value)}
              placeholder={copy.sidebar.projectNamePlaceholder}
            />
          </label>
          <label>
            {copy.sidebar.codeLabel}
            <input
              value={newProjectCode}
              onChange={(event) => setNewProjectCode(event.target.value)}
              placeholder={copy.sidebar.codePlaceholder}
            />
          </label>
          <button type="submit">{copy.sidebar.createProject}</button>
        </form>

        <section className="sidebar-projects" aria-label={copy.sidebar.projectListLabel}>
          <div className="sidebar-projects-header">
            <div>
              <p className="sidebar-label">{copy.sidebar.projectListLabel}</p>
              <strong>{copy.sidebar.projectCount(sidebarProjects.length, projects.length)}</strong>
            </div>
            <button
              type="button"
              className="nav-chip"
              aria-expanded={!projectListCollapsed}
              onClick={() => setProjectListCollapsed((current) => !current)}
            >
              {projectListCollapsed
                ? copy.sidebar.projectListCollapsed
                : copy.sidebar.projectListExpanded}
            </button>
          </div>
          {projectListCollapsed ? null : (
            <>
              <input
                className="project-search-input"
                aria-label={copy.sidebar.projectSearchPlaceholder}
                value={projectListQuery}
                onChange={(event) => setProjectListQuery(event.target.value)}
                placeholder={copy.sidebar.projectSearchPlaceholder}
              />
              <div className="project-list" ref={projectListScrollRef}>
                {projects.length === 0 ? (
                  <p className="empty-message">{copy.sidebar.emptyProjects}</p>
                ) : sidebarProjects.length === 0 ? (
                  <p className="empty-message">{copy.project.emptyFilteredRows}</p>
                ) : (
                  sidebarProjects.map((project) => (
                    <button
                      key={project.id}
                      className={
                        project.id === selectedProjectId ? "project-card selected" : "project-card"
                      }
                      onClick={() => {
                        setQuickTaskTitle("");
                        switchView("project");
                        void selectProject(project.id);
                      }}
                      type="button"
                      title={`${project.code} ${project.name}`}
                    >
                      <span className="project-card-code">{project.code}</span>
                      <strong>{project.name}</strong>
                      <span className="project-card-progress">{project.progressCached}%</span>
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </section>

        <section className="backup-card" aria-label="Data Protection">
          <div className="section-heading">
            <div>
              <p className="sidebar-label">{copy.sidebar.dataProtectionLabel}</p>
              <strong>{copy.sidebar.localBackups}</strong>
              <p className="detail-field-hint">{autoBackupPolicyText}</p>
            </div>
            <div className="backup-actions">
              <button type="button" className="nav-chip active" onClick={() => void createBackup()}>
                {copy.sidebar.backupNow}
              </button>
              <button type="button" className="nav-chip" onClick={() => void createTextBackup()}>
                {copy.sidebar.textGitBackup}
              </button>
            </div>
          </div>
          {backups.length === 0 ? (
            <p className="empty-message">{copy.sidebar.noBackups}</p>
          ) : (
            <div className="backup-list">
              {backups.slice(0, 5).map((backup) => (
                <div key={`${backup.fileName}-${backup.createdAt}`} className="backup-list-item">
                  <div className="backup-list-item-main">
                    <strong>
                      <span className={`backup-kind-badge ${getBackupKindLabel(backup.fileName)}`}>
                        {getBackupKindLabel(backup.fileName)}
                      </span>
                      {backup.fileName}
                    </strong>
                    <span>{formatBackupCreatedAt(backup.createdAt)}</span>
                    <span>{formatBackupSize(backup.sizeBytes)}</span>
                  </div>
                  <button
                    type="button"
                    className="nav-chip"
                    onClick={() => void previewBackup(backup)}
                  >
                    {copy.sidebar.restorePreview}
                  </button>
                </div>
              ))}
            </div>
          )}
          {backupPreview ? (
            <BackupPreviewCard
              language={language}
              preview={backupPreview}
              onRestore={() => void restoreBackup(backupPreview)}
              onClose={clearBackupPreview}
            />
          ) : null}
        </section>
      </aside>

      <main className="main-panel">
        {error ? <div className="error-banner">{error}</div> : null}
        {notice ? <div className="notice-banner">{notice}</div> : null}
        {searchableViewMode ? (
          <SearchFilterToolbar
            language={language}
            viewMode={searchableViewMode}
            filter={activeSearchFilter}
            chips={activeSearchFilterChips}
            isOpen={searchDrawerOpen}
            onToggle={() => setSearchDrawerOpen((current) => !current)}
            onClear={clearCurrentSearchFilter}
          />
        ) : null}
        {searchableViewMode && searchDrawerOpen ? (
          <SearchFilterDrawer
            language={language}
            projects={projects}
            filter={activeSearchFilter}
            onChange={updateCurrentSearchFilter}
            onClear={clearCurrentSearchFilter}
            onClose={() => setSearchDrawerOpen(false)}
          />
        ) : null}

        {viewMode === "home" ? (
          <HomeView
            language={language}
            summary={homeSummary}
            projects={projects}
            searchFilter={searchFiltersByView.home}
            quickCaptureText={quickCaptureText}
            setQuickCaptureText={setQuickCaptureText}
            onQuickCapture={async () => {
              if (!quickCaptureText.trim()) {
                return;
              }
              await captureQuickEntry(quickCaptureText.trim());
              setQuickCaptureText("");
            }}
            onOpenProject={(projectId) => {
              switchView("project");
              void selectProject(projectId);
            }}
            onBulkPostpone={(target) => void bulkPostponeOverdue(target)}
            onAssignInboxProject={(itemId, projectId) => void updateItem({ id: itemId, projectId })}
            onAddInboxDate={(itemId, date) =>
              void updateItem({
                id: itemId,
                startDate: date,
                endDate: date,
              })
            }
            onAddInboxTags={(itemId, tags) => void updateItem({ id: itemId, tags })}
            onConvertInboxToTemplate={async (itemId) => {
              const result = await convertInboxItemToTemplateProject(itemId);
              if (!result) {
                return;
              }
              switchView("project");
              setSelectedItemId(result.itemId);
              setTemplatePanelOpen(true);
            }}
          />
        ) : viewMode === "portfolio" ? (
          <PortfolioView
            language={language}
            summary={portfolioSummary}
            projects={projects}
            searchFilter={searchFiltersByView.portfolio}
            weekStartsOn={settings?.weekStartsOn ?? "monday"}
            onOpenProject={(projectId) => {
              switchView("project");
              void selectProject(projectId);
            }}
          />
        ) : viewMode === "roadmap" ? (
          <RoadmapView
            language={language}
            projects={projects}
            searchFilter={searchFiltersByView.roadmap}
            fyStartMonth={settings?.fyStartMonth ?? 4}
            showRoadmapWorkload={settings?.showRoadmapWorkload ?? false}
            onOpenProject={(projectId) => {
              switchView("project");
              void selectProject(projectId);
            }}
          />
        ) : viewMode === "settings" ? (
          <SettingsView
            key={settings?.updatedAt ?? "settings-empty"}
            settings={settings}
            language={language}
            onSave={(input) => updateSettings(input)}
          />
        ) : !projectDetail ? (
          <section className="empty-panel">
            <h2>Project 0件</h2>
            <p>Quick Capture か Excel Import から始めて下さい</p>
          </section>
        ) : (
          <>
            <header className="project-header">
              <div>
                <p className="sidebar-label">{copy.project.headerLabel}</p>
                <div className="project-header-fields">
                  <label>
                    {copy.project.nameLabel}
                    <input
                      key={`${projectDetail.project.id}-name-${projectDetail.project.updatedAt}`}
                      defaultValue={projectDetail.project.name}
                      onBlur={(event) =>
                        void updateProject({
                          id: projectDetail.project.id,
                          name: event.target.value.trim() || projectDetail.project.name,
                          code: projectDetail.project.code,
                          ownerName: projectDetail.project.ownerName,
                        })
                      }
                    />
                  </label>
                  <label>
                    {copy.project.codeLabel}
                    <input
                      key={`${projectDetail.project.id}-code-${projectDetail.project.updatedAt}`}
                      defaultValue={projectDetail.project.code}
                      onBlur={(event) =>
                        void updateProject({
                          id: projectDetail.project.id,
                          name: projectDetail.project.name,
                          code: event.target.value.trim() || projectDetail.project.code,
                          ownerName: projectDetail.project.ownerName,
                        })
                      }
                    />
                  </label>
                  <label>
                    {copy.project.ownerLabel}
                    <input
                      key={`${projectDetail.project.id}-owner-${projectDetail.project.updatedAt}`}
                      defaultValue={projectDetail.project.ownerName}
                      placeholder={copy.project.ownerPlaceholder}
                      onBlur={(event) =>
                        void updateProject({
                          id: projectDetail.project.id,
                          name: projectDetail.project.name,
                          code: projectDetail.project.code,
                          ownerName: event.target.value.trim(),
                        })
                      }
                    />
                  </label>
                </div>
              </div>

              <div className="stats-grid">
                <MetricCard label={copy.project.totalTasks} value={String(projectDetail.items.length)} />
                <MetricCard label={copy.project.openTasks} value={String(openCount)} />
                <MetricCard label={copy.project.completedTasks} value={String(completedCount)} />
                <MetricCard label={copy.project.progress} value={`${projectDetail.project.progressCached}%`} />
              </div>

              <div className="timeline-scale-switch">
                <span>{copy.project.timeline}</span>
                <strong className="timeline-scale-badge">{copy.project.timelineDay}</strong>
                <p className="timeline-keyboard-hint">{copy.project.timelineKeyboardHint}</p>
              </div>

              <section className="assignee-summary-panel" aria-label={copy.project.teamSummaryTitle}>
                <div>
                  <p className="sidebar-label">{copy.project.teamSummaryLabel}</p>
                  <strong>{copy.project.teamSummaryTitle}</strong>
                  <p>{copy.project.teamSummaryCopy}</p>
                </div>
                <div className="assignee-chip-grid">
                  {projectAssigneeSummaries.length === 0 ? (
                    <span className="empty-chip">{copy.project.noAssignees}</span>
                  ) : (
                    projectAssigneeSummaries.map((summary) => (
                      <button
                        key={summary.name}
                        type="button"
                        className="assignee-summary-chip"
                        onClick={() => updateCurrentSearchFilter({ assigneeText: summary.name })}
                      >
                        <strong>
                          {summary.name}
                          {summary.name === projectDetail.project.ownerName ? ` / ${copy.project.mainOwnerBadge}` : ""}
                        </strong>
                        <span>
                          {copy.project.assigneeSummary(summary.open, summary.done, summary.overdue)}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </section>
            </header>

            {importPreview ? (
              <ImportPreviewPanel
                language={language}
                preview={importPreview}
                onCommit={() => void commitProjectImport()}
                onClose={clearImportPreview}
              />
            ) : null}

            {templatePanelOpen ? (
              <TemplatePanel
                language={language}
                templates={templates}
                project={projectDetail.project}
                selectedItem={selectedItem}
                projectCopy={copy.project}
                loading={loading}
                onSaveWbs={(rootItemId) => void saveWbsTemplate(rootItemId)}
                onSaveProject={(projectId) => void saveProjectTemplate(projectId)}
                onApplyWbs={(templateId) => {
                  setTemplatePanelOpen(false);
                  void applyWbsTemplate(templateId);
                }}
                onApplyProject={(templateId) => {
                  setTemplatePanelOpen(false);
                  void applyProjectTemplate(templateId);
                }}
                onClose={() => setTemplatePanelOpen(false)}
              />
            ) : null}

            <section className="toolbar">
              <div>
                <strong>{copy.project.wbsTree}</strong>
                <p>{copy.project.wbsTreeCopy}</p>
              </div>
              <div className="toolbar-actions">
                <button
                  type="button"
                  className="nav-chip"
                  onClick={() => void previewProjectImport()}
                  disabled={!selectedProjectId}
                >
                  {copy.project.importWorkbook}
                </button>
                <button
                  type="button"
                  className="nav-chip"
                  onClick={() => void exportProjectWorkbook()}
                  disabled={!selectedProjectId}
                >
                  {copy.project.exportWorkbook}
                </button>
                <button
                  type="button"
                  className={templatePanelOpen ? "nav-chip active" : "nav-chip"}
                  onClick={() => setTemplatePanelOpen((current) => !current)}
                  disabled={!selectedProjectId}
                >
                  {copy.project.templates}
                </button>
                <button type="button" className="nav-chip" onClick={() => void undoItemEdit()} disabled={!canUndoItemEdit}>
                  Undo
                </button>
                <button type="button" className="nav-chip" onClick={() => void redoItemEdit()} disabled={!canRedoItemEdit}>
                  Redo
                </button>
                <button type="button" onClick={() => void createItem(projectDetail.project.id, null)}>
                  {copy.project.addRootRow}
                </button>
              </div>
            </section>

            <form
              className="quick-task-add"
              onSubmit={async (event) => {
                event.preventDefault();
                const title = quickTaskTitle.trim();
                if (!title) {
                  return;
                }
                const item = await createItem(projectDetail.project.id, null, title, "task");
                if (item) {
                  setSelectedItemId(item.id);
                  setQuickTaskTitle("");
                }
              }}
            >
              <div>
                <p className="sidebar-label">{copy.project.quickAddLabel}</p>
                <strong>{copy.project.quickAddTitle}</strong>
              </div>
              <input
                aria-label={copy.project.quickAddTitle}
                value={quickTaskTitle}
                onChange={(event) => setQuickTaskTitle(event.target.value)}
                placeholder={copy.project.quickAddPlaceholder}
              />
              <button type="submit" disabled={!quickTaskTitle.trim()}>
                {copy.project.quickAddButton}
              </button>
            </form>

            <form
              className="bulk-task-add"
              onSubmit={async (event) => {
                event.preventDefault();
                const titles = parseBulkTaskTitles(bulkTaskTitles);
                if (titles.length === 0) {
                  return;
                }

                let lastCreatedItem: ItemRecord | null = null;
                const parentId = bulkTaskParent?.id ?? null;
                for (const title of titles) {
                  const createdItem = await createItem(projectDetail.project.id, parentId, title, "task");
                  if (createdItem) {
                    lastCreatedItem = createdItem;
                  }
                }

                if (parentId) {
                  setExpandedIds((current) => new Set(current).add(parentId));
                }
                if (lastCreatedItem) {
                  setSelectedItemId(lastCreatedItem.id);
                  setBulkTaskTitles("");
                }
              }}
            >
              <div>
                <p className="sidebar-label">{copy.project.bulkAddLabel}</p>
                <strong>{bulkTaskParent ? copy.project.bulkAddChildTitle : copy.project.bulkAddRootTitle}</strong>
                <span>{bulkTaskParent ? bulkTaskParent.title : copy.project.bulkAddRootHelp}</span>
              </div>
              <textarea
                aria-label={copy.project.bulkAddLabel}
                value={bulkTaskTitles}
                onChange={(event) => setBulkTaskTitles(event.target.value)}
                placeholder={copy.project.bulkAddPlaceholder}
                rows={4}
              />
              <button type="submit" disabled={parseBulkTaskTitles(bulkTaskTitles).length === 0}>
                {copy.project.bulkAddButton}
              </button>
            </form>

            <form
              className="event-day-add"
              onSubmit={async (event) => {
                event.preventDefault();
                const title = eventDayTitle.trim();
                if (!title || !eventDayDate) {
                  return;
                }

                const createdItem = await createItem(
                  projectDetail.project.id,
                  bulkTaskParent?.id ?? null,
                  title,
                  "milestone"
                );
                if (!createdItem) {
                  return;
                }

                await updateItem({
                  id: createdItem.id,
                  startDate: eventDayDate,
                  endDate: eventDayDate,
                  percentComplete: 0,
                });
                if (bulkTaskParent) {
                  setExpandedIds((current) => new Set(current).add(bulkTaskParent.id));
                }
                setSelectedItemId(createdItem.id);
                setEventDayTitle("");
                setEventDayDate("");
              }}
            >
              <div>
                <p className="sidebar-label">{copy.project.eventDayLabel}</p>
                <strong>{bulkTaskParent ? copy.project.eventDayChildTitle : copy.project.eventDayRootTitle}</strong>
                <span>{bulkTaskParent ? bulkTaskParent.title : copy.project.eventDayRootHelp}</span>
              </div>
              <input
                aria-label={copy.project.eventDayTitleLabel}
                value={eventDayTitle}
                onChange={(event) => setEventDayTitle(event.target.value)}
                placeholder={copy.project.eventDayTitlePlaceholder}
              />
              <input
                aria-label={copy.project.eventDayDateLabel}
                type="date"
                value={eventDayDate}
                onChange={(event) => setEventDayDate(event.target.value)}
              />
              <button type="submit" disabled={!eventDayTitle.trim() || !eventDayDate}>
                {copy.project.eventDayButton}
              </button>
            </form>

            <section className="project-workspace">
              <div className="wbs-panel">
                <div className="table-header table-row">
                  <span>WBS</span>
                  <span>種別</span>
                  <span>タイトル</span>
                  <span>状態</span>
                  <span>優先</span>
                  <span>担当</span>
                  <span>開始</span>
                  <span>終了</span>
                  <span>進捗</span>
                  <span>タグ</span>
                  <span>操作</span>
                </div>
                <div
                  ref={wbsScrollRef}
                  className="table-body"
                  onScroll={(event) => {
                    setProjectDetailScrollTop(event.currentTarget.scrollTop);
                    setProjectDetailViewportHeight(event.currentTarget.clientHeight);
                    syncVerticalScroll({
                      source: "wbs",
                      event,
                      peer: timelineScrollRef.current,
                      syncLockRef,
                    });
                  }}
                >
                  {rows.length === 0 ? (
                    <div className="empty-table">
                      {hasProjectSearchFilter
                        ? copy.project.emptyFilteredRows
                        : copy.project.emptyTreeRows}
                    </div>
                  ) : (
                    <>
                      {virtualWindow.topSpacerHeight > 0 ? (
                        <div
                          className="virtual-scroll-spacer"
                          style={{ height: `${virtualWindow.topSpacerHeight}px` }}
                          aria-hidden="true"
                        />
                      ) : null}
                      {visibleRows.map(({ item, depth, hasChildren }) => (
                        <ItemRow
                          key={item.id}
                          item={item}
                          depth={depth}
                          hasChildren={hasChildren}
                          expanded={effectiveExpandedIds.has(item.id)}
                          onToggle={() =>
                            setExpandedIds((current) => {
                              const next = new Set(current);
                              if (next.has(item.id)) {
                                next.delete(item.id);
                              } else {
                                next.add(item.id);
                              }
                              return next;
                            })
                          }
                          onUpdate={(patch) => requestProjectItemUpdate(item, patch)}
                          onAddChild={() => void createItem(projectDetail.project.id, item.id)}
                          onArchive={() => void archiveItem(item.id)}
                          onMoveHierarchy={(direction) => void moveItemHierarchy(item.id, direction)}
                          onReorderStart={() => {
                            setSelectedItemId(item.id);
                            setItemContextMenu(null);
                            activeRowDragItemIdRef.current = item.id;
                            setActiveRowDragItemId(item.id);
                            setPendingRowDrop(null);
                          }}
                          onReorderHover={(placement) => {
                            const draggedItem = activeRowDragItemIdRef.current
                              ? projectDetail.items.find((entry) => entry.id === activeRowDragItemIdRef.current) ?? null
                              : null;
                            if (
                              !draggedItem ||
                              draggedItem.id === item.id ||
                              draggedItem.parentId !== item.parentId
                            ) {
                              setPendingRowDrop(null);
                              return;
                            }
                            setPendingRowDrop({
                              targetItemId: item.id,
                              placement,
                            });
                          }}
                          onReorderDrop={(placement) => {
                            const draggedItemId = activeRowDragItemIdRef.current;
                            const draggedItem = draggedItemId
                              ? projectDetail.items.find((entry) => entry.id === draggedItemId) ?? null
                              : null;
                            if (
                              !draggedItemId ||
                              !draggedItem ||
                              draggedItem.id === item.id ||
                              draggedItem.parentId !== item.parentId
                            ) {
                              setPendingRowDrop(null);
                              activeRowDragItemIdRef.current = null;
                              setActiveRowDragItemId(null);
                              return;
                            }
                            setSelectedItemId(draggedItemId);
                            void reorderItemRow(draggedItemId, item.id, placement);
                            setPendingRowDrop(null);
                            activeRowDragItemIdRef.current = null;
                            setActiveRowDragItemId(null);
                          }}
                          onReorderEnd={() => {
                            setPendingRowDrop(null);
                            activeRowDragItemIdRef.current = null;
                            setActiveRowDragItemId(null);
                          }}
                          onOpenDetail={() => setSelectedItemId(item.id)}
                          onOpenContextMenu={(position) => {
                            setSelectedItemId(item.id);
                            setItemContextMenu({
                              item,
                              x: position.x,
                              y: position.y,
                            });
                          }}
                          isSelected={selectedItem?.id === item.id}
                          isDragSource={activeRowDragItemId === item.id}
                          dropPlacement={
                            pendingRowDrop?.targetItemId === item.id ? pendingRowDrop.placement : null
                          }
                        />
                      ))}
                      {virtualWindow.bottomSpacerHeight > 0 ? (
                        <div
                          className="virtual-scroll-spacer"
                          style={{ height: `${virtualWindow.bottomSpacerHeight}px` }}
                          aria-hidden="true"
                        />
                      ) : null}
                    </>
                  )}
                </div>
              </div>

              <div className="timeline-panel">
                <div
                  className="timeline-header"
                  style={{
                    gridTemplateColumns: `repeat(${timelineColumns.length}, minmax(64px, 1fr))`,
                  }}
                >
                  {timelineColumns.map((column) => (
                    <div key={column.key} className="timeline-header-cell" title={column.label}>
                      <span>{column.shortLabel}</span>
                    </div>
                  ))}
                </div>
                <div
                  ref={timelineScrollRef}
                  className="timeline-body"
                  onScroll={(event) => {
                    setProjectDetailScrollTop(event.currentTarget.scrollTop);
                    setProjectDetailViewportHeight(event.currentTarget.clientHeight);
                    syncVerticalScroll({
                      source: "timeline",
                      event,
                      peer: wbsScrollRef.current,
                      syncLockRef,
                    });
                  }}
                >
                  {rows.length === 0 ? (
                    <div className="empty-table">
                      {hasProjectSearchFilter
                        ? copy.project.emptyFilteredRows
                        : copy.project.emptyTimelineRows}
                    </div>
                  ) : (
                    <>
                      {virtualWindow.topSpacerHeight > 0 ? (
                        <div
                          className="virtual-scroll-spacer"
                          style={{ height: `${virtualWindow.topSpacerHeight}px` }}
                          aria-hidden="true"
                        />
                      ) : null}
                      {visibleRows.map(({ item }) => {
                        const layout = timelineLayout.get(item.id);
                        const isDraggable = Boolean(item.startDate && item.endDate);
                        const previewLayout =
                          layout && activeTimelineEdit?.itemId === item.id
                            ? getPreviewLayout(
                                layout,
                                activeTimelineEdit.mode,
                                activeTimelineEdit.deltaUnits,
                                timelineColumns.length
                              )
                            : layout;
                        return (
                          <div
                            key={item.id}
                            className="timeline-row"
                            style={{
                              gridTemplateColumns: `repeat(${timelineColumns.length}, minmax(64px, 1fr))`,
                            }}
                          >
                            {timelineColumns.map((column) => (
                              <div key={column.key} className="timeline-cell" />
                            ))}
                            {previewLayout ? (
                              <div
                                className={
                                  previewLayout.isMilestone
                                    ? `timeline-marker${isDraggable ? " interactive" : ""}${
                                        selectedItem?.id === item.id ? " selected" : ""
                                      }`
                                    : `timeline-bar ${item.type}${isDraggable ? " interactive" : ""}${
                                        activeTimelineEdit?.itemId === item.id ? " dragging" : ""
                                      }${selectedItem?.id === item.id ? " selected" : ""}`
                                }
                                style={{
                                  gridColumn: `${previewLayout.startColumn + 1} / ${
                                    previewLayout.endColumn + 2
                                  }`,
                                }}
                                title={`${item.title} ${formatDateRange(item)}`}
                                tabIndex={isDraggable ? 0 : -1}
                                role={isDraggable ? "button" : undefined}
                                aria-label={
                                  isDraggable
                                    ? `${item.title} ${formatDateRange(item)}。${
                                        previewLayout.isMilestone
                                          ? "上下で前後の項目へ移動、Alt+左右で移動"
                                          : "上下で前後の項目へ移動、Alt+左右で移動、Alt+Shift+左右で右端を調整"
                                      }`
                                    : undefined
                                }
                                aria-keyshortcuts={
                                  isDraggable
                                    ? previewLayout.isMilestone
                                      ? "ArrowUp ArrowDown Alt+ArrowLeft Alt+ArrowRight"
                                      : "ArrowUp ArrowDown Alt+ArrowLeft Alt+ArrowRight Alt+Shift+ArrowLeft Alt+Shift+ArrowRight"
                                    : undefined
                                }
                                data-timeline-item-id={item.id}
                                onFocus={() => setSelectedItemId(item.id)}
                                onClick={() => setSelectedItemId(item.id)}
                                onKeyDown={
                                  isDraggable
                                    ? (event) =>
                                        handleTimelineBarKeyDown(event, item, previewLayout.isMilestone)
                                    : undefined
                                }
                                onPointerDown={
                                  isDraggable
                                    ? (event) => beginTimelineEdit(event, item, "move")
                                    : undefined
                                }
                              >
                                {!previewLayout.isMilestone && isDraggable ? (
                                  <div
                                    className="timeline-resize-handle"
                                    role="presentation"
                                    onPointerDown={(event) =>
                                      beginTimelineEdit(event, item, "resize_end")
                                    }
                                  />
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                      {virtualWindow.bottomSpacerHeight > 0 ? (
                        <div
                          className="virtual-scroll-spacer"
                          style={{ height: `${virtualWindow.bottomSpacerHeight}px` }}
                          aria-hidden="true"
                        />
                      ) : null}
                    </>
                  )}
                </div>
              </div>
            </section>

            <DetailDrawer
              item={selectedItem}
              projectItems={projectDetail.items}
              onSelectItem={(itemId) => setSelectedItemId(itemId)}
              onUpdateItem={(patch) =>
                selectedItem ? requestProjectItemUpdate(selectedItem, patch) : undefined
              }
              onUpsertRecurrenceRule={upsertRecurrenceRule}
              onDeleteRecurrenceRule={deleteRecurrenceRule}
            />
          </>
        )}

        {pendingRescheduleChange ? (
          <RescheduleScopeDialog
            item={pendingRescheduleChange.item}
            descendantCount={countDescendants(projectDetail?.items ?? [], pendingRescheduleChange.item.id)}
            onCancel={() => {
              setPendingTimelineFocusRestoreItemId(pendingRescheduleChange.item.id);
              setPendingRescheduleChange(null);
            }}
            onSelect={(scope) => {
              setPendingTimelineFocusRestoreItemId(pendingRescheduleChange.item.id);
              void updateItem({
                id: pendingRescheduleChange.item.id,
                ...pendingRescheduleChange.patch,
                rescheduleScope: scope,
              });
              setPendingRescheduleChange(null);
            }}
          />
        ) : null}

        {itemContextMenu ? (
          <ItemContextMenu
            item={itemContextMenu.item}
            x={itemContextMenu.x}
            y={itemContextMenu.y}
            onClose={() => setItemContextMenu(null)}
            onOpenDetail={() => {
              setSelectedItemId(itemContextMenu.item.id);
              setItemContextMenu(null);
            }}
            onAddChild={() => {
              void createItem(projectDetail!.project.id, itemContextMenu.item.id);
              setItemContextMenu(null);
            }}
            onMoveHierarchy={(direction) => {
              void moveItemHierarchy(itemContextMenu.item.id, direction);
              setItemContextMenu(null);
            }}
            onArchive={() => {
              void archiveItem(itemContextMenu.item.id);
              setItemContextMenu(null);
            }}
          />
        ) : null}

        {loading ? <div className="loading-chip">saving...</div> : null}
      </main>
    </div>
  );
}

function HomeView(props: {
  language: AppLanguage;
  summary: HomeSummary | null;
  projects: ProjectSummary[];
  searchFilter: SearchFilterState;
  quickCaptureText: string;
  setQuickCaptureText: (value: string) => void;
  onQuickCapture: () => Promise<void>;
  onOpenProject: (projectId: string) => void;
  onBulkPostpone: (target: PostponeTarget) => void;
  onAssignInboxProject: (itemId: string, projectId: string) => void;
  onAddInboxDate: (itemId: string, date: string) => void;
  onAddInboxTags: (itemId: string, tags: string[]) => void;
  onConvertInboxToTemplate: (itemId: string) => Promise<void>;
}) {
  const copy = getUiCopy(props.language);
  const {
    summary,
    projects,
    searchFilter,
    quickCaptureText,
    setQuickCaptureText,
    onQuickCapture,
    onOpenProject,
    onBulkPostpone,
    onAssignInboxProject,
    onAddInboxDate,
    onAddInboxTags,
    onConvertInboxToTemplate,
  } = props;
  const projectMap = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects]
  );
  const visibleItems = useMemo(() => {
    const sections = [
      ...(summary?.inboxItems ?? []),
      ...(summary?.todayItems ?? []),
      ...(summary?.overdueItems ?? []),
      ...(summary?.weekMilestones ?? []),
    ];
    return Array.from(new Map(sections.map((item) => [item.id, item])).values());
  }, [summary]);
  const detailItemsByProjectId = useMemo(() => {
    const next = new Map<string, ItemRecord[]>();
    for (const item of visibleItems) {
      const bucket = next.get(item.projectId) ?? [];
      bucket.push(item);
      next.set(item.projectId, bucket);
    }
    return next;
  }, [visibleItems]);
  const filterItems = useCallback(
    (items: ItemRecord[]) =>
      items.filter((item) =>
        itemMatchesSearchFilter({
          item,
          project: projectMap.get(item.projectId) ?? null,
          filter: searchFilter,
        })
      ),
    [projectMap, searchFilter]
  );
  const filteredInboxItems = filterItems(summary?.inboxItems ?? []);
  const filteredTodayItems = filterItems(summary?.todayItems ?? []);
  const filteredOverdueItems = filterItems(summary?.overdueItems ?? []);
  const filteredWeekMilestones = filterItems(summary?.weekMilestones ?? []);
  const filteredRecentProjects = (summary?.recentProjects ?? []).filter((project) =>
    projectMatchesSearchFilter({
      project,
      detailItems: detailItemsByProjectId.get(project.id) ?? [],
      filter: searchFilter,
    })
  );

  return (
    <>
      <section className="capture-panel">
        <div>
          <p className="sidebar-label">Quick Capture</p>
          <h2>{copy.home.heading}</h2>
          <p className="capture-copy">{copy.home.copy}</p>
        </div>
        <form
          className="capture-form"
          onSubmit={(event) => {
            event.preventDefault();
            void onQuickCapture();
          }}
        >
          <input
            value={quickCaptureText}
            onChange={(event) => setQuickCaptureText(event.target.value)}
            placeholder={copy.home.placeholder}
          />
          <button type="submit">{copy.home.add}</button>
        </form>
      </section>

      <section className="stats-grid">
        <MetricCard label="Inbox" value={String(filteredInboxItems.length)} />
        <MetricCard label="Today" value={String(filteredTodayItems.length)} />
        <MetricCard label="Overdue" value={String(filteredOverdueItems.length)} />
        <MetricCard label={copy.home.weekMilestonesMetric} value={String(filteredWeekMilestones.length)} />
      </section>

      <section className="home-grid">
        <SectionCard title="Inbox" subtitle={copy.home.inboxSubtitle}>
          <InboxTaskList
            language={props.language}
            items={filteredInboxItems}
            projects={projects}
            emptyMessage={copy.home.inboxEmpty}
            onAssignProject={onAssignInboxProject}
            onAddDate={onAddInboxDate}
            onAddTags={onAddInboxTags}
            onConvertToTemplate={onConvertInboxToTemplate}
          />
        </SectionCard>
        <SectionCard title={copy.home.today} subtitle={copy.home.todaySubtitle}>
          <TaskList items={filteredTodayItems} emptyMessage={copy.home.todayEmpty} />
        </SectionCard>
        <SectionCard title={copy.home.overdue} subtitle={copy.home.overdueSubtitle}>
          <div className="bulk-actions">
            <span>{copy.home.postpone}</span>
            <div className="bulk-actions-row">
              <button type="button" onClick={() => onBulkPostpone("today")} disabled={filteredOverdueItems.length === 0}>
                {copy.home.postponeToday}
              </button>
              <button type="button" onClick={() => onBulkPostpone("tomorrow")} disabled={filteredOverdueItems.length === 0}>
                {copy.home.postponeTomorrow}
              </button>
              <button type="button" onClick={() => onBulkPostpone("week_end")} disabled={filteredOverdueItems.length === 0}>
                {copy.home.postponeWeekEnd}
              </button>
            </div>
          </div>
          <TaskList items={filteredOverdueItems} emptyMessage={copy.home.overdueEmpty} />
        </SectionCard>
        <SectionCard title={copy.home.weekMilestones} subtitle={copy.home.weekMilestonesSubtitle}>
          <TaskList items={filteredWeekMilestones} emptyMessage={copy.home.weekMilestonesEmpty} />
        </SectionCard>
      </section>

      <section className="recent-projects">
        <div className="section-heading">
          <div>
            <strong>{copy.home.recentProjects}</strong>
            <p>{copy.home.recentProjectsCopy}</p>
          </div>
        </div>
        {filteredRecentProjects.length === 0 ? (
          <div className="empty-table">{copy.home.recentProjectsEmpty}</div>
        ) : (
          <div className="recent-project-list">
            {filteredRecentProjects.map((project) => (
              <button
                key={project.id}
                type="button"
                className="recent-project-card"
                onClick={() => onOpenProject(project.id)}
              >
                <span>{project.code}</span>
                <strong>{project.name}</strong>
                <span>{copy.home.recentProgress} {project.progressCached}%</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function RescheduleScopeDialog(props: {
  item: ItemRecord;
  descendantCount: number;
  onSelect: (scope: RescheduleScope) => void;
  onCancel: () => void;
}) {
  const scopeOptions: Array<{ scope: RescheduleScope; label: string }> = [
    { scope: "single", label: "このタスクだけ" },
    { scope: "with_descendants", label: "子も一緒に" },
    { scope: "with_dependents", label: "後続もずらす" },
  ];
  const [activeIndex, setActiveIndex] = useState(1);
  const dialogRef = useRef<HTMLElement | null>(null);
  const scopeButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    scopeButtonRefs.current[activeIndex]?.focus();
  }, [activeIndex]);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      props.onCancel();
      return;
    }

    if (event.key === "Tab") {
      const focusableButtons = Array.from(
        dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? []
      );
      if (focusableButtons.length === 0) {
        return;
      }

      const currentIndex = focusableButtons.indexOf(document.activeElement as HTMLButtonElement);
      if (currentIndex === -1) {
        event.preventDefault();
        focusableButtons[event.shiftKey ? focusableButtons.length - 1 : 0]?.focus();
        return;
      }

      if (!event.shiftKey && currentIndex === focusableButtons.length - 1) {
        event.preventDefault();
        focusableButtons[0]?.focus();
        return;
      }

      if (event.shiftKey && currentIndex === 0) {
        event.preventDefault();
        focusableButtons[focusableButtons.length - 1]?.focus();
        return;
      }
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      event.stopPropagation();
      setActiveIndex((current) => Math.max(current - 1, 0));
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      event.stopPropagation();
      setActiveIndex((current) => Math.min(current + 1, scopeOptions.length - 1));
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      event.stopPropagation();
      props.onSelect(scopeOptions[activeIndex].scope);
    }
  };

  return (
    <div className="reschedule-popover-backdrop" role="presentation" onClick={props.onCancel}>
      <section
        ref={dialogRef}
        className="reschedule-popover"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reschedule-scope-title"
        onKeyDown={handleKeyDown}
        onClick={(event) => event.stopPropagation()}
      >
        <p className="sidebar-label">Reschedule Scope</p>
        <h3 id="reschedule-scope-title">{props.item.title}</h3>
        <p className="reschedule-popover-copy">
          子孫を持つ行を移動しました。今回の変更範囲を選んで下さい。
        </p>
        <p className="reschedule-popover-meta">対象子孫: {props.descendantCount} 件</p>
        <div className="reschedule-popover-actions">
          {scopeOptions.map((option, index) => (
            <button
              key={option.scope}
              ref={(element) => {
                scopeButtonRefs.current[index] = element;
              }}
              type="button"
              className={index === activeIndex ? "nav-chip active" : "nav-chip"}
              aria-pressed={index === activeIndex}
              onFocus={() => setActiveIndex(index)}
              onClick={() => props.onSelect(option.scope)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="reschedule-popover-hint">dependency が無い場合は通常の move と同じ結果になります。</p>
        <div className="reschedule-popover-footer">
          <button type="button" className="nav-chip" onClick={props.onCancel}>
            キャンセル
          </button>
        </div>
      </section>
    </div>
  );
}

function SectionCard(props: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <section className="section-card">
      <div className="section-heading">
        <div>
          <strong>{props.title}</strong>
          <p>{props.subtitle}</p>
        </div>
      </div>
      {props.children}
    </section>
  );
}

function BackupPreviewCard(props: {
  language: AppLanguage;
  preview: BackupPreview;
  canRestore?: boolean;
  onRestore: () => void;
  onClose: () => void;
}) {
  const [confirmingRestore, setConfirmingRestore] = useState(false);
  const copy = getUiCopy(props.language).backupPreview;

  return (
    <section className="backup-preview-card" aria-label="Restore Preview">
      <div className="section-heading">
        <div>
          <strong>{copy.heading}</strong>
          <p>{copy.copy}</p>
        </div>
        <button type="button" className="nav-chip" onClick={props.onClose}>
          {copy.close}
        </button>
      </div>
      <div className="backup-preview-grid">
        <MetricCard label={copy.projectsLabel} value={String(props.preview.projectCount)} />
        <MetricCard label={copy.itemsLabel} value={String(props.preview.itemCount)} />
        <MetricCard
          label={copy.updatedLabel}
          value={
            props.preview.latestUpdatedAt
              ? formatBackupCreatedAt(props.preview.latestUpdatedAt)
              : "-"
          }
        />
      </div>
      <div className="backup-preview-meta">
        <div className="backup-preview-meta-row">
          <span>{copy.fileLabel}</span>
          <strong>{props.preview.fileName}</strong>
        </div>
        <div className="backup-preview-meta-row">
          <span>{copy.createdLabel}</span>
          <strong>{formatBackupCreatedAt(props.preview.createdAt)}</strong>
        </div>
        <div className="backup-preview-meta-row">
          <span>{copy.sizeLabel}</span>
          <strong>{formatBackupSize(props.preview.sizeBytes)}</strong>
        </div>
      </div>
      {props.canRestore === false ? (
        <p className="detail-field-hint">{copy.restoreDisabledNote}</p>
      ) : confirmingRestore ? (
        <div className="backup-restore-confirm">
          <strong>{copy.confirmHeading}</strong>
          <p>{copy.confirmCopy}</p>
          <div className="backup-restore-confirm-actions">
            <button
              type="button"
              className="nav-chip"
              onClick={() => setConfirmingRestore(false)}
            >
              {copy.cancel}
            </button>
            <button
              type="button"
              className="danger"
              onClick={() => {
                setConfirmingRestore(false);
                props.onRestore();
              }}
            >
              {copy.restore}
            </button>
          </div>
        </div>
      ) : (
        <div className="backup-restore-actions">
          <button
            type="button"
            className="danger"
            onClick={() => setConfirmingRestore(true)}
          >
            {copy.restore}
          </button>
        </div>
      )}
      {props.canRestore === false ? null : (
        <p className="detail-field-hint">{copy.afterRestoreNote}</p>
      )}
    </section>
  );
}

function TemplatePanel(props: {
  language: AppLanguage;
  templates: TemplateRecord[];
  project: ProjectSummary;
  selectedItem: ItemRecord | null;
  projectCopy: UiCopy["project"];
  loading: boolean;
  onSaveWbs: (rootItemId: string) => void;
  onSaveProject: (projectId: string) => void;
  onApplyWbs: (templateId: string) => void;
  onApplyProject: (templateId: string) => void;
  onClose: () => void;
}) {
  const wbsTemplates = props.templates.filter((template) => template.kind === "wbs");
  const projectTemplates = props.templates.filter((template) => template.kind === "project");
  const selectedRootItem = props.selectedItem && !props.selectedItem.parentId ? props.selectedItem : null;
  const canSaveWbsTemplate = Boolean(selectedRootItem);
  const wbsTemplateSaveHelp = canSaveWbsTemplate
    ? props.projectCopy.saveWbsTemplateHelp
    : props.projectCopy.saveWbsTemplateDisabled;

  return (
    <section className="template-panel" aria-label={props.projectCopy.templatePanelHeading}>
      <div className="section-heading">
        <div>
          <strong>{props.projectCopy.templatePanelHeading}</strong>
          <p>{props.projectCopy.templatePanelCopy}</p>
        </div>
        <div className="toolbar-actions">
          <button type="button" className="nav-chip" onClick={props.onClose}>
            {props.language === "en" ? "Close" : "閉じる"}
          </button>
        </div>
      </div>

      <div className="template-section-grid">
        <TemplateSection
          title={props.projectCopy.wbsTemplates}
          copy={props.projectCopy.wbsTemplatesCopy}
          saveActionLabel={props.projectCopy.saveWbsTemplate}
          saveActionHelp={wbsTemplateSaveHelp}
          saveActionDisabled={!canSaveWbsTemplate}
          onSave={selectedRootItem ? () => props.onSaveWbs(selectedRootItem.id) : undefined}
          emptyMessage={props.projectCopy.emptyTemplates}
          templates={wbsTemplates}
          updatedAtLabel={props.projectCopy.templateUpdatedAt}
          actionLabel={props.projectCopy.applyWbsTemplate}
          language={props.language}
          loading={props.loading}
          onApply={props.onApplyWbs}
        />
        <TemplateSection
          title={props.projectCopy.projectTemplates}
          copy={props.projectCopy.projectTemplatesCopy}
          saveActionLabel={props.projectCopy.saveProjectTemplate}
          saveActionHelp={props.projectCopy.saveProjectTemplateHelp}
          saveActionDisabled={false}
          onSave={() => props.onSaveProject(props.project.id)}
          emptyMessage={props.projectCopy.emptyTemplates}
          templates={projectTemplates}
          updatedAtLabel={props.projectCopy.templateUpdatedAt}
          actionLabel={props.projectCopy.applyProjectTemplate}
          language={props.language}
          loading={props.loading}
          onApply={props.onApplyProject}
        />
      </div>
    </section>
  );
}

function TemplateSection(props: {
  title: string;
  copy: string;
  saveActionLabel: string;
  saveActionHelp: string;
  saveActionDisabled: boolean;
  onSave?: () => void;
  emptyMessage: string;
  templates: TemplateRecord[];
  updatedAtLabel: string;
  actionLabel: string;
  language: AppLanguage;
  loading: boolean;
  onApply: (templateId: string) => void;
}) {
  return (
    <section className="template-section">
      <div className="template-section-header">
        <div>
          <strong>{props.title}</strong>
          <p>{props.copy}</p>
        </div>
        <button
          type="button"
          className="nav-chip"
          onClick={() => props.onSave?.()}
          disabled={props.loading || props.saveActionDisabled || !props.onSave}
        >
          {props.saveActionLabel}
        </button>
      </div>
      <div className="template-section-help">{props.saveActionHelp}</div>
      {props.templates.length === 0 ? (
        <div className="template-empty">{props.emptyMessage}</div>
      ) : (
        <div className="template-list">
          {props.templates.map((template) => (
            <div key={template.id} className="template-list-item">
              <div className="template-list-main">
                <strong>{template.name}</strong>
                <span>
                  {props.updatedAtLabel}: {formatDateTimeText(props.language, template.updatedAt)}
                </span>
              </div>
              <button
                type="button"
                className="nav-chip"
                onClick={() => props.onApply(template.id)}
                disabled={props.loading}
              >
                {props.actionLabel}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ImportPreviewPanel(props: {
  language: AppLanguage;
  preview: ProjectImportPreview;
  onCommit: () => void;
  onClose: () => void;
}) {
  const copy = getUiCopy(props.language).importPreview;
  const [filterMode, setFilterMode] = useState<"all" | "warning" | "error">("all");
  const [expandedCompareKeys, setExpandedCompareKeys] = useState<Set<string>>(new Set());
  const canCommit = props.preview.newCount + props.preview.updateCount > 0;
  const warningRows = props.preview.rows.filter((row) => row.warnings.length > 0);
  const warningCount = warningRows.length;
  const filteredRows = props.preview.rows.filter((row) => {
    if (filterMode === "warning") {
      return row.warnings.length > 0;
    }
    if (filterMode === "error") {
      return row.action === "error";
    }
    return true;
  });
  const emptyMessage =
    filterMode === "warning"
      ? copy.emptyWarning
      : filterMode === "error"
        ? copy.emptyError
        : copy.emptyAll;

  return (
    <section className="import-preview-panel">
      <div className="section-heading">
        <div>
          <strong>{copy.heading}</strong>
          <p>{props.preview.sourcePath ?? copy.selectedWorkbook}</p>
        </div>
        <div className="toolbar-actions">
          <button type="button" className="nav-chip" onClick={props.onCommit} disabled={!canCommit}>
            {copy.apply}
          </button>
          <button type="button" className="nav-chip" onClick={props.onClose}>
            {copy.close}
          </button>
        </div>
      </div>
      <div className="import-preview-counts">
        <MetricCard label="New" value={String(props.preview.newCount)} />
        <MetricCard label="Update" value={String(props.preview.updateCount)} />
        <MetricCard label="Warning" value={String(warningCount)} />
        <MetricCard label="Error" value={String(props.preview.errorCount)} />
      </div>
      {!props.preview.supportsDependencyImport ? (
        <div className="import-preview-policy-note">
          {copy.policyNote}
        </div>
      ) : null}
      {warningRows.length > 0 ? (
        <section className="import-preview-warning-summary" aria-label="Warning Summary">
          <div className="section-heading import-preview-warning-summary-heading">
            <div>
              <strong>{copy.warningSummaryHeading}</strong>
              <p>{copy.warningSummaryCopy}</p>
            </div>
          </div>
          <div className="import-preview-warning-summary-list">
            {warningRows.map((row) => (
              <article
                key={`summary-${row.rowNumber}-${row.recordId}-${row.title}`}
                className="import-preview-warning-summary-row"
              >
                <div className="import-preview-warning-summary-meta">
                  <span className="import-preview-warning-summary-row-number">Row {row.rowNumber}</span>
                  <strong>{row.title || row.recordId || "-"}</strong>
                  <span>{row.projectName || row.projectCode || "-"}</span>
                </div>
                <div className="import-preview-warnings">
                  {row.warnings.map((warning) => (
                    <span
                      key={`summary-${row.rowNumber}-${warning.field}-${warning.message}`}
                      className="import-preview-warning"
                    >
                      {warning.field}: {warning.message}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
      {warningRows.length > 0 ? (
        <section className="import-preview-warning-only" aria-label="Warning-only Table">
          <div className="section-heading import-preview-warning-summary-heading">
            <div>
              <strong>{copy.warningOnlyHeading}</strong>
              <p>{copy.warningOnlyCopy}</p>
            </div>
          </div>
          <div className="import-preview-warning-table">
            <div className="import-preview-warning-table-row import-preview-warning-table-header">
              <span>{copy.rowLabel}</span>
              <span>{copy.projectLabel}</span>
              <span>{copy.titleLabel}</span>
              <span>{copy.actionLabel}</span>
              <span>{copy.filterWarning}</span>
            </div>
            {warningRows.map((row) => (
              <div
                key={`warning-only-${row.rowNumber}-${row.recordId}-${row.title}`}
                className="import-preview-warning-table-row"
              >
                <span>
                  <span className="import-preview-warning-summary-row-number">Row {row.rowNumber}</span>
                </span>
                <span>{row.projectName || row.projectCode || "-"}</span>
                <div className="import-preview-warning-table-title">
                  <strong>{row.title || row.recordId || "-"}</strong>
                  <span>{row.message}</span>
                </div>
                <span className={`import-action-pill ${row.action}`}>{row.action}</span>
                <div className="import-preview-warnings">
                  {row.warnings.map((warning) => (
                    <span
                      key={`warning-only-${row.rowNumber}-${warning.field}-${warning.message}`}
                      className="import-preview-warning"
                    >
                      {warning.field}: {warning.message}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
      <div className="import-preview-filters">
        {[ 
          { id: "all", label: copy.filterAll },
          { id: "warning", label: copy.filterWarning },
          { id: "error", label: copy.filterError },
        ].map((filter) => (
          <button
            key={filter.id}
            type="button"
            className={`nav-chip ${filterMode === filter.id ? "active" : ""}`}
            onClick={() => setFilterMode(filter.id as "all" | "warning" | "error")}
          >
            {filter.label}
          </button>
        ))}
      </div>
      {filteredRows.length === 0 ? (
        <div className="empty-table">{emptyMessage}</div>
      ) : (
        <div className="import-preview-table">
          <div className="import-preview-row import-preview-header">
            <span>{copy.rowLabel}</span>
            <span>{copy.actionLabel}</span>
            <span>{copy.projectLabel}</span>
            <span>{copy.titleLabel}</span>
            <span>{copy.validationLabel}</span>
          </div>
          {filteredRows.map((row) => {
            const rowKey = `${row.rowNumber}-${row.recordId}-${row.title}`;
            const canCompare = row.action === "update" && row.changes.length > 0;
            const isCompareExpanded = expandedCompareKeys.has(rowKey);

            return (
              <div key={rowKey} className="import-preview-row">
                <span>{row.rowNumber}</span>
                <span className={`import-action-pill ${row.action}`}>{row.action}</span>
                <span>{row.projectName || row.projectCode || "-"}</span>
                <span>{row.title || "-"}</span>
                <div className="import-preview-message">
                  <span>{row.message}</span>
                  {row.issues.length > 0 ? (
                    <div className="import-preview-issues">
                      {row.issues.map((issue) => (
                        <span
                          key={`${row.rowNumber}-${issue.field}-${issue.message}`}
                          className="import-preview-issue"
                        >
                          {issue.field}: {issue.message}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {row.warnings.length > 0 ? (
                    <div className="import-preview-warnings">
                      {row.warnings.map((warning) => (
                        <span
                          key={`${row.rowNumber}-${warning.field}-${warning.message}`}
                          className="import-preview-warning"
                        >
                          {warning.field}: {warning.message}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {canCompare ? (
                    <div className="import-preview-compare-toggle">
                      <button
                        type="button"
                        className="nav-chip"
                        aria-expanded={isCompareExpanded}
                        onClick={() =>
                          setExpandedCompareKeys((current) => {
                            const next = new Set(current);
                            if (next.has(rowKey)) {
                              next.delete(rowKey);
                            } else {
                              next.add(rowKey);
                            }
                            return next;
                          })
                        }
                      >
                        {isCompareExpanded ? copy.compareClose : copy.compareOpen}
                      </button>
                    </div>
                  ) : null}
                  {canCompare && isCompareExpanded ? (
                    <div className="import-preview-compare" aria-label={`Row ${row.rowNumber} compare`}>
                      <div className="import-preview-compare-row import-preview-compare-header">
                        <span>{copy.fieldLabel}</span>
                        <span>{copy.beforeLabel}</span>
                        <span>{copy.afterLabel}</span>
                      </div>
                      {row.changes.map((change) => (
                        <div
                          key={`${rowKey}-${change.field}`}
                          className="import-preview-compare-row"
                        >
                          <span className="import-preview-compare-field">{change.field}</span>
                          <span>{change.before || "-"}</span>
                          <span>{change.after || "-"}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function SearchFilterToolbar(props: {
  language: AppLanguage;
  viewMode: SearchableViewMode;
  filter: SearchFilterState;
  chips: SearchFilterChip[];
  isOpen: boolean;
  onToggle: () => void;
  onClear: () => void;
}) {
  const hasFilters = hasActiveSearchFilters(props.filter);
  const copy = getUiCopy(props.language).searchFilter;

  return (
    <section className={`search-filter-toolbar search-filter-toolbar-${props.viewMode}`}>
      <div>
        <p className="sidebar-label">{copy.toolbarLabel}</p>
        <strong>{getSearchFilterToolbarTitle(props.language, props.viewMode)}</strong>
      </div>
      {props.chips.length > 0 ? (
        <div className="search-filter-active-chips" aria-label={copy.activeFiltersLabel}>
          {props.chips.map((chip) => (
            <span key={chip.key} className="search-filter-chip">
              {chip.label}
            </span>
          ))}
        </div>
      ) : null}
      <div className="search-filter-toolbar-actions">
        <button
          type="button"
          className={props.isOpen ? "nav-chip active" : "nav-chip"}
          onClick={props.onToggle}
        >
          {copy.openButton}
        </button>
        <button type="button" className="nav-chip" onClick={props.onClear} disabled={!hasFilters}>
          {copy.clearButton}
        </button>
      </div>
    </section>
  );
}

function SearchFilterDrawer(props: {
  language: AppLanguage;
  projects: ProjectSummary[];
  filter: SearchFilterState;
  onChange: (patch: Partial<SearchFilterState>) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const copy = getUiCopy(props.language).searchFilter;
  return (
    <div className="search-filter-drawer-backdrop" role="presentation" onClick={props.onClose}>
      <aside
        className="search-filter-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="search-filter-drawer-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="section-heading">
          <div>
            <p className="sidebar-label">{copy.drawerLabel}</p>
            <strong id="search-filter-drawer-title">{copy.drawerTitle}</strong>
            <p>{copy.drawerCopy}</p>
          </div>
          <div className="toolbar-actions">
            <button type="button" className="nav-chip" onClick={props.onClear}>
              {copy.clearButton}
            </button>
            <button type="button" className="nav-chip" onClick={props.onClose}>
              {copy.closeButton}
            </button>
          </div>
        </div>
        <div className="search-filter-form">
          <label className="detail-field detail-field-wide">
            <span>{copy.keywordLabel}</span>
            <input
              aria-label={copy.keywordLabel}
              value={props.filter.keyword}
              onChange={(event) => props.onChange({ keyword: event.target.value })}
              placeholder={copy.keywordPlaceholder}
            />
          </label>
          <label className="detail-field">
            <span>{copy.projectLabel}</span>
            <select
              aria-label={copy.projectLabel}
              value={props.filter.projectId}
              onChange={(event) => props.onChange({ projectId: event.target.value })}
            >
              <option value="">{copy.allOption}</option>
              {props.projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.code} {project.name}
                </option>
              ))}
            </select>
          </label>
          <label className="detail-field">
            <span>{copy.portfolioLabel}</span>
            <input
              aria-label={copy.portfolioLabel}
              value={props.filter.portfolioText}
              onChange={(event) => props.onChange({ portfolioText: event.target.value })}
              placeholder="portfolio_id"
            />
          </label>
          <label className="detail-field">
            <span>{copy.statusLabel}</span>
            <select
              aria-label={copy.statusLabel}
              value={props.filter.status}
              onChange={(event) =>
                props.onChange({ status: event.target.value as SearchFilterState["status"] })
              }
            >
              <option value="">{copy.allOption}</option>
              <option value="not_started">not_started</option>
              <option value="in_progress">in_progress</option>
              <option value="blocked">blocked</option>
              <option value="done">done</option>
              <option value="archived">archived</option>
            </select>
          </label>
          <label className="detail-field">
            <span>{copy.priorityLabel}</span>
            <select
              aria-label={copy.priorityLabel}
              value={props.filter.priority}
              onChange={(event) =>
                props.onChange({ priority: event.target.value as SearchFilterState["priority"] })
              }
            >
              <option value="">{copy.allOption}</option>
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
              <option value="critical">critical</option>
            </select>
          </label>
          <label className="detail-field">
            <span>{copy.tagLabel}</span>
            <input
              aria-label={copy.tagLabel}
              value={props.filter.tagText}
              onChange={(event) => props.onChange({ tagText: event.target.value })}
              placeholder={copy.tagPlaceholder}
            />
          </label>
          <label className="detail-field">
            <span>{copy.assigneeLabel}</span>
            <input
              aria-label={copy.assigneeLabel}
              value={props.filter.assigneeText}
              onChange={(event) => props.onChange({ assigneeText: event.target.value })}
              placeholder={copy.assigneePlaceholder}
            />
          </label>
          <label className="search-filter-toggle">
            <input
              aria-label={copy.overdueOnly}
              type="checkbox"
              checked={props.filter.overdueOnly}
              onChange={(event) => props.onChange({ overdueOnly: event.target.checked })}
            />
            <span>{copy.overdueOnly}</span>
          </label>
          <label className="search-filter-toggle">
            <input
              aria-label={copy.milestoneOnly}
              type="checkbox"
              checked={props.filter.milestoneOnly}
              onChange={(event) => props.onChange({ milestoneOnly: event.target.checked })}
            />
            <span>{copy.milestoneOnly}</span>
          </label>
          <label className="search-filter-toggle">
            <input
              aria-label={copy.roadmapOnly}
              type="checkbox"
              checked={props.filter.roadmapOnly}
              onChange={(event) => props.onChange({ roadmapOnly: event.target.checked })}
            />
            <span>{copy.roadmapOnly}</span>
          </label>
        </div>
      </aside>
    </div>
  );
}

function SettingsView(props: {
  language: AppLanguage;
  settings: AppSettings | null;
  onSave: (input: {
    language?: AppSettings["language"];
    theme?: AppSettings["theme"];
    autoBackupEnabled?: boolean;
    autoBackupRetentionLimit?: number;
    excelDefaultPriority?: AppSettings["excelDefaultPriority"];
    excelDefaultAssignee?: AppSettings["excelDefaultAssignee"];
    weekStartsOn?: AppSettings["weekStartsOn"];
    fyStartMonth?: number;
    showRoadmapWorkload?: boolean;
    workingDayNumbers?: AppSettings["workingDayNumbers"];
    defaultView?: AppDefaultView;
  }) => Promise<unknown>;
}) {
  const { settings } = props;
  const copy = getUiCopy(props.language);
  const workingDayOptions = useMemo(() => getWorkingDayOptions(props.language), [props.language]);
  const [language, setLanguage] = useState<AppSettings["language"]>(settings?.language ?? "ja");
  const [theme, setTheme] = useState<AppSettings["theme"]>(settings?.theme ?? "light");
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(settings?.autoBackupEnabled ?? true);
  const [autoBackupRetentionLimit, setAutoBackupRetentionLimit] = useState(
    String(settings?.autoBackupRetentionLimit ?? 7)
  );
  const [excelDefaultPriority, setExcelDefaultPriority] = useState<AppSettings["excelDefaultPriority"]>(
    settings?.excelDefaultPriority ?? "medium"
  );
  const [excelDefaultAssignee, setExcelDefaultAssignee] = useState(
    settings?.excelDefaultAssignee ?? ""
  );
  const [weekStartsOn, setWeekStartsOn] = useState<AppSettings["weekStartsOn"]>(
    settings?.weekStartsOn ?? "monday"
  );
  const [fyStartMonth, setFyStartMonth] = useState(String(settings?.fyStartMonth ?? 4));
  const [showRoadmapWorkload, setShowRoadmapWorkload] = useState(settings?.showRoadmapWorkload ?? false);
  const [workingDayNumbers, setWorkingDayNumbers] = useState<AppSettings["workingDayNumbers"]>(
    settings?.workingDayNumbers ?? [1, 2, 3, 4, 5]
  );
  const [defaultView, setDefaultView] = useState<AppDefaultView>(settings?.defaultView ?? "home");

  const handleSubmit = async (event: ReactFormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsedAutoBackupRetentionLimit = Number(autoBackupRetentionLimit);
    const parsedFyStartMonth = Number(fyStartMonth);
    if (
      !Number.isInteger(parsedAutoBackupRetentionLimit) ||
      parsedAutoBackupRetentionLimit < 1 ||
      parsedAutoBackupRetentionLimit > 30
    ) {
      return;
    }
    if (!Number.isInteger(parsedFyStartMonth) || parsedFyStartMonth < 1 || parsedFyStartMonth > 12) {
      return;
    }
    if (workingDayNumbers.length === 0) {
      return;
    }

    await props.onSave({
      language,
      theme,
      autoBackupEnabled,
      autoBackupRetentionLimit: parsedAutoBackupRetentionLimit,
      excelDefaultPriority,
      excelDefaultAssignee,
      weekStartsOn,
      fyStartMonth: parsedFyStartMonth,
      showRoadmapWorkload,
      workingDayNumbers,
      defaultView,
    });
  };

  const toggleWorkingDay = (value: WorkingDayNumber) => {
    setWorkingDayNumbers((current) => {
      if (current.includes(value)) {
        return current.length > 1 ? current.filter((entry) => entry !== value) : current;
      }
      return [...current, value].sort((left, right) => left - right);
    });
  };

  return (
    <section className="settings-panel">
      <div className="section-heading">
        <div>
          <p className="sidebar-label">{copy.settings.label}</p>
          <h2>{copy.settings.heading}</h2>
          <p className="capture-copy">{copy.settings.copy}</p>
        </div>
      </div>

      <form className="settings-form" onSubmit={(event) => void handleSubmit(event)}>
        <label className="detail-field">
          {copy.settings.languageLabel}
          <select value={language} onChange={(event) => setLanguage(event.target.value as AppSettings["language"])}>
            <option value="ja">{copy.settings.languageJa}</option>
            <option value="en">{copy.settings.languageEn}</option>
          </select>
        </label>

        <label className="detail-field">
          {copy.settings.themeLabel}
          <select value={theme} onChange={(event) => setTheme(event.target.value as AppTheme)}>
            <option value="light">{getThemeLabel(props.language, "light")}</option>
            <option value="dark">{getThemeLabel(props.language, "dark")}</option>
          </select>
        </label>

        <fieldset className="settings-working-day-fieldset">
          <legend>{copy.settings.autoBackupEnabledLabel}</legend>
          <label className="settings-toggle-field">
            <input
              type="checkbox"
              aria-label={copy.settings.autoBackupEnabledLabel}
              checked={autoBackupEnabled}
              onChange={(event) => setAutoBackupEnabled(event.target.checked)}
            />
            <span>{copy.settings.autoBackupEnabledHelp}</span>
          </label>
        </fieldset>

        <label className="detail-field">
          {copy.settings.autoBackupRetentionLabel}
          <select
            aria-label={copy.settings.autoBackupRetentionLabel}
            value={autoBackupRetentionLimit}
            onChange={(event) => setAutoBackupRetentionLimit(event.target.value)}
            disabled={!autoBackupEnabled}
          >
            {Array.from({ length: 30 }, (_, index) => String(index + 1)).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <label className="detail-field">
          {copy.settings.excelDefaultPriorityLabel}
          <select
            aria-label={copy.settings.excelDefaultPriorityLabel}
            value={excelDefaultPriority}
            onChange={(event) =>
              setExcelDefaultPriority(event.target.value as AppSettings["excelDefaultPriority"])
            }
          >
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
            <option value="critical">critical</option>
          </select>
        </label>

        <label className="detail-field">
          {copy.settings.excelDefaultAssigneeLabel}
          <input
            aria-label={copy.settings.excelDefaultAssigneeLabel}
            type="text"
            maxLength={80}
            value={excelDefaultAssignee}
            onChange={(event) => setExcelDefaultAssignee(event.target.value)}
          />
          <span className="settings-field-help">{copy.settings.excelDefaultsHelp}</span>
        </label>

        <label className="detail-field">
          {copy.settings.weekStartsOnLabel}
          <select value={weekStartsOn} onChange={(event) => setWeekStartsOn(event.target.value as AppSettings["weekStartsOn"])}>
            <option value="monday">{copy.settings.weekStartsOnMonday}</option>
            <option value="sunday">{copy.settings.weekStartsOnSunday}</option>
          </select>
        </label>

        <label className="detail-field">
          {copy.settings.fyStartMonthLabel}
          <select value={fyStartMonth} onChange={(event) => setFyStartMonth(event.target.value)}>
            {Array.from({ length: 12 }, (_, index) => String(index + 1)).map((month) => (
              <option key={month} value={month}>
                {formatMonthLabel(props.language, Number(month))}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="settings-working-day-fieldset">
          <legend>{copy.settings.showRoadmapWorkloadLabel}</legend>
          <label className="settings-toggle-field">
            <input
              type="checkbox"
              aria-label={copy.settings.showRoadmapWorkloadLabel}
              checked={showRoadmapWorkload}
              onChange={(event) => setShowRoadmapWorkload(event.target.checked)}
            />
            <span>{copy.settings.showRoadmapWorkloadHelp}</span>
          </label>
        </fieldset>

        <fieldset className="settings-working-day-fieldset">
          <legend>{copy.settings.workingDaysLegend}</legend>
          <p className="settings-field-help">{copy.settings.workingDaysHelp}</p>
          <div className="settings-working-day-grid">
            {workingDayOptions.map((option) => (
              <label key={option.value} className="settings-working-day-option">
                <input
                  type="checkbox"
                  checked={workingDayNumbers.includes(option.value)}
                  onChange={() => toggleWorkingDay(option.value)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="detail-field">
          {copy.settings.defaultViewLabel}
          <select value={defaultView} onChange={(event) => setDefaultView(event.target.value as AppDefaultView)}>
            <option value="home">{getDefaultViewLabel(props.language, "home")}</option>
            <option value="portfolio">{getDefaultViewLabel(props.language, "portfolio")}</option>
            <option value="roadmap">{getDefaultViewLabel(props.language, "roadmap")}</option>
          </select>
        </label>

        <div className="settings-actions">
          <button type="submit">{copy.settings.save}</button>
        </div>
      </form>
    </section>
  );
}

function parsePeopleText(value: string): string[] {
  return value
    .split(/[,、/;；\n]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseBulkTaskTitles(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-*・]\s*|\d+[.)]\s*)/, "").trim())
    .filter(Boolean)
    .slice(0, 30);
}

function buildAssigneeSummaries(
  sources: Array<{ project: ProjectSummary; items: ItemRecord[] }>
): AssigneeSummary[] {
  const summaries = new Map<string, AssigneeSummary & { projectIds: Set<string> }>();

  const ensureSummary = (name: string) => {
    const current = summaries.get(name);
    if (current) {
      return current;
    }
    const next = {
      name,
      projectCount: 0,
      total: 0,
      open: 0,
      done: 0,
      overdue: 0,
      projectIds: new Set<string>(),
    };
    summaries.set(name, next);
    return next;
  };

  for (const source of sources) {
    for (const ownerName of parsePeopleText(source.project.ownerName)) {
      const summary = ensureSummary(ownerName);
      summary.projectIds.add(source.project.id);
    }

    for (const item of source.items) {
      if (item.archived) {
        continue;
      }

      for (const assigneeName of parsePeopleText(item.assigneeName)) {
        const summary = ensureSummary(assigneeName);
        summary.projectIds.add(source.project.id);
        summary.total += 1;
        if (item.status === "done") {
          summary.done += 1;
        } else {
          summary.open += 1;
        }
        if (isOverdueItem(item)) {
          summary.overdue += 1;
        }
      }
    }
  }

  return Array.from(summaries.values())
    .map(({ projectIds, ...summary }) => ({
      ...summary,
      projectCount: projectIds.size,
    }))
    .sort((left, right) => right.open - left.open || right.overdue - left.overdue || left.name.localeCompare(right.name));
}

function buildWorkloadBucketSummaries(rows: RoadmapRow[], buckets: RoadmapBucket[]): WorkloadBucketSummary[] {
  return buckets.map((bucket, index) => {
    const people = new Set<string>();
    let count = 0;

    for (const row of rows) {
      if (row.kind === "project" || row.item.archived) {
        continue;
      }
      if (!itemOverlapsBucket(row.item, bucket)) {
        continue;
      }

      count += 1;
      for (const assigneeName of parsePeopleText(row.item.assigneeName)) {
        people.add(assigneeName);
      }
    }

    return {
      key: bucket.key,
      label: bucket.label,
      shortLabel: bucket.shortLabel || String(index + 1),
      count,
      assigneeCount: people.size,
    };
  });
}

function itemOverlapsBucket(item: ItemRecord, bucket: RoadmapBucket): boolean {
  const startText = item.startDate ?? item.dueDate ?? item.endDate;
  const endText = item.endDate ?? item.startDate ?? item.dueDate;
  if (!startText || !endText) {
    return false;
  }

  const startDate = parseISO(startText);
  const endDate = parseISO(endText);
  return startDate <= bucket.end && endDate >= bucket.start;
}

function PortfolioView(props: {
  language: AppLanguage;
  projects: ProjectSummary[];
  searchFilter: SearchFilterState;
  summary: PortfolioSummary | null;
  weekStartsOn: AppSettings["weekStartsOn"];
  onOpenProject: (projectId: string) => void;
}) {
  const copy = getUiCopy(props.language);
  const projects = props.summary?.projects ?? [];
  const portfolioApi = window.sgc?.portfolio ?? browserApi.portfolio;
  const projectsApi = window.sgc?.projects ?? browserApi.projects;
  const [filterMode, setFilterMode] = useState<PortfolioFilter>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string | null>(null);
  const [expandedProjectIds, setExpandedProjectIds] = useState<Set<string>>(new Set());
  const [phaseMap, setPhaseMap] = useState<Record<string, PortfolioPhaseSummary[]>>({});
  const [projectDetails, setProjectDetails] = useState<Record<string, ProjectDetail>>({});
  const [loadingProjectIds, setLoadingProjectIds] = useState<Set<string>>(new Set());
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (props.projects.length === 0) {
      return;
    }

    let disposed = false;
    const loadProjectDetails = async () => {
      try {
        const details = await Promise.all(props.projects.map((project) => projectsApi.get(project.id)));
        if (disposed) {
          return;
        }
        setProjectDetails(Object.fromEntries(details.map((detail) => [detail.project.id, detail])));
      } catch (error) {
        if (!disposed) {
          setLoadError(error instanceof Error ? error.message : "Failed to load portfolio filter source");
        }
      }
    };

    void loadProjectDetails();

    return () => {
      disposed = true;
    };
  }, [projectsApi, props.projects]);

  const projectMap = useMemo(
    () => new Map(props.projects.map((project) => [project.id, project])),
    [props.projects]
  );
  const baseFilteredProjects = projects.filter((project) => {
    if (!portfolioProjectMatchesFilter(project, filterMode, props.weekStartsOn)) {
      return false;
    }
    const projectRecord = projectMap.get(project.id);
    if (!projectRecord) {
      return false;
    }
    return projectMatchesSearchFilter({
      project: projectRecord,
      detailItems: projectDetails[project.id]?.items ?? [],
      filter: props.searchFilter,
    });
  });
  const assigneeSummaries = useMemo(
    () =>
      buildAssigneeSummaries(
        baseFilteredProjects
          .map((project) => {
            const projectRecord = projectMap.get(project.id);
            const detail = projectDetails[project.id];
            return projectRecord && detail
              ? {
                  project: projectRecord,
                  items: detail.items,
                }
              : null;
          })
          .filter((entry): entry is { project: ProjectSummary; items: ItemRecord[] } => Boolean(entry))
      ),
    [baseFilteredProjects, projectDetails, projectMap]
  );
  const filteredProjects = assigneeFilter
    ? baseFilteredProjects.filter((project) =>
        (projectDetails[project.id]?.items ?? []).some((item) =>
          parsePeopleText(item.assigneeName).includes(assigneeFilter)
        ) || project.ownerName === assigneeFilter
      )
    : baseFilteredProjects;

  if (projects.length === 0) {
    return (
      <section className="empty-panel">
        <h2>{copy.portfolio.emptyTitle}</h2>
        <p>{copy.portfolio.emptyMessage}</p>
      </section>
    );
  }

  const highRiskCount = filteredProjects.filter((project) => project.riskLevel === "high").length;
  const totalOverdue = filteredProjects.reduce((sum, project) => sum + project.overdueCount, 0);
  const nextMilestoneDate =
    filteredProjects
      .map((project) => project.nextMilestoneDate)
      .filter((value): value is string => Boolean(value))
      .sort()[0] ?? "-";

  const toggleProjectPhases = async (projectId: string) => {
    if (expandedProjectIds.has(projectId)) {
      setExpandedProjectIds((current) => {
        const next = new Set(current);
        next.delete(projectId);
        return next;
      });
      return;
    }

    if (!phaseMap[projectId] && !loadingProjectIds.has(projectId)) {
      setLoadingProjectIds((current) => new Set(current).add(projectId));
      try {
        const result = await portfolioApi.getProjectPhases(projectId);
        setPhaseMap((current) => ({
          ...current,
          [projectId]: result.phases,
        }));
        setLoadError(null);
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "Failed to load portfolio phases");
        return;
      } finally {
        setLoadingProjectIds((current) => {
          const next = new Set(current);
          next.delete(projectId);
          return next;
        });
      }
    }

    setExpandedProjectIds((current) => new Set(current).add(projectId));
  };

  return (
    <>
      <section className="portfolio-overview">
        <div>
          <p className="sidebar-label">Portfolio</p>
          <h2>{copy.portfolio.heading}</h2>
          <p className="capture-copy">{copy.portfolio.copy}</p>
        </div>
        <div className="stats-grid">
          <MetricCard label="Projects" value={String(filteredProjects.length)} />
          <MetricCard label="High Risk" value={String(highRiskCount)} />
          <MetricCard label="Overdue" value={String(totalOverdue)} />
          <MetricCard label="Next MS" value={nextMilestoneDate} />
        </div>
      </section>

      <section className="portfolio-panel">
        <div className="section-heading">
          <div>
            <strong>{copy.portfolio.summaryTitle}</strong>
            <p>{copy.portfolio.summaryCopy}</p>
          </div>
        </div>
        <div className="roadmap-filter-chips">
          {([
            ["all", copy.portfolio.filterAll],
            ["overdue", copy.portfolio.filterOverdue],
            ["week_milestone", copy.portfolio.filterWeekMilestone],
          ] as const).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              className={filterMode === mode ? "nav-chip active" : "nav-chip"}
              onClick={() => setFilterMode(mode)}
            >
              {label}
            </button>
          ))}
        </div>
        {assigneeSummaries.length > 0 ? (
          <div className="assignee-board" aria-label={copy.portfolio.assigneeBoardTitle}>
            <div>
              <strong>{copy.portfolio.assigneeBoardTitle}</strong>
              <p>{copy.portfolio.assigneeBoardCopy}</p>
            </div>
            <div className="assignee-chip-grid">
              <button
                type="button"
                className={assigneeFilter === null ? "assignee-summary-chip active" : "assignee-summary-chip"}
                onClick={() => setAssigneeFilter(null)}
              >
                <strong>{copy.portfolio.assigneeAll}</strong>
                <span>{copy.portfolio.assigneeAllHelp}</span>
              </button>
              {assigneeSummaries.map((summary) => (
                <button
                  key={summary.name}
                  type="button"
                  className={assigneeFilter === summary.name ? "assignee-summary-chip active" : "assignee-summary-chip"}
                  onClick={() => setAssigneeFilter(summary.name)}
                >
                  <strong>{summary.name}</strong>
                  <span>{copy.portfolio.assigneeSummary(summary.projectCount, summary.open, summary.overdue)}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {loadError ? <div className="error-banner">{loadError}</div> : null}

        <div className="portfolio-table">
          <div className="portfolio-table-row portfolio-table-header">
            <span>展開</span>
            <span>名前</span>
            <span>状態</span>
            <span>進捗</span>
            <span>期限超過</span>
            <span>次マイルストーン</span>
            <span>直近7日変更</span>
            <span>リスク</span>
          </div>
          {filteredProjects.length === 0 ? (
            <div className="empty-table">{copy.portfolio.emptyFiltered}</div>
          ) : (
            filteredProjects.map((project) => {
              const isExpanded = expandedProjectIds.has(project.id);
              const projectRecord = projectMap.get(project.id) ?? null;
              const detailItems = projectDetails[project.id]?.items ?? [];
              const visiblePhaseRows = (phaseMap[project.id] ?? []).filter((phase) => {
                const phaseItem = detailItems.find((item) => item.id === phase.id);
                return phaseItem && projectRecord
                  ? itemMatchesSearchFilter({
                      item: phaseItem,
                      project: projectRecord,
                      filter: props.searchFilter,
                    })
                  : true;
              });
              const isLoading = loadingProjectIds.has(project.id);

              return (
                <div key={project.id} className="portfolio-table-group">
                  <div className="portfolio-table-row portfolio-table-entry">
                    <span>
                      <button
                        type="button"
                        className="portfolio-expand-button"
                        aria-expanded={isExpanded}
                        aria-label={`${project.name} の phase を${isExpanded ? "折りたたむ" : "展開する"}`}
                        onClick={() => void toggleProjectPhases(project.id)}
                      >
                        {isLoading ? "…" : isExpanded ? "▾" : "▸"}
                      </button>
                    </span>
                    <button
                      type="button"
                      className="portfolio-table-button"
                      onClick={() => props.onOpenProject(project.id)}
                    >
                      <span className="portfolio-name-cell">
                        <strong>{project.name}</strong>
                        <span>{project.code}</span>
                      </span>
                      <span>
                        <span className={`status-pill ${project.status}`}>{project.status}</span>
                      </span>
                      <span>{project.progressCached}%</span>
                      <span>{project.overdueCount}</span>
                      <span className="portfolio-milestone-cell">
                        <strong>{project.nextMilestoneDate ?? "-"}</strong>
                        <span>{project.nextMilestoneTitle ?? "未設定"}</span>
                      </span>
                      <span>{project.recentChangeCount7d}</span>
                      <span>
                        <span className={`risk-pill ${project.riskLevel}`}>{formatRiskLabel(project.riskLevel)}</span>
                      </span>
                    </button>
                  </div>
                  {isExpanded ? (
                    visiblePhaseRows.length > 0 ? (
                      visiblePhaseRows.map((phase) => (
                        <div key={phase.id} className="portfolio-table-row portfolio-phase-row">
                          <span />
                          <span className="portfolio-name-cell portfolio-phase-name-cell">
                            <strong>
                              {phase.wbsCode} {phase.title}
                            </strong>
                            <span>{formatPhaseDateRange(phase.startDate, phase.endDate)}</span>
                          </span>
                          <span>
                            <span className={`status-pill ${phase.status}`}>{phase.status}</span>
                          </span>
                          <span>{phase.progressCached}%</span>
                          <span>{phase.overdueCount}</span>
                          <span className="portfolio-milestone-cell">
                            <strong>{phase.nextMilestoneDate ?? "-"}</strong>
                            <span>{phase.nextMilestoneTitle ?? "未設定"}</span>
                          </span>
                          <span>{phase.recentChangeCount7d}</span>
                          <span>
                            <span className={`risk-pill ${phase.riskLevel}`}>{formatRiskLabel(phase.riskLevel)}</span>
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="portfolio-table-row portfolio-phase-empty">
                        <span />
                        <span>主要 phase は未作成です</span>
                        <span />
                        <span />
                        <span />
                        <span />
                        <span />
                        <span />
                      </div>
                    )
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </section>
    </>
  );
}

function RoadmapView(props: {
  language: AppLanguage;
  projects: ProjectSummary[];
  searchFilter: SearchFilterState;
  fyStartMonth: number;
  showRoadmapWorkload: boolean;
  onOpenProject: (projectId: string) => void;
}) {
  const copy = getUiCopy(props.language);
  const roadmapApi = window.sgc?.projects ?? browserApi.projects;
  const [scale, setScale] = useState<RoadmapScale>("year");
  const [filterMode, setFilterMode] = useState<RoadmapFilter>("all");
  const [anchorYear, setAnchorYear] = useState(new Date().getFullYear());
  const [yearSpan, setYearSpan] = useState(1);
  const [expandedRoadmapItemIds, setExpandedRoadmapItemIds] = useState<Set<string>>(new Set());
  const [projectDetails, setProjectDetails] = useState<Record<string, ProjectDetail>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roadmapScrollTop, setRoadmapScrollTop] = useState(0);
  const [roadmapViewportHeight, setRoadmapViewportHeight] = useState(ROADMAP_DEFAULT_VIEWPORT_HEIGHT);
  const roadmapBodyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (props.projects.length === 0) {
      return;
    }

    let disposed = false;
    const loadRoadmapProjects = async () => {
      setLoading(true);
      setError(null);

      try {
        const details = await Promise.all(props.projects.map((project) => roadmapApi.get(project.id)));
        if (disposed) {
          return;
        }

        setProjectDetails(
          Object.fromEntries(details.map((detail) => [detail.project.id, detail]))
        );
      } catch (nextError) {
        if (disposed) {
          return;
        }

        setError(
          nextError instanceof Error ? nextError.message : "Failed to load roadmap projects"
        );
      } finally {
        if (!disposed) {
          setLoading(false);
        }
      }
    };

    void loadRoadmapProjects();

    return () => {
      disposed = true;
    };
  }, [props.projects, roadmapApi]);

  const buckets = useMemo(
    () =>
      buildRoadmapBuckets({
        scale,
        anchorYear,
        fiscalYearStartMonth: props.fyStartMonth,
        yearSpan,
      }),
    [anchorYear, props.fyStartMonth, scale, yearSpan]
  );
  const roadmapRows = useMemo(() => {
    return props.projects.flatMap((project) => {
      const detail = projectDetails[project.id];
      const allItems =
        detail?.items
          .filter((item) => !item.archived)
          .sort(compareRoadmapItems) ?? [];
      const childrenByParentId = buildRoadmapChildrenByParentId(allItems);
      const rootItems = allItems.filter((item) => item.parentId === null);
      const rootRows: RoadmapRow[] = [];

      for (const item of rootItems) {
        const descendantRows = buildRoadmapDescendantRows({
          childrenByParentId,
          expandedItemIds: expandedRoadmapItemIds,
          filterMode,
          searchFilter: props.searchFilter,
          project: project,
          parentId: item.id,
          projectId: project.id,
          depth: 1,
        });
        const itemMatches =
          hasRoadmapDate(item) &&
          roadmapItemMatchesFilter(item, filterMode) &&
          itemMatchesSearchFilter({
            item,
            project,
            filter: props.searchFilter,
          });
        const includeItem = itemMatches || descendantRows.length > 0;
        const expandable = item.type === "group" && descendantRows.length > 0;
        const expanded = expandable && expandedRoadmapItemIds.has(item.id);

        if (!includeItem) {
          continue;
        }

        rootRows.push({
          kind: "item",
          item,
          title: item.title,
          subtitle: item.wbsCode || item.type,
          projectId: project.id,
          depth: 0,
          expandable,
          expanded,
        });

        if (expanded) {
          rootRows.push(...descendantRows);
        }
      }

      const rows: RoadmapRow[] = [];
      const projectItem = makeProjectRoadmapItem(project);
      const includeProjectRow =
        rootRows.length > 0 ||
        (projectItem !== null &&
          (filterMode === "all" || roadmapItemMatchesFilter(projectItem, filterMode)) &&
          projectMatchesSearchFilter({
            project,
            detailItems: detail?.items ?? [],
            filter: props.searchFilter,
          }));

      if (projectItem && includeProjectRow) {
        rows.push({
          kind: "project",
          item: projectItem,
          title: project.name,
          subtitle: project.code,
          projectId: project.id,
          depth: 0,
          expandable: false,
          expanded: false,
        });
      }

      rows.push(...rootRows);

      return rows;
    });
  }, [expandedRoadmapItemIds, filterMode, projectDetails, props.projects, props.searchFilter]);
  const roadmapLayout = useMemo(
    () => buildRoadmapLayout(roadmapRows.map((row) => row.item), buckets),
    [buckets, roadmapRows]
  );
  const workloadBuckets = useMemo(
    () => (props.showRoadmapWorkload ? buildWorkloadBucketSummaries(roadmapRows, buckets) : []),
    [buckets, props.showRoadmapWorkload, roadmapRows]
  );
  const maxWorkloadCount = Math.max(1, ...workloadBuckets.map((bucket) => bucket.count));
  const roadmapVirtualWindow = useMemo(
    () =>
      buildVirtualWindow({
        itemCount: roadmapRows.length,
        scrollTop: roadmapScrollTop,
        viewportHeight: roadmapViewportHeight,
        rowHeight: ROADMAP_ROW_HEIGHT,
        overscan: ROADMAP_VIRTUAL_OVERSCAN,
      }),
    [roadmapRows.length, roadmapScrollTop, roadmapViewportHeight]
  );
  const visibleRoadmapRows = useMemo(
    () => roadmapRows.slice(roadmapVirtualWindow.startIndex, roadmapVirtualWindow.endIndexExclusive),
    [roadmapRows, roadmapVirtualWindow.endIndexExclusive, roadmapVirtualWindow.startIndex]
  );
  const yearHeaders = useMemo(() => buildRoadmapYearHeaders(buckets), [buckets]);
  const quarterHeaders = useMemo(
    () => buildRoadmapQuarterHeaders(buckets, props.fyStartMonth),
    [buckets, props.fyStartMonth]
  );
  const rangeLabel =
    scale === "year"
      ? yearSpan === 1
        ? `${anchorYear}年`
        : `${anchorYear}年 - ${anchorYear + yearSpan - 1}年`
      : yearSpan === 1
        ? `FY${anchorYear} (${buckets[0]?.label ?? "-"} - ${buckets[buckets.length - 1]?.label ?? "-"})`
        : `FY${anchorYear} - FY${anchorYear + yearSpan - 1} (${buckets[0]?.label ?? "-"} - ${
            buckets[buckets.length - 1]?.label ?? "-"
          })`;
  const roadmapGridTemplateColumns = `280px repeat(${buckets.length}, minmax(56px, 1fr))`;

  useEffect(() => {
    const viewportHeight = roadmapBodyRef.current?.clientHeight ?? ROADMAP_DEFAULT_VIEWPORT_HEIGHT;
    setRoadmapViewportHeight(viewportHeight);
  }, [loading, roadmapRows.length]);

  if (props.projects.length === 0) {
    return (
      <section className="empty-panel">
        <h2>{copy.roadmap.emptyTitle}</h2>
        <p>{copy.roadmap.emptyMessage}</p>
      </section>
    );
  }

  return (
    <div className="roadmap-stack">
      <section className="roadmap-overview">
        <div className="roadmap-toolbar">
          <div className="timeline-scale-buttons">
            <button
              type="button"
              className={scale === "year" ? "nav-chip active" : "nav-chip"}
              onClick={() => setScale("year")}
            >
              {copy.roadmap.scaleYear}
            </button>
            <button
              type="button"
              className={scale === "fy" ? "nav-chip active" : "nav-chip"}
              onClick={() => setScale("fy")}
            >
              {copy.roadmap.scaleFy}
            </button>
          </div>
          <div className="roadmap-filter-chips">
            <button
              type="button"
              className={filterMode === "all" ? "nav-chip active" : "nav-chip"}
              onClick={() => setFilterMode("all")}
            >
              {copy.roadmap.filterAll}
            </button>
            <button
              type="button"
              className={filterMode === "overdue" ? "nav-chip active" : "nav-chip"}
              onClick={() => setFilterMode("overdue")}
            >
              {copy.roadmap.filterOverdue}
            </button>
            <button
              type="button"
              className={filterMode === "milestone" ? "nav-chip active" : "nav-chip"}
              onClick={() => setFilterMode("milestone")}
            >
              {copy.roadmap.filterMilestone}
            </button>
          </div>
          <div className="roadmap-year-nav">
            <button type="button" className="nav-chip" onClick={() => setAnchorYear((current) => current - 1)}>
              {copy.roadmap.previousYear}
            </button>
            <strong>{rangeLabel}</strong>
            <button type="button" className="nav-chip" onClick={() => setAnchorYear((current) => current + 1)}>
              {copy.roadmap.nextYear}
            </button>
          </div>
          <label className="roadmap-year-span-slider">
            <span>{copy.roadmap.yearSpanLabel}</span>
            <input
              type="range"
              min={ROADMAP_MIN_YEAR_SPAN}
              max={ROADMAP_MAX_YEAR_SPAN}
              step={1}
              value={yearSpan}
              onChange={(event) => setYearSpan(Number(event.target.value))}
            />
            <strong>{copy.roadmap.yearSpanValue(yearSpan)}</strong>
          </label>
        </div>
      </section>

      <section className="roadmap-panel">
        {error ? <div className="error-banner">{error}</div> : null}
        {props.showRoadmapWorkload ? (
          <div
            className="roadmap-workload-row roadmap-grid"
            aria-label={copy.roadmap.workloadTitle}
            style={{ gridTemplateColumns: roadmapGridTemplateColumns }}
          >
            <span className="roadmap-workload-title" aria-hidden="true" />
            {workloadBuckets.map((bucket) => (
              <div
                key={bucket.key}
                className="roadmap-workload-cell"
                title={`${bucket.label}: ${bucket.count} / ${copy.roadmap.workloadPeople(bucket.assigneeCount)}`}
                style={{ "--workload-intensity": bucket.count / maxWorkloadCount } as CSSProperties}
              >
                {bucket.count}
              </div>
            ))}
          </div>
        ) : null}
        <div
          className="roadmap-year-header roadmap-grid"
          style={{ gridTemplateColumns: roadmapGridTemplateColumns }}
        >
          <span className="roadmap-header-title" />
          {yearHeaders.map((header) => (
            <div
              key={header.key}
              className="roadmap-year-cell"
              style={{ gridColumn: `${header.startColumn + 2} / ${header.endColumn + 3}` }}
            >
              <span>{header.label}</span>
            </div>
          ))}
        </div>
        <div
          className="roadmap-quarter-header roadmap-grid"
          style={{ gridTemplateColumns: roadmapGridTemplateColumns }}
        >
          <span className="roadmap-header-title" />
          {quarterHeaders.map((header) => (
            <div
              key={header.key}
              className="roadmap-quarter-cell"
              style={{ gridColumn: `${header.startColumn + 2} / ${header.endColumn + 3}` }}
            >
              <span>{header.label}</span>
            </div>
          ))}
        </div>
        <div
          className="roadmap-header roadmap-grid"
          style={{ gridTemplateColumns: roadmapGridTemplateColumns }}
        >
          <span className="roadmap-header-title">{copy.roadmap.itemHeader}</span>
          {buckets.map((bucket) => (
            <div key={bucket.key} className="roadmap-header-cell" title={bucket.label}>
              <span>{bucket.shortLabel}</span>
            </div>
          ))}
        </div>

        <div
          ref={roadmapBodyRef}
          className="roadmap-body"
          onScroll={(event) => {
            setRoadmapScrollTop(event.currentTarget.scrollTop);
            setRoadmapViewportHeight(event.currentTarget.clientHeight);
          }}
        >
          {loading ? (
            <div className="empty-table">{copy.roadmap.loading}</div>
          ) : roadmapRows.length === 0 ? (
            <div className="empty-table">{copy.roadmap.emptyFiltered}</div>
          ) : (
            <>
              {roadmapVirtualWindow.topSpacerHeight > 0 ? (
                <div
                  className="virtual-scroll-spacer"
                  style={{ height: `${roadmapVirtualWindow.topSpacerHeight}px` }}
                  aria-hidden="true"
                />
              ) : null}
              {visibleRoadmapRows.map((row) => {
              const layout = roadmapLayout.get(row.item.id);
              return (
                <div
                  key={row.item.id}
                  className={
                    row.kind === "project"
                      ? "roadmap-row roadmap-grid"
                      : row.depth > 0
                        ? "roadmap-row roadmap-grid roadmap-sub-row roadmap-deep-row"
                        : "roadmap-row roadmap-grid roadmap-sub-row"
                  }
                  style={{ gridTemplateColumns: roadmapGridTemplateColumns }}
                >
                  <div className="roadmap-title-cell">
                    <div
                      className="roadmap-title-layout"
                      style={row.kind === "project" ? undefined : { paddingLeft: `${row.depth * 20}px` }}
                    >
                      {row.kind !== "project" && row.expandable ? (
                        <button
                          type="button"
                          className="roadmap-expand-button"
                          aria-expanded={row.expanded}
                          aria-label={`${row.title} を${row.expanded ? "折りたたむ" : "展開する"}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            setExpandedRoadmapItemIds((current) => {
                              const next = new Set(current);
                              if (next.has(row.item.id)) {
                                next.delete(row.item.id);
                              } else {
                                next.add(row.item.id);
                              }
                              return next;
                            });
                          }}
                        >
                          {row.expanded ? "▾" : "▸"}
                        </button>
                      ) : (
                        <span className="roadmap-expand-spacer" />
                      )}
                      <button
                        type="button"
                        className="roadmap-title-link"
                        onClick={() => props.onOpenProject(row.projectId)}
                      >
                        <strong>{row.title}</strong>
                        <span>{row.subtitle}</span>
                      </button>
                    </div>
                  </div>
                  {buckets.map((bucket) => (
                    <div key={`${row.item.id}-${bucket.key}`} className="roadmap-cell" />
                  ))}
                  {layout ? (
                    row.item.type === "milestone" ? (
                      <div
                        className="roadmap-marker"
                        style={{
                          gridColumn: `${layout.startColumn + 2} / span 1`,
                        }}
                      />
                    ) : (
                      <div
                        className={`roadmap-bar ${row.kind === "project" ? "project" : row.item.type}`}
                        style={{
                          gridColumn: `${layout.startColumn + 2} / ${layout.endColumn + 3}`,
                        }}
                      />
                    )
                  ) : null}
                </div>
              );
            })}
              {roadmapVirtualWindow.bottomSpacerHeight > 0 ? (
                <div
                  className="virtual-scroll-spacer"
                  style={{ height: `${roadmapVirtualWindow.bottomSpacerHeight}px` }}
                  aria-hidden="true"
                />
              ) : null}
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function TaskList(props: { items: ItemRecord[]; emptyMessage: string }) {
  if (props.items.length === 0) {
    return <div className="empty-list">{props.emptyMessage}</div>;
  }

  return (
    <div className="task-list">
      {props.items.map((item) => (
        <article key={item.id} className="task-card">
          <div className="task-card-head">
            <strong>{item.title}</strong>
            <span className={`status-pill ${item.status}`}>{item.status}</span>
          </div>
          <div className="task-card-meta">
            <span>{item.projectName ?? "Inbox"}</span>
            {item.assigneeName ? <span>@{item.assigneeName}</span> : null}
            {item.startDate || item.endDate || item.dueDate ? (
              <span>{formatDateRange(item)}</span>
            ) : null}
          </div>
          {item.tags.length > 0 ? (
            <div className="tag-row">
              {item.tags.map((tag) => (
                <span key={tag} className="tag-chip">
                  #{tag}
                </span>
              ))}
            </div>
          ) : null}
          {item.note ? <p className="task-note">{item.note}</p> : null}
        </article>
      ))}
    </div>
  );
}

function InboxTaskList(props: {
  language: AppLanguage;
  items: ItemRecord[];
  projects: Array<{ id: string; name: string; code: string }>;
  emptyMessage: string;
  onAssignProject: (itemId: string, projectId: string) => void;
  onAddDate: (itemId: string, date: string) => void;
  onAddTags: (itemId: string, tags: string[]) => void;
  onConvertToTemplate: (itemId: string) => Promise<void>;
}) {
  const copy = getUiCopy(props.language);

  if (props.items.length === 0) {
    return <div className="empty-list">{props.emptyMessage}</div>;
  }

  return (
    <div className="task-list">
      {props.items.map((item) => (
        <article key={item.id} className="task-card">
          <div className="task-card-head">
            <strong>{item.title}</strong>
            <span className={`status-pill ${item.status}`}>{item.status}</span>
          </div>
          <div className="task-card-meta">
            <span>Inbox</span>
            {item.assigneeName ? <span>@{item.assigneeName}</span> : null}
          </div>
          <div className="inbox-edit-grid">
            <label className="inbox-edit-field">
              <span>プロジェクト割当</span>
              <select
                defaultValue=""
                disabled={props.projects.length === 0}
                onChange={(event) => {
                  const projectId = event.target.value;
                  if (projectId) {
                    props.onAssignProject(item.id, projectId);
                  }
                }}
              >
                <option value="">割当先を選択</option>
                {props.projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.code} / {project.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="inbox-edit-field">
              <span>日付追加</span>
              <input
                type="date"
                defaultValue={normalizeDateInput(item.startDate || item.endDate)}
                onChange={(event) => {
                  if (event.target.value) {
                    props.onAddDate(item.id, event.target.value);
                  }
                }}
              />
            </label>
            <label className="inbox-edit-field inbox-edit-field-wide">
              <span>タグ追加</span>
              <input
                defaultValue={formatTagInput(item.tags)}
                placeholder="#設計 #顧客"
                onBlur={(event) => {
                  const nextTags = parseTagInput(event.target.value);
                  if (nextTags.join("\u001f") !== item.tags.join("\u001f")) {
                    props.onAddTags(item.id, nextTags);
                  }
                }}
              />
            </label>
            <div className="inbox-edit-actions inbox-edit-field inbox-edit-field-wide">
              <button
                type="button"
                className="nav-chip"
                onClick={() => void props.onConvertToTemplate(item.id)}
              >
                {copy.home.inboxTemplateConversion}
              </button>
              <span className="inbox-edit-helper">
                {copy.home.inboxTemplateConversionHelp}
              </span>
            </div>
          </div>
          {item.tags.length > 0 ? (
            <div className="tag-row">
              {item.tags.map((tag) => (
                <span key={tag} className="tag-chip">
                  #{tag}
                </span>
              ))}
            </div>
          ) : null}
          {props.projects.length === 0 ? (
            <p className="task-note">project 未作成でも日付追加は使えます。project 割当は project 作成後に使えます。</p>
          ) : null}
          {item.note ? <p className="task-note">{item.note}</p> : null}
        </article>
      ))}
    </div>
  );
}

function MetricCard(props: { label: string; value: string }) {
  return (
    <div className="metric-card">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}

function formatRiskLabel(riskLevel: string): string {
  if (riskLevel === "high") {
    return "高";
  }
  if (riskLevel === "medium") {
    return "中";
  }
  return "低";
}

function formatPhaseDateRange(startDate: string | null, endDate: string | null): string {
  const start = normalizeDateInput(startDate);
  const end = normalizeDateInput(endDate);

  if (start && end && start !== end) {
    return `${start} - ${end}`;
  }

  return start || end || "日付未設定";
}

function portfolioProjectMatchesFilter(
  project: PortfolioProjectSummary,
  filterMode: PortfolioFilter,
  weekStartsOn: AppSettings["weekStartsOn"]
): boolean {
  if (filterMode === "all") {
    return true;
  }

  if (filterMode === "overdue") {
    return project.overdueCount >= 1;
  }

  return isDateTextWithinCurrentWeek(project.nextMilestoneDate, weekStartsOn);
}

function isDateTextWithinCurrentWeek(
  value: string | null,
  weekStartsOn: AppSettings["weekStartsOn"]
): boolean {
  if (!value) {
    return false;
  }

  const date = parseISO(normalizeDateInput(value));
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const now = new Date();
  return isWithinInterval(date, {
    start: startOfWeek(now, { weekStartsOn: toDateFnsWeekStartsOn(weekStartsOn) }),
    end: endOfWeek(now, { weekStartsOn: toDateFnsWeekStartsOn(weekStartsOn) }),
  });
}

function toDateFnsWeekStartsOn(weekStartsOn: AppSettings["weekStartsOn"]): 0 | 1 {
  return weekStartsOn === "sunday" ? 0 : 1;
}

function ItemRow(props: {
  item: ItemRecord;
  depth: number;
  hasChildren: boolean;
  expanded: boolean;
  isSelected: boolean;
  isDragSource: boolean;
  dropPlacement: RowReorderPlacement | null;
  onToggle: () => void;
  onUpdate: (
    patch: Partial<
      Pick<
        ItemRecord,
        "title" | "type" | "status" | "priority" | "percentComplete" | "startDate" | "endDate" | "assigneeName"
      >
    >
  ) => void;
  onAddChild: () => void;
  onArchive: () => void;
  onMoveHierarchy: (direction: HierarchyMoveDirection) => void;
  onReorderStart: () => void;
  onReorderHover: (placement: RowReorderPlacement) => void;
  onReorderDrop: (placement: RowReorderPlacement) => void;
  onReorderEnd: () => void;
  onOpenDetail: () => void;
  onOpenContextMenu: (position: { x: number; y: number }) => void;
}) {
  const {
    item,
    depth,
    hasChildren,
    expanded,
    isSelected,
    isDragSource,
    dropPlacement,
    onToggle,
    onUpdate,
    onAddChild,
    onArchive,
    onMoveHierarchy,
    onReorderStart,
    onReorderHover,
    onReorderDrop,
    onReorderEnd,
    onOpenDetail,
    onOpenContextMenu,
  } = props;

  return (
    <div
      className={[
        "table-row",
        isSelected ? "selected" : "",
        isDragSource ? "drag-source" : "",
        dropPlacement ? `drop-${dropPlacement}` : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onContextMenu={(event) => {
        event.preventDefault();
        onOpenContextMenu({ x: event.clientX, y: event.clientY });
      }}
      onDragOver={(event) => {
        const placement = getItemRowDropPlacement(event);
        if (!placement) {
          return;
        }
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        onReorderHover(placement);
      }}
      onDrop={(event) => {
        const placement = getItemRowDropPlacement(event);
        if (!placement) {
          return;
        }
        event.preventDefault();
        onReorderDrop(placement);
      }}
    >
      <span className="wbs-cell">
        <button
          type="button"
          className="row-drag-handle"
          draggable
          aria-label="並び替え"
          title={`並び替え: ${item.title}`}
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", item.id);
            onReorderStart();
          }}
          onDragEnd={onReorderEnd}
        >
          ⋮⋮
        </button>
        <span>{item.wbsCode || "-"}</span>
      </span>
      <span>
        <select value={item.type} onChange={(event) => onUpdate({ type: event.target.value as ItemRecord["type"] })}>
          <option value="group">group</option>
          <option value="task">task</option>
          <option value="milestone">milestone</option>
        </select>
      </span>
      <span className="title-cell" style={{ paddingLeft: `${depth * 18 + 10}px` }}>
        {hasChildren ? (
          <button className="tree-toggle" type="button" onClick={onToggle}>
            {expanded ? "▾" : "▸"}
          </button>
        ) : (
          <span className="tree-toggle-spacer" />
        )}
        <input
          key={`${item.id}-title-${item.updatedAt}`}
          defaultValue={item.title}
          onBlur={(event) => onUpdate({ title: event.target.value.trim() || item.title })}
          onKeyDown={(event) => {
            if (event.ctrlKey && event.key === "]") {
              event.preventDefault();
              onMoveHierarchy("indent");
            }
            if (event.ctrlKey && event.key === "[") {
              event.preventDefault();
              onMoveHierarchy("outdent");
            }
          }}
        />
      </span>
      <span>
        <select
          value={item.status}
          onChange={(event) => onUpdate({ status: event.target.value as ItemRecord["status"] })}
        >
          <option value="not_started">not_started</option>
          <option value="in_progress">in_progress</option>
          <option value="blocked">blocked</option>
          <option value="done">done</option>
        </select>
      </span>
      <span>
        <select
          value={item.priority}
          onChange={(event) => onUpdate({ priority: event.target.value as ItemRecord["priority"] })}
        >
          <option value="low">low</option>
          <option value="medium">medium</option>
          <option value="high">high</option>
          <option value="critical">critical</option>
        </select>
      </span>
      <span>
        <input
          key={`${item.id}-assignee-${item.updatedAt}`}
          defaultValue={item.assigneeName}
          placeholder="担当"
          onBlur={(event) => onUpdate({ assigneeName: event.target.value })}
        />
      </span>
      <span>
        <input
          type="date"
          key={`${item.id}-start-${item.updatedAt}`}
          defaultValue={normalizeDateInput(item.startDate)}
          onBlur={(event) => onUpdate({ startDate: event.target.value || null })}
        />
      </span>
      <span>
        <input
          type="date"
          key={`${item.id}-end-${item.updatedAt}`}
          defaultValue={normalizeDateInput(item.endDate)}
          onBlur={(event) => onUpdate({ endDate: event.target.value || null })}
        />
      </span>
      <span>
        <input
          type="number"
          min={0}
          max={100}
          key={`${item.id}-percent-${item.updatedAt}`}
          defaultValue={item.percentComplete}
          onBlur={(event) => onUpdate({ percentComplete: Number(event.target.value) })}
        />
      </span>
      <span>
        {item.tags.length === 0 ? (
          <span className="muted-cell">-</span>
        ) : (
          <div className="tag-row compact">
            {item.tags.map((tag) => (
              <span key={tag} className="tag-chip">
                #{tag}
              </span>
            ))}
          </div>
        )}
      </span>
      <span className="row-actions">
        <button type="button" onClick={() => onMoveHierarchy("outdent")} aria-label="アウトデント">
          ←
        </button>
        <button type="button" onClick={() => onMoveHierarchy("indent")} aria-label="インデント">
          →
        </button>
        <button type="button" onClick={onAddChild}>
          子追加
        </button>
        <button type="button" onClick={onOpenDetail}>
          詳細
        </button>
        <button type="button" className="danger" onClick={onArchive}>
          アーカイブ
        </button>
      </span>
    </div>
  );
}

function ItemContextMenu(props: {
  item: ItemRecord;
  x: number;
  y: number;
  onClose: () => void;
  onOpenDetail: () => void;
  onAddChild: () => void;
  onMoveHierarchy: (direction: HierarchyMoveDirection) => void;
  onArchive: () => void;
}) {
  const { left, top } = getItemContextMenuPosition(props.x, props.y);

  return (
    <div
      className="item-context-menu-backdrop"
      onClick={props.onClose}
      onContextMenu={(event) => {
        event.preventDefault();
        props.onClose();
      }}
    >
      <section
        className="item-context-menu"
        role="menu"
        aria-label="Project Detail Context Menu"
        style={{ left: `${left}px`, top: `${top}px` }}
        onClick={(event) => event.stopPropagation()}
      >
        <p className="sidebar-label">Row Actions</p>
        <strong>{props.item.title}</strong>
        <button type="button" className="nav-chip" role="menuitem" onClick={props.onOpenDetail}>
          詳細
        </button>
        <button type="button" className="nav-chip" role="menuitem" onClick={props.onAddChild}>
          子追加
        </button>
        <button
          type="button"
          className="nav-chip"
          role="menuitem"
          onClick={() => props.onMoveHierarchy("indent")}
        >
          インデント
        </button>
        <button
          type="button"
          className="nav-chip"
          role="menuitem"
          onClick={() => props.onMoveHierarchy("outdent")}
        >
          アウトデント
        </button>
        <button type="button" className="nav-chip danger" role="menuitem" onClick={props.onArchive}>
          アーカイブ
        </button>
      </section>
    </div>
  );
}

function DetailDrawer(props: {
  item: ItemRecord | null;
  projectItems: ItemRecord[];
  onSelectItem: (itemId: string) => void;
  onUpdateItem: (patch: Partial<Pick<ItemRecord, "note" | "tags">>) => void;
  onUpsertRecurrenceRule: (input: {
    itemId: string;
    rruleText: string;
    nextOccurrenceAt: string | null;
  }) => Promise<RecurrenceRule | null>;
  onDeleteRecurrenceRule: (itemId: string) => Promise<boolean>;
}) {
  const {
    item,
    projectItems,
    onSelectItem,
    onUpdateItem,
    onUpsertRecurrenceRule,
    onDeleteRecurrenceRule,
  } = props;
  const dependencyApi = typeof window === "undefined" ? null : window.sgc?.dependencies ?? null;
  const recurrenceApi =
    typeof window === "undefined"
      ? null
      : window.sgc?.recurrenceRules ?? browserApi.recurrenceRules;
  const [dependencies, setDependencies] = useState<DependencyRecord[]>([]);
  const [dependenciesLoading, setDependenciesLoading] = useState(false);
  const [dependencyError, setDependencyError] = useState<string | null>(null);
  const [selectedPredecessorId, setSelectedPredecessorId] = useState("");
  const [lagDaysInput, setLagDaysInput] = useState("0");
  const [recurrenceRule, setRecurrenceRule] = useState<RecurrenceRule | null>(null);
  const [recurrenceLoading, setRecurrenceLoading] = useState(false);
  const [recurrenceError, setRecurrenceError] = useState<string | null>(null);
  const [recurrencePreset, setRecurrencePreset] =
    useState<RecurrencePresetKey>("weekly_monday");
  const [recurrenceIntervalInput, setRecurrenceIntervalInput] = useState("1");
  const [recurrenceByDayInput, setRecurrenceByDayInput] = useState("MO");
  const [recurrenceMonthDayInput, setRecurrenceMonthDayInput] = useState("1");
  const [recurrenceByMonthInput, setRecurrenceByMonthInput] = useState("1");
  const [nextOccurrenceAtInput, setNextOccurrenceAtInput] = useState("");
  const itemId = item?.id ?? null;
  const projectId = item?.projectId ?? null;

  useEffect(() => {
    if (!dependencyApi || !projectId) {
      return;
    }

    let active = true;
    void dependencyApi
      .listByProject(projectId)
      .then((result) => {
        if (!active) {
          return;
        }
        setDependencies(result);
        setDependencyError(null);
      })
      .catch((error) => {
        if (!active) {
          return;
        }
        setDependencyError(error instanceof Error ? error.message : "Failed to load dependencies");
      });

    return () => {
      active = false;
    };
  }, [dependencyApi, itemId, projectId]);

  useEffect(() => {
    if (!recurrenceApi || !itemId || item?.type !== "task") {
      return;
    }

    let active = true;
    void recurrenceApi
      .getByItem(itemId)
      .then((result) => {
        if (!active) {
          return;
        }
        setRecurrenceRule(result);
        setRecurrenceError(null);
        const builderState = deriveRecurrenceBuilderState(result?.rruleText);
        setRecurrencePreset(builderState.preset);
        setRecurrenceIntervalInput(String(builderState.interval));
        setRecurrenceByDayInput(builderState.byDay);
        setRecurrenceMonthDayInput(String(builderState.monthDay));
        setRecurrenceByMonthInput(String(builderState.byMonth));
        setNextOccurrenceAtInput(result?.nextOccurrenceAt ?? "");
      })
      .catch((error) => {
        if (!active) {
          return;
        }
        setRecurrenceRule(null);
        setRecurrenceError(
          error instanceof Error ? error.message : "Failed to load recurrence rule"
        );
      })
      .finally(() => {
        if (active) {
          setRecurrenceLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [item?.type, itemId, recurrenceApi]);

  const itemsById = useMemo(
    () => new Map(projectItems.map((projectItem) => [projectItem.id, projectItem])),
    [projectItems]
  );
  const linkedDependencies = useMemo(
    () =>
      itemId
        ? dependencies.filter(
            (dependency) => dependency.predecessorItemId === itemId || dependency.successorItemId === itemId
          )
        : [],
    [dependencies, itemId]
  );
  const availablePredecessors = useMemo(() => {
    if (!itemId) {
      return [];
    }

    return projectItems
      .filter(
        (projectItem) =>
          !projectItem.archived &&
          projectItem.id !== itemId &&
          !dependencies.some(
            (dependency) =>
              dependency.predecessorItemId === projectItem.id && dependency.successorItemId === itemId
          )
      )
      .sort((left, right) => {
        const leftKey = `${left.wbsCode}|${left.title}`;
        const rightKey = `${right.wbsCode}|${right.title}`;
        return leftKey.localeCompare(rightKey);
      });
  }, [dependencies, itemId, projectItems]);
  const effectiveSelectedPredecessorId = availablePredecessors.some(
    (projectItem) => projectItem.id === selectedPredecessorId
  )
    ? selectedPredecessorId
    : availablePredecessors[0]?.id ?? "";
  const recurrenceAvailability = getRecurrenceAvailability(item);
  const currentRuleSupport = getRecurrenceRuleSupport(recurrenceRule?.rruleText);
  const supportedRecurrenceRuleLabel = currentRuleSupport.supported
    ? currentRuleSupport.label
    : null;

  if (!item) {
    return (
      <section className="detail-drawer empty">
        <div>
          <p className="sidebar-label">Detail Drawer</p>
          <h3>行を選ぶと詳細を編集できます</h3>
          <p>note と tags と dependency と recurrence はここで整理します。</p>
        </div>
        </section>
      );
    }

  const handleAddDependency = async () => {
    if (!dependencyApi || !effectiveSelectedPredecessorId) {
      return;
    }

    const lagDays = Number(lagDaysInput);
    if (!Number.isInteger(lagDays)) {
      setDependencyError("Lag Days must be an integer");
      return;
    }

      setDependenciesLoading(true);
      try {
        const created = await dependencyApi.create({
          predecessorItemId: effectiveSelectedPredecessorId,
          successorItemId: item.id,
          type: "finish_to_start",
          lagDays,
        });
      setDependencies((current) => [...current, created]);
      setDependencyError(null);
      setLagDaysInput("0");
    } catch (error) {
      setDependencyError(
        error instanceof Error ? error.message : "Failed to create dependency"
      );
    } finally {
      setDependenciesLoading(false);
    }
  };

  const handleDeleteDependency = async (dependencyId: string) => {
    if (!dependencyApi) {
      return;
    }

    setDependenciesLoading(true);
    try {
      await dependencyApi.delete(dependencyId);
      setDependencies((current) =>
        current.filter((dependency) => dependency.id !== dependencyId)
      );
      setDependencyError(null);
    } catch (error) {
      setDependencyError(
        error instanceof Error ? error.message : "Failed to delete dependency"
      );
    } finally {
      setDependenciesLoading(false);
    }
  };

  const handleSaveRecurrence = async () => {
    if (!item || !recurrenceAvailability.available) {
      return;
    }

    if (!nextOccurrenceAtInput) {
      setRecurrenceError("次回発生日を入力して下さい");
      return;
    }

    const nextRruleText = buildRecurrenceRuleText({
      preset: recurrencePreset,
      intervalText: recurrenceIntervalInput,
      byDay: recurrenceByDayInput,
      monthDayText: recurrenceMonthDayInput,
      byMonthText: recurrenceByMonthInput,
    });
    if (!nextRruleText.ok) {
      setRecurrenceError(nextRruleText.error);
      return;
    }

    setRecurrenceLoading(true);
    try {
      const saved = await onUpsertRecurrenceRule({
        itemId: item.id,
        rruleText: nextRruleText.rruleText,
        nextOccurrenceAt: nextOccurrenceAtInput,
      });
      if (!saved) {
        return;
      }
      setRecurrenceRule(saved);
      const builderState = deriveRecurrenceBuilderState(saved.rruleText);
      setRecurrencePreset(builderState.preset);
      setRecurrenceIntervalInput(String(builderState.interval));
      setRecurrenceByDayInput(builderState.byDay);
      setRecurrenceMonthDayInput(String(builderState.monthDay));
      setRecurrenceByMonthInput(String(builderState.byMonth));
      setNextOccurrenceAtInput(saved.nextOccurrenceAt ?? "");
      setRecurrenceError(null);
    } finally {
      setRecurrenceLoading(false);
    }
  };

  const handleDeleteRecurrence = async () => {
    if (!item || !recurrenceRule) {
      return;
    }

    setRecurrenceLoading(true);
    try {
      const deleted = await onDeleteRecurrenceRule(item.id);
      if (!deleted) {
        return;
      }
      setRecurrenceRule(null);
      setRecurrencePreset("weekly_monday");
      setNextOccurrenceAtInput("");
      setRecurrenceError(null);
    } finally {
      setRecurrenceLoading(false);
    }
  };

  return (
    <section className="detail-drawer">
      <div className="detail-drawer-header">
        <div>
          <p className="sidebar-label">Detail Drawer</p>
          <h3>{item.title}</h3>
          <p>
            {item.wbsCode || "-"} / {item.type} / {item.status}
          </p>
        </div>
        <button type="button" className="nav-chip active" onClick={() => onSelectItem(item.id)}>
          選択中
        </button>
      </div>

      <div className="detail-drawer-grid">
        <label className="detail-field detail-field-wide">
          ノート
          <textarea
            key={`${item.id}-note-${item.updatedAt}`}
            defaultValue={item.note}
            placeholder="補足メモや次の確認事項"
            onBlur={(event) => {
              const nextNote = event.target.value;
              if (nextNote !== item.note) {
                onUpdateItem({ note: nextNote });
              }
            }}
          />
        </label>

        <label className="detail-field">
          タグ
          <input
            key={`${item.id}-tags-${item.updatedAt}`}
            defaultValue={formatTagInput(item.tags)}
            placeholder="#設計 #顧客"
            onBlur={(event) => {
              const nextTags = parseTagInput(event.target.value);
              if (nextTags.join("\u001f") !== item.tags.join("\u001f")) {
                onUpdateItem({ tags: nextTags });
              }
            }}
          />
          <span className="detail-field-hint">スペースかカンマ区切り。`#` は省略可。</span>
        </label>

        <div className="detail-field">
          <span>日付</span>
          <div className="detail-static">
            {formatDateRange(item) || "未設定"}
          </div>
        </div>

        <div className="detail-field">
          <span>担当 / 優先度</span>
          <div className="detail-static">
            {item.assigneeName ? `@${item.assigneeName}` : "未割当"} / {item.priority}
          </div>
        </div>

        <div className="detail-field detail-field-wide">
          <span>繰り返し</span>
          {!recurrenceAvailability.available ? (
            <div className="detail-placeholder">{recurrenceAvailability.reason}</div>
          ) : (
            <div className="recurrence-editor">
              {recurrenceRule ? (
                <div className="detail-static recurrence-summary">
                  <strong>現在の rule</strong>
                  <span>
                    {supportedRecurrenceRuleLabel ?? recurrenceRule.rruleText}
                    {recurrenceRule.nextOccurrenceAt
                      ? ` / next ${recurrenceRule.nextOccurrenceAt}`
                      : ""}
                  </span>
                </div>
              ) : (
                <div className="detail-placeholder">
                  まだ recurrence rule はありません。
                </div>
              )}
              {recurrenceRule && !currentRuleSupport.supported ? (
                <div className="detail-placeholder recurrence-unsupported-note">
                  unsupported rule: {recurrenceRule.rruleText}
                  {recurrenceRule.nextOccurrenceAt
                    ? ` / next ${recurrenceRule.nextOccurrenceAt}`
                    : ""}
                  。この rule は generation 対象外です。下の builder で再構築して保存できます。
                </div>
              ) : null}
              <div className="recurrence-editor-form">
                <label className="detail-field">
                  <span>Cadence builder</span>
                  <select
                    aria-label="Recurrence preset"
                    value={recurrencePreset}
                    onChange={(event) =>
                      setRecurrencePreset(event.target.value as RecurrencePresetKey)
                    }
                    disabled={recurrenceLoading}
                  >
                    {RECURRENCE_PRESET_OPTIONS.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="detail-field">
                  <span>Interval</span>
                  <input
                    aria-label="Recurrence interval"
                    type="number"
                    min="1"
                    max="99"
                    value={recurrenceIntervalInput}
                    onChange={(event) => setRecurrenceIntervalInput(event.target.value)}
                    disabled={recurrenceLoading}
                  />
                </label>
                {recurrencePreset === "weekly_custom" ? (
                  <label className="detail-field">
                    <span>Weekday</span>
                    <select
                      aria-label="Recurrence weekday"
                      value={recurrenceByDayInput}
                      onChange={(event) => setRecurrenceByDayInput(event.target.value)}
                      disabled={recurrenceLoading}
                    >
                      {RECURRENCE_BY_DAY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {recurrencePreset === "monthly_custom" ? (
                  <label className="detail-field">
                    <span>Month day</span>
                    <input
                      aria-label="Recurrence month day"
                      type="number"
                      min="1"
                      max="31"
                      value={recurrenceMonthDayInput}
                      onChange={(event) => setRecurrenceMonthDayInput(event.target.value)}
                      disabled={recurrenceLoading}
                    />
                  </label>
                ) : null}
                {recurrencePreset === "yearly" ? (
                  <>
                    <label className="detail-field">
                      <span>Month</span>
                      <input
                        aria-label="Recurrence month"
                        type="number"
                        min="1"
                        max="12"
                        value={recurrenceByMonthInput}
                        onChange={(event) => setRecurrenceByMonthInput(event.target.value)}
                        disabled={recurrenceLoading}
                      />
                    </label>
                    <label className="detail-field">
                      <span>Month day</span>
                      <input
                        aria-label="Recurrence month day"
                        type="number"
                        min="1"
                        max="31"
                        value={recurrenceMonthDayInput}
                        onChange={(event) => setRecurrenceMonthDayInput(event.target.value)}
                        disabled={recurrenceLoading}
                      />
                    </label>
                  </>
                ) : null}
                <label className="detail-field">
                  <span>Next occurrence</span>
                  <input
                    aria-label="Next occurrence"
                    type="date"
                    value={nextOccurrenceAtInput}
                    onChange={(event) => setNextOccurrenceAtInput(event.target.value)}
                    disabled={recurrenceLoading}
                  />
                </label>
                <div className="recurrence-editor-actions">
                  <button
                    type="button"
                    onClick={() => void handleSaveRecurrence()}
                    disabled={recurrenceLoading}
                  >
                    {recurrenceRule ? "更新" : "保存"}
                  </button>
                  <button
                    type="button"
                    className="nav-chip"
                    onClick={() => void handleDeleteRecurrence()}
                    disabled={!recurrenceRule || recurrenceLoading}
                  >
                    削除
                  </button>
                </div>
              </div>
              <span className="detail-field-hint">
                weekly / monthly / weekdays は generation 対応です。yearly など generation 対象外 rule も保存して再構築できます。
              </span>
              {recurrenceLoading ? (
                <div className="detail-field-hint">recurrence を同期中です。</div>
              ) : null}
              {recurrenceError ? <div className="detail-inline-error">{recurrenceError}</div> : null}
            </div>
          )}
        </div>

        <div className="detail-field detail-field-wide">
          <span>依存関係</span>
          {!dependencyApi ? (
            <div className="detail-placeholder">
              dependency editor は desktop only です。browser mode では表示のみです。
            </div>
          ) : (
            <div className="dependency-editor">
              <div className="dependency-editor-create">
                <label className="detail-field">
                  <span>先行タスク</span>
                  <select
                      aria-label="先行タスク"
                      value={effectiveSelectedPredecessorId}
                      onChange={(event) => setSelectedPredecessorId(event.target.value)}
                      disabled={availablePredecessors.length === 0 || dependenciesLoading}
                  >
                    {availablePredecessors.length === 0 ? (
                      <option value="">追加可能な先行タスクはありません</option>
                    ) : (
                      availablePredecessors.map((projectItem) => (
                        <option key={projectItem.id} value={projectItem.id}>
                          {formatDependencyItemLabel(projectItem)}
                        </option>
                      ))
                    )}
                  </select>
                </label>
                <label className="detail-field">
                  <span>Lag Days</span>
                  <input
                    aria-label="Lag Days"
                    type="number"
                    step="1"
                    value={lagDaysInput}
                    onChange={(event) => setLagDaysInput(event.target.value)}
                    disabled={dependenciesLoading}
                  />
                </label>
                <div className="dependency-editor-actions">
                  <button
                      type="button"
                      onClick={() => void handleAddDependency()}
                      disabled={!effectiveSelectedPredecessorId || dependenciesLoading}
                    >
                    先行を追加
                  </button>
                </div>
              </div>
              {dependencyError ? <div className="detail-inline-error">{dependencyError}</div> : null}
                {linkedDependencies.length === 0 ? (
                  <div className="detail-placeholder">linked dependency はありません。</div>
                ) : (
                <div className="dependency-list">
                  {linkedDependencies.map((dependency) => {
                    const predecessor = itemsById.get(dependency.predecessorItemId);
                    const successor = itemsById.get(dependency.successorItemId);
                    const relatedItem =
                      dependency.predecessorItemId === item.id ? successor : predecessor;

                    return (
                      <div key={dependency.id} className="dependency-row">
                        <div className="dependency-row-main">
                          <strong>
                            {formatDependencyEdgeLabel(predecessor, successor, dependency)}
                          </strong>
                          <span>
                            {dependency.predecessorItemId === item.id ? "後続" : "先行"} / lag {dependency.lagDays}
                          </span>
                        </div>
                        <div className="dependency-row-actions">
                          {relatedItem ? (
                            <button
                              type="button"
                              className="nav-chip"
                              onClick={() => onSelectItem(relatedItem.id)}
                            >
                              {relatedItem.title} を開く
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="nav-chip"
                            onClick={() => void handleDeleteDependency(dependency.id)}
                            aria-label={`${formatDependencyEdgeLabel(
                              predecessor,
                              successor,
                              dependency
                            )} を削除`}
                            disabled={dependenciesLoading}
                          >
                            削除
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

type RecurrencePresetKey =
  | "weekly_monday"
  | "weekly_custom"
  | "monthly"
  | "monthly_custom"
  | "weekdays"
  | "yearly";

const RECURRENCE_PRESET_OPTIONS: Array<{
  key: RecurrencePresetKey;
  label: string;
}> = [
  {
    key: "weekly_monday",
    label: "週次(月曜)",
  },
  {
    key: "weekly_custom",
    label: "週次(曜日指定)",
  },
  {
    key: "monthly",
    label: "月次",
  },
  {
    key: "monthly_custom",
    label: "月次(日付指定)",
  },
  {
    key: "weekdays",
    label: "平日",
  },
  {
    key: "yearly",
    label: "年次(保存のみ)",
  },
];

const RECURRENCE_BY_DAY_OPTIONS = [
  { value: "MO", label: "月曜" },
  { value: "TU", label: "火曜" },
  { value: "WE", label: "水曜" },
  { value: "TH", label: "木曜" },
  { value: "FR", label: "金曜" },
  { value: "SA", label: "土曜" },
  { value: "SU", label: "日曜" },
];

interface RecurrenceBuilderState {
  preset: RecurrencePresetKey;
  interval: number;
  byDay: string;
  monthDay: number;
  byMonth: number;
}

function deriveRecurrenceBuilderState(rruleText: string | null | undefined): RecurrenceBuilderState {
  const parsed = parseRruleText(rruleText);
  if (!parsed) {
    return {
      preset: "weekly_monday",
      interval: 1,
      byDay: "MO",
      monthDay: 1,
      byMonth: 1,
    };
  }

  if (parsed.freq === "DAILY" && parsed.byDay === "MO,TU,WE,TH,FR") {
    return {
      preset: "weekdays",
      interval: parsed.interval,
      byDay: "MO",
      monthDay: 1,
      byMonth: 1,
    };
  }

  if (parsed.freq === "WEEKLY") {
    const byDay = parsed.byDay?.split(",")[0] ?? "MO";
    return {
      preset: parsed.interval === 1 && byDay === "MO" ? "weekly_monday" : "weekly_custom",
      interval: parsed.interval,
      byDay,
      monthDay: 1,
      byMonth: 1,
    };
  }

  if (parsed.freq === "MONTHLY") {
    const monthDay = parseBoundedInteger(parsed.byMonthDay, 1, 31) ?? 1;
    return {
      preset: parsed.interval === 1 && monthDay === 1 ? "monthly" : "monthly_custom",
      interval: parsed.interval,
      byDay: "MO",
      monthDay,
      byMonth: 1,
    };
  }

  if (parsed.freq === "YEARLY") {
    return {
      preset: "yearly",
      interval: parsed.interval,
      byDay: "MO",
      monthDay: parseBoundedInteger(parsed.byMonthDay, 1, 31) ?? 1,
      byMonth: parseBoundedInteger(parsed.byMonth, 1, 12) ?? 1,
    };
  }

  return {
    preset: "weekly_monday",
    interval: parsed.interval,
    byDay: parsed.byDay?.split(",")[0] ?? "MO",
    monthDay: parseBoundedInteger(parsed.byMonthDay, 1, 31) ?? 1,
    byMonth: parseBoundedInteger(parsed.byMonth, 1, 12) ?? 1,
  };
}

function getRecurrenceRuleSupport(rruleText: string | null | undefined): {
  supported: boolean;
  label: string | null;
} {
  const parsed = parseRruleText(rruleText);
  if (!parsed) {
    return { supported: false, label: null };
  }

  if (parsed.freq === "DAILY" && parsed.byDay === "MO,TU,WE,TH,FR") {
    return { supported: true, label: "平日" };
  }

  if (parsed.freq === "WEEKLY") {
    const byDay = parsed.byDay?.split(",")[0] ?? "MO";
    const label = byDay === "MO" && parsed.interval === 1
      ? "週次(月曜)"
      : `週次(${formatRruleByDay(byDay)} / ${parsed.interval}週ごと)`;
    return { supported: true, label };
  }

  if (parsed.freq === "MONTHLY") {
    const monthDay = parseBoundedInteger(parsed.byMonthDay, 1, 31);
    return {
      supported: true,
      label: monthDay
        ? `月次(${monthDay}日 / ${parsed.interval}か月ごと)`
        : `月次(${parsed.interval}か月ごと)`,
    };
  }

  return { supported: false, label: null };
}

function buildRecurrenceRuleText(input: {
  preset: RecurrencePresetKey;
  intervalText: string;
  byDay: string;
  monthDayText: string;
  byMonthText: string;
}): { ok: true; rruleText: string } | { ok: false; error: string } {
  const interval = parseBoundedInteger(input.intervalText, 1, 99);
  if (!interval) {
    return { ok: false, error: "Interval は 1-99 の整数で入力して下さい" };
  }

  switch (input.preset) {
    case "weekly_monday":
      return { ok: true, rruleText: `FREQ=WEEKLY;INTERVAL=${interval};BYDAY=MO` };
    case "weekly_custom":
      if (!RECURRENCE_BY_DAY_OPTIONS.some((option) => option.value === input.byDay)) {
        return { ok: false, error: "Weekday を選択して下さい" };
      }
      return { ok: true, rruleText: `FREQ=WEEKLY;INTERVAL=${interval};BYDAY=${input.byDay}` };
    case "monthly":
      return { ok: true, rruleText: `FREQ=MONTHLY;INTERVAL=${interval};BYMONTHDAY=1` };
    case "monthly_custom": {
      const monthDay = parseBoundedInteger(input.monthDayText, 1, 31);
      if (!monthDay) {
        return { ok: false, error: "Month day は 1-31 の整数で入力して下さい" };
      }
      return { ok: true, rruleText: `FREQ=MONTHLY;INTERVAL=${interval};BYMONTHDAY=${monthDay}` };
    }
    case "weekdays":
      return { ok: true, rruleText: `FREQ=DAILY;INTERVAL=${interval};BYDAY=MO,TU,WE,TH,FR` };
    case "yearly": {
      const byMonth = parseBoundedInteger(input.byMonthText, 1, 12);
      const monthDay = parseBoundedInteger(input.monthDayText, 1, 31);
      if (!byMonth || !monthDay) {
        return { ok: false, error: "Yearly は Month 1-12 / Month day 1-31 を入力して下さい" };
      }
      return {
        ok: true,
        rruleText: `FREQ=YEARLY;INTERVAL=${interval};BYMONTH=${byMonth};BYMONTHDAY=${monthDay}`,
      };
    }
  }
}

function parseRruleText(rruleText: string | null | undefined): {
  freq: string;
  interval: number;
  byDay: string | null;
  byMonthDay: string | null;
  byMonth: string | null;
} | null {
  if (!rruleText) {
    return null;
  }

  const parts = new Map<string, string>();
  for (const token of rruleText.split(";")) {
    const [key, value] = token.split("=");
    if (key && value) {
      parts.set(key.trim().toUpperCase(), value.trim().toUpperCase());
    }
  }

  const freq = parts.get("FREQ");
  if (!freq) {
    return null;
  }

  return {
    freq,
    interval: parseBoundedInteger(parts.get("INTERVAL") ?? "1", 1, 99) ?? 1,
    byDay: parts.get("BYDAY") ?? null,
    byMonthDay: parts.get("BYMONTHDAY") ?? null,
    byMonth: parts.get("BYMONTH") ?? null,
  };
}

function parseBoundedInteger(value: string | null | undefined, min: number, max: number): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    return null;
  }
  return parsed;
}

function formatRruleByDay(byDay: string): string {
  return RECURRENCE_BY_DAY_OPTIONS.find((option) => option.value === byDay)?.label ?? byDay;
}

function getRecurrenceAvailability(item: ItemRecord | null): {
  available: boolean;
  reason: string;
} {
  if (!item) {
    return {
      available: false,
      reason: "行を選ぶと recurrence を編集できます。",
    };
  }

  if (item.type !== "task") {
    return {
      available: false,
      reason: "recurrence editor は task item だけで使えます。",
    };
  }

  if (!item.isScheduled || !item.startDate || !item.endDate) {
    return {
      available: false,
      reason: "recurrence editor は日付が入った scheduled task で使えます。",
    };
  }

  return {
    available: true,
    reason: "",
  };
}

function formatDependencyItemLabel(item: ItemRecord): string {
  return `${item.wbsCode || "-"} ${item.title}`;
}

function formatDependencyEdgeLabel(
  predecessor: ItemRecord | undefined,
  successor: ItemRecord | undefined,
  dependency: DependencyRecord
): string {
  const predecessorLabel = predecessor ? formatDependencyItemLabel(predecessor) : dependency.predecessorItemId;
  const successorLabel = successor ? formatDependencyItemLabel(successor) : dependency.successorItemId;
  return `${predecessorLabel} -> ${successorLabel}`;
}

function formatDateRange(item: ItemRecord): string {
  const start = item.startDate ? normalizeDateInput(item.startDate) : null;
  const end = item.endDate ? normalizeDateInput(item.endDate) : null;
  const due = item.dueDate ? normalizeDateInput(item.dueDate) : null;

  if (start && end && start !== end) {
    return `${start} - ${end}`;
  }
  return start ?? end ?? due ?? "";
}

function normalizeDateInput(value: string | null): string {
  return value ? value.slice(0, 10) : "";
}

function formatDateTimeText(language: AppLanguage, value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(language === "en" ? "en-US" : "ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatBackupCreatedAt(value: string): string {
  return formatDateTimeText("ja", value);
}

function formatBackupSize(sizeBytes: number): string {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }
  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getBackupKindLabel(fileName: string): "manual" | "auto" | "safety" {
  if (fileName.startsWith("sgc-auto-backup-")) {
    return "auto";
  }
  if (fileName.startsWith("sgc-safety-backup-")) {
    return "safety";
  }
  return "manual";
}

function getSearchFilterToolbarTitle(language: AppLanguage, viewMode: SearchableViewMode): string {
  const copy = getUiCopy(language).searchFilter;
  switch (viewMode) {
    case "home":
      return copy.titleHome;
    case "portfolio":
      return copy.titlePortfolio;
    case "roadmap":
      return copy.titleRoadmap;
    case "project":
      return copy.titleProject;
    default:
      return copy.toolbarLabel;
  }
}

function makeProjectRoadmapItem(project: ProjectSummary): ItemRecord | null {
  const startDate = project.startDate ?? project.endDate ?? project.targetDate;
  const endDate = project.endDate ?? project.startDate ?? project.targetDate;
  if (!startDate || !endDate) {
    return null;
  }

  return {
    id: `roadmap-project-${project.id}`,
    workspaceId: project.workspaceId,
    projectId: project.id,
    projectName: project.name,
    parentId: null,
    wbsCode: "",
    type: "group",
    title: project.name,
    note: "",
    status: project.status,
    priority: project.priority,
    assigneeName: project.ownerName,
    startDate,
    endDate,
    dueDate: project.targetDate,
    durationDays: 1,
    percentComplete: project.progressCached,
    estimateHours: 0,
    actualHours: 0,
    sortOrder: 0,
    isScheduled: true,
    isRecurring: false,
    archived: false,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    completedAt: null,
    tags: [],
  };
}

function buildRoadmapChildrenByParentId(items: ItemRecord[]): Map<string, ItemRecord[]> {
  const childrenByParentId = new Map<string, ItemRecord[]>();
  for (const item of items) {
    if (!item.parentId) {
      continue;
    }

    const bucket = childrenByParentId.get(item.parentId) ?? [];
    bucket.push(item);
    childrenByParentId.set(item.parentId, bucket);
  }
  return childrenByParentId;
}

function buildRoadmapDescendantRows(props: {
  childrenByParentId: Map<string, ItemRecord[]>;
  expandedItemIds: Set<string>;
  filterMode: RoadmapFilter;
  searchFilter: SearchFilterState;
  project: ProjectSummary;
  parentId: string;
  projectId: string;
  depth: number;
}): RoadmapRow[] {
  const children = props.childrenByParentId.get(props.parentId) ?? [];
  const rows: RoadmapRow[] = [];

  for (const child of children) {
    const descendantRows = buildRoadmapDescendantRows({
      ...props,
      parentId: child.id,
      depth: props.depth + 1,
    });
    const childMatches =
      hasRoadmapDate(child) &&
      roadmapItemMatchesFilter(child, props.filterMode) &&
      itemMatchesSearchFilter({
        item: child,
        project: props.project,
        filter: props.searchFilter,
      });
    const includeChild = childMatches || descendantRows.length > 0;
    const expandable = child.type === "group" && descendantRows.length > 0;
    const expanded = expandable && props.expandedItemIds.has(child.id);

    if (!includeChild) {
      continue;
    }

    rows.push({
      kind: "item",
      item: child,
      title: child.title,
      subtitle: child.wbsCode || child.type,
      projectId: props.projectId,
      depth: props.depth,
      expandable,
      expanded,
    });

    if (expanded) {
      rows.push(...descendantRows);
    }
  }

  return rows;
}

function compareRoadmapItems(left: ItemRecord, right: ItemRecord): number {
  return left.sortOrder === right.sortOrder
    ? left.createdAt.localeCompare(right.createdAt)
    : left.sortOrder - right.sortOrder;
}

function hasRoadmapDate(item: ItemRecord): boolean {
  return isRoadmapEligibleItem(item);
}

function roadmapItemMatchesFilter(item: ItemRecord, filterMode: RoadmapFilter): boolean {
  if (filterMode === "all") {
    return hasRoadmapDate(item);
  }

  if (filterMode === "milestone") {
    return item.type === "milestone";
  }

  return isOverdueRoadmapItem(item);
}

function isOverdueRoadmapItem(item: ItemRecord): boolean {
  return isOverdueItem(item, getTodayDateText());
}

function getTodayDateText(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTagInput(tags: string[]): string {
  return tags.map((tag) => `#${tag}`).join(" ");
}

function parseTagInput(value: string): string[] {
  return [...new Set(value.split(/[\s,]+/).map((part) => part.replace(/^#+/, "").trim()).filter(Boolean))];
}

interface RoadmapRow {
  kind: "project" | "item";
  item: ItemRecord;
  title: string;
  subtitle: string;
  projectId: string;
  depth: number;
  expandable: boolean;
  expanded: boolean;
}

type PortfolioFilter = "all" | "overdue" | "week_milestone";
type RoadmapFilter = "all" | "overdue" | "milestone";

interface ActiveTimelineEdit {
  item: ItemRecord;
  itemId: string;
  mode: TimelineInteractionMode;
  scale: TimelineScale;
  pointerId: number;
  startClientX: number;
  columnWidth: number;
  deltaUnits: number;
}

type ProjectItemUpdatePatch = Omit<UpdateItemInput, "id" | "rescheduleScope">;

interface PendingRescheduleChange {
  item: ItemRecord;
  patch: Pick<UpdateItemInput, "startDate" | "endDate">;
}

interface ItemContextMenuState {
  item: ItemRecord;
  x: number;
  y: number;
}

interface ItemRowDropTarget {
  targetItemId: string;
  placement: RowReorderPlacement;
}

function syncVerticalScroll(props: {
  source: "wbs" | "timeline";
  event: UIEvent<HTMLDivElement>;
  peer: HTMLDivElement | null;
  syncLockRef: MutableRefObject<"wbs" | "timeline" | null>;
}) {
  if (!props.peer) {
    return;
  }

  if (props.syncLockRef.current && props.syncLockRef.current !== props.source) {
    props.syncLockRef.current = null;
    return;
  }

  props.syncLockRef.current = props.source;
  props.peer.scrollTop = props.event.currentTarget.scrollTop;
}

function getPreviewLayout(
  layout: TimelineBarLayout,
  mode: TimelineInteractionMode,
  deltaUnits: number,
  columnCount: number
): TimelineBarLayout {
  if (deltaUnits === 0 || columnCount === 0) {
    return layout;
  }

  if (mode === "move") {
    const span = layout.endColumn - layout.startColumn;
    const nextStart = clamp(layout.startColumn + deltaUnits, 0, Math.max(columnCount - span - 1, 0));
    return {
      ...layout,
      startColumn: nextStart,
      endColumn: nextStart + span,
    };
  }

  const nextEnd = clamp(layout.endColumn + deltaUnits, layout.startColumn, columnCount - 1);
  return {
    ...layout,
    endColumn: nextEnd,
    isMilestone: nextEnd === layout.startColumn,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getItemContextMenuPosition(x: number, y: number): { left: number; top: number } {
  if (typeof window === "undefined") {
    return { left: x, top: y };
  }

  const menuWidth = 220;
  const menuHeight = 272;
  const gutter = 12;
  return {
    left: clamp(x, gutter, Math.max(window.innerWidth - menuWidth - gutter, gutter)),
    top: clamp(y, gutter, Math.max(window.innerHeight - menuHeight - gutter, gutter)),
  };
}

function getItemRowDropPlacement(
  event: ReactDragEvent<HTMLDivElement>
): RowReorderPlacement | null {
  const bounds = event.currentTarget.getBoundingClientRect();
  if (bounds.height <= 0) {
    return null;
  }
  const offsetY = event.clientY - bounds.top;
  return offsetY < bounds.height / 2 ? "before" : "after";
}

function isTextEditingElement(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

function shouldPromptReschedule(
  item: ItemRecord,
  patch: ProjectItemUpdatePatch,
  items: ItemRecord[]
): boolean {
  return (
    patch.startDate !== undefined &&
    patch.endDate !== undefined &&
    (patch.startDate !== item.startDate || patch.endDate !== item.endDate) &&
    countDescendants(items, item.id) > 0
  );
}

function countDescendants(items: ItemRecord[], rootId: string): number {
  const childrenByParent = new Map<string | null, ItemRecord[]>();
  for (const item of items) {
    const siblings = childrenByParent.get(item.parentId) ?? [];
    siblings.push(item);
    childrenByParent.set(item.parentId, siblings);
  }

  let count = 0;
  const queue = [...(childrenByParent.get(rootId) ?? [])];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    count += 1;
    queue.push(...(childrenByParent.get(current.id) ?? []));
  }

  return count;
}
