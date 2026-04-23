import {
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
import { buildVisibleRows } from "../domain/project-tree";
import {
  buildRoadmapBuckets,
  buildRoadmapLayout,
  buildRoadmapQuarterHeaders,
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
import type {
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
  RescheduleScope,
  UpdateItemInput,
} from "../shared/contracts";
import { browserApi } from "./lib/browser-api";
import { useAppStore } from "./store/app-store";

type ViewMode = "home" | "portfolio" | "roadmap" | "project";

const PROJECT_DETAIL_ROW_HEIGHT = 58;
const PROJECT_DETAIL_VIRTUAL_OVERSCAN = 6;
const PROJECT_DETAIL_DEFAULT_VIEWPORT_HEIGHT = 560;
const ROADMAP_ROW_HEIGHT = 62;
const ROADMAP_VIRTUAL_OVERSCAN = 6;
const ROADMAP_DEFAULT_VIEWPORT_HEIGHT = 620;

export default function App() {
  const {
    projects,
    selectedProjectId,
    projectDetail,
    homeSummary,
    backups,
    backupPreview,
    startupContext,
    portfolioSummary,
    importPreview,
    loading,
    error,
    notice,
    bootstrap,
    selectProject,
    createProject,
    updateProject,
    createItem,
    updateItem,
    archiveItem,
    captureQuickEntry,
    createBackup,
    previewBackup,
    restoreBackup,
    clearBackupPreview,
    bulkPostponeOverdue,
    moveItemHierarchy,
    previewProjectImport,
    commitProjectImport,
    clearImportPreview,
    exportProjectWorkbook,
    canUndoItemEdit,
    canRedoItemEdit,
    undoItemEdit,
    redoItemEdit,
  } = useAppStore();

  const [viewMode, setViewMode] = useState<ViewMode>("home");
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectCode, setNewProjectCode] = useState("");
  const [quickCaptureText, setQuickCaptureText] = useState("");
  const [timelineScale, setTimelineScale] = useState<TimelineScale>("day");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [activeTimelineEdit, setActiveTimelineEdit] = useState<ActiveTimelineEdit | null>(null);
  const [pendingRescheduleChange, setPendingRescheduleChange] = useState<PendingRescheduleChange | null>(null);
  const [pendingTimelineFocusRestoreItemId, setPendingTimelineFocusRestoreItemId] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [projectDetailScrollTop, setProjectDetailScrollTop] = useState(0);
  const [projectDetailViewportHeight, setProjectDetailViewportHeight] = useState(
    PROJECT_DETAIL_DEFAULT_VIEWPORT_HEIGHT
  );
  const wbsScrollRef = useRef<HTMLDivElement | null>(null);
  const timelineScrollRef = useRef<HTMLDivElement | null>(null);
  const syncLockRef = useRef<"wbs" | "timeline" | null>(null);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const effectiveExpandedIds = useMemo(() => {
    const next = new Set(expandedIds);
    for (const item of projectDetail?.items ?? []) {
      if (!item.parentId) {
        next.add(item.id);
      }
    }
    return next;
  }, [expandedIds, projectDetail?.items]);

  const rows = useMemo(
    () => buildVisibleRows(projectDetail?.items ?? [], effectiveExpandedIds),
    [effectiveExpandedIds, projectDetail?.items]
  );
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
  const timelineColumns = useMemo(
    () => buildTimelineColumns(projectDetail?.items ?? [], timelineScale),
    [projectDetail?.items, timelineScale]
  );
  const timelineLayout = useMemo(
    () => buildTimelineLayout(projectDetail?.items ?? [], timelineColumns),
    [projectDetail?.items, timelineColumns]
  );
  const selectedItem = useMemo(
    () =>
      projectDetail?.items.find((item) => item.id === selectedItemId) ??
      projectDetail?.items[0] ??
      null,
    [projectDetail?.items, selectedItemId]
  );

  const openCount = projectDetail?.items.filter((item) => item.status !== "done").length ?? 0;
  const completedCount = projectDetail?.items.filter((item) => item.status === "done").length ?? 0;

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
      scale: timelineScale,
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
    applyTimelineAdjustment(item, timelineScale, mode, deltaUnits);
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
                <p className="sidebar-label">Recovery</p>
                <h2>起動に失敗したため recovery mode で開いています</h2>
                <p className="capture-copy">
                  DB の初期化または bootstrap に失敗しました。recent backup を確認し、必要なら restore して通常 workspace へ戻してください。
                </p>
              </div>
            </div>
            <div className="error-banner">{startupContext.errorMessage}</div>
            <section className="backup-card" aria-label="Recovery Backups">
              <div className="section-heading">
                <div>
                  <p className="sidebar-label">Recent Backups</p>
                  <strong>復旧候補</strong>
                </div>
              </div>
              {backups.length === 0 ? (
                <p className="empty-message">利用可能な backup はありません。</p>
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
    <div className="shell">
      <aside className="sidebar">
        <div>
          <p className="sidebar-label">Workspace</p>
          <h1>Simple Gantt Chart</h1>
          <p className="sidebar-copy">
            Home / Inbox / Quick Capture を追加しつつ、Project Detail の最小 CRUD を維持しています。
          </p>
        </div>

        <div className="nav-stack">
          <button
            type="button"
            className={viewMode === "home" ? "nav-chip active" : "nav-chip"}
            onClick={() => setViewMode("home")}
          >
            Home / Today
          </button>
          <button
            type="button"
            className={viewMode === "portfolio" ? "nav-chip active" : "nav-chip"}
            onClick={() => setViewMode("portfolio")}
          >
            Portfolio
          </button>
          <button
            type="button"
            className={viewMode === "roadmap" ? "nav-chip active" : "nav-chip"}
            onClick={() => setViewMode("roadmap")}
          >
            Year / FY
          </button>
          <button
            type="button"
            className={viewMode === "project" ? "nav-chip active" : "nav-chip"}
            onClick={() => setViewMode("project")}
            disabled={!selectedProjectId}
          >
            Project Detail
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
            setViewMode("project");
            setNewProjectName("");
            setNewProjectCode("");
          }}
        >
          <label>
            プロジェクト名
            <input
              value={newProjectName}
              onChange={(event) => setNewProjectName(event.target.value)}
              placeholder="例: 基幹刷新"
            />
          </label>
          <label>
            コード
            <input
              value={newProjectCode}
              onChange={(event) => setNewProjectCode(event.target.value)}
              placeholder="例: PRJ-001"
            />
          </label>
          <button type="submit">プロジェクト作成</button>
        </form>

        <div className="project-list">
          {projects.length === 0 ? (
            <p className="empty-message">まず1つプロジェクトを作成して下さい</p>
          ) : (
            projects.map((project) => (
              <button
                key={project.id}
                className={project.id === selectedProjectId ? "project-card selected" : "project-card"}
                onClick={() => {
                  setViewMode("project");
                  void selectProject(project.id);
                }}
                type="button"
              >
                <span className="project-card-code">{project.code}</span>
                <strong>{project.name}</strong>
                <span>{project.progressCached}% complete</span>
              </button>
            ))
          )}
        </div>

        <section className="backup-card" aria-label="Data Protection">
          <div className="section-heading">
            <div>
              <p className="sidebar-label">Data Protection</p>
              <strong>Local Backups</strong>
              <p className="detail-field-hint">自動: 起動時に日次1回 / auto 7件保持</p>
            </div>
            <button type="button" className="nav-chip active" onClick={() => void createBackup()}>
              Backup now
            </button>
          </div>
          {backups.length === 0 ? (
            <p className="empty-message">まだ backup はありません。</p>
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
                    Restore Preview
                  </button>
                </div>
              ))}
            </div>
          )}
          {backupPreview ? (
            <BackupPreviewCard
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

        {viewMode === "home" ? (
          <HomeView
            summary={homeSummary}
            projects={projects}
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
              setViewMode("project");
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
          />
        ) : viewMode === "portfolio" ? (
          <PortfolioView
            summary={portfolioSummary}
            onOpenProject={(projectId) => {
              setViewMode("project");
              void selectProject(projectId);
            }}
          />
        ) : viewMode === "roadmap" ? (
          <RoadmapView
            projects={projects}
            onOpenProject={(projectId) => {
              setViewMode("project");
              void selectProject(projectId);
            }}
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
                <p className="sidebar-label">Project Detail</p>
                <div className="project-header-fields">
                  <label>
                    名前
                    <input
                      key={`${projectDetail.project.id}-name-${projectDetail.project.updatedAt}`}
                      defaultValue={projectDetail.project.name}
                      onBlur={(event) =>
                        void updateProject({
                          id: projectDetail.project.id,
                          name: event.target.value.trim() || projectDetail.project.name,
                          code: projectDetail.project.code,
                        })
                      }
                    />
                  </label>
                  <label>
                    コード
                    <input
                      key={`${projectDetail.project.id}-code-${projectDetail.project.updatedAt}`}
                      defaultValue={projectDetail.project.code}
                      onBlur={(event) =>
                        void updateProject({
                          id: projectDetail.project.id,
                          name: projectDetail.project.name,
                          code: event.target.value.trim() || projectDetail.project.code,
                        })
                      }
                    />
                  </label>
                </div>
              </div>

              <div className="stats-grid">
                <MetricCard label="総タスク" value={String(projectDetail.items.length)} />
                <MetricCard label="未完了" value={String(openCount)} />
                <MetricCard label="完了" value={String(completedCount)} />
                <MetricCard label="進捗" value={`${projectDetail.project.progressCached}%`} />
              </div>

              <div className="timeline-scale-switch">
                <span>Timeline</span>
                <div className="timeline-scale-buttons">
                  {(["day", "week", "month"] as TimelineScale[]).map((scale) => (
                    <button
                      key={scale}
                      type="button"
                      className={timelineScale === scale ? "nav-chip active" : "nav-chip"}
                      onClick={() => setTimelineScale(scale)}
                    >
                      {scale === "day" ? "日" : scale === "week" ? "週" : "月"}
                    </button>
                  ))}
                </div>
                <p className="timeline-keyboard-hint">Alt+←/→ で移動、Alt+Shift+←/→ で右端を調整できます。</p>
              </div>
            </header>

            {importPreview ? (
              <ImportPreviewPanel
                preview={importPreview}
                onCommit={() => void commitProjectImport()}
                onClose={clearImportPreview}
              />
            ) : null}

            <section className="toolbar">
              <div>
                <strong>WBS Tree</strong>
                <p>インデント / アウトデント、優先度、担当、日付、タグ表示までをこのグリッドで編集できます。</p>
              </div>
              <div className="toolbar-actions">
                <button
                  type="button"
                  className="nav-chip"
                  onClick={() => void previewProjectImport()}
                  disabled={!selectedProjectId}
                >
                  Excel Import
                </button>
                <button
                  type="button"
                  className="nav-chip"
                  onClick={() => void exportProjectWorkbook()}
                  disabled={!selectedProjectId}
                >
                  Excel Export
                </button>
                <button type="button" className="nav-chip" onClick={() => void undoItemEdit()} disabled={!canUndoItemEdit}>
                  Undo
                </button>
                <button type="button" className="nav-chip" onClick={() => void redoItemEdit()} disabled={!canRedoItemEdit}>
                  Redo
                </button>
                <button type="button" onClick={() => void createItem(projectDetail.project.id, null)}>
                  ルート行を追加
                </button>
              </div>
            </section>

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
                    <div className="empty-table">親・子・孫を作れる最小 CRUD から開始して下さい。</div>
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
                          onOpenDetail={() => setSelectedItemId(item.id)}
                          isSelected={selectedItem?.id === item.id}
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
                    <div className="empty-table">日付が入った項目を表示します</div>
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

        {loading ? <div className="loading-chip">saving...</div> : null}
      </main>
    </div>
  );
}

function HomeView(props: {
  summary: HomeSummary | null;
  projects: Array<{ id: string; name: string; code: string }>;
  quickCaptureText: string;
  setQuickCaptureText: (value: string) => void;
  onQuickCapture: () => Promise<void>;
  onOpenProject: (projectId: string) => void;
  onBulkPostpone: (target: PostponeTarget) => void;
  onAssignInboxProject: (itemId: string, projectId: string) => void;
  onAddInboxDate: (itemId: string, date: string) => void;
  onAddInboxTags: (itemId: string, tags: string[]) => void;
}) {
  const {
    summary,
    projects,
    quickCaptureText,
    setQuickCaptureText,
    onQuickCapture,
    onOpenProject,
    onBulkPostpone,
    onAssignInboxProject,
    onAddInboxDate,
    onAddInboxTags,
  } = props;

  return (
    <>
      <section className="capture-panel">
        <div>
          <p className="sidebar-label">Quick Capture</p>
          <h2>今日やることを1行で追加</h2>
          <p className="capture-copy">
            例: 見積提出 4/25 #営業 @自分 / 設計レビュー 4/28 15:00 60分
          </p>
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
            placeholder="タスクを入力。例: 見積提出 4/25 #営業 @自分"
          />
          <button type="submit">追加</button>
        </form>
      </section>

      <section className="stats-grid">
        <MetricCard label="Inbox" value={String(summary?.inboxItems.length ?? 0)} />
        <MetricCard label="Today" value={String(summary?.todayItems.length ?? 0)} />
        <MetricCard label="Overdue" value={String(summary?.overdueItems.length ?? 0)} />
        <MetricCard label="今週MS" value={String(summary?.weekMilestones.length ?? 0)} />
      </section>

      <section className="home-grid">
        <SectionCard title="Inbox" subtitle="未計画タスク">
          <InboxTaskList
            items={summary?.inboxItems ?? []}
            projects={projects}
            emptyMessage="今のところ未整理はありません"
            onAssignProject={onAssignInboxProject}
            onAddDate={onAddInboxDate}
            onAddTags={onAddInboxTags}
          />
        </SectionCard>
        <SectionCard title="今日" subtitle="今日にかかるタスク">
          <TaskList items={summary?.todayItems ?? []} emptyMessage="今日の予定はありません" />
        </SectionCard>
        <SectionCard title="期限切れ" subtitle="危険箇所">
          <div className="bulk-actions">
            <span>一括延期</span>
            <div className="bulk-actions-row">
              <button type="button" onClick={() => onBulkPostpone("today")} disabled={(summary?.overdueItems.length ?? 0) === 0}>
                今日へ
              </button>
              <button type="button" onClick={() => onBulkPostpone("tomorrow")} disabled={(summary?.overdueItems.length ?? 0) === 0}>
                明日へ
              </button>
              <button type="button" onClick={() => onBulkPostpone("week_end")} disabled={(summary?.overdueItems.length ?? 0) === 0}>
                今週末へ
              </button>
            </div>
          </div>
          <TaskList items={summary?.overdueItems ?? []} emptyMessage="期限切れはありません" />
        </SectionCard>
        <SectionCard title="今週のマイルストーン" subtitle="直近確認">
          <TaskList items={summary?.weekMilestones ?? []} emptyMessage="今週のマイルストーンはありません" />
        </SectionCard>
      </section>

      <section className="recent-projects">
        <div className="section-heading">
          <div>
            <strong>最近更新したプロジェクト</strong>
            <p>Project row クリックで Project Detail へ移動します。</p>
          </div>
        </div>
        {(summary?.recentProjects.length ?? 0) === 0 ? (
          <div className="empty-table">まず1つプロジェクトを作成して下さい</div>
        ) : (
          <div className="recent-project-list">
            {summary?.recentProjects.map((project) => (
              <button
                key={project.id}
                type="button"
                className="recent-project-card"
                onClick={() => onOpenProject(project.id)}
              >
                <span>{project.code}</span>
                <strong>{project.name}</strong>
                <span>進捗 {project.progressCached}%</span>
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
  preview: BackupPreview;
  canRestore?: boolean;
  onRestore: () => void;
  onClose: () => void;
}) {
  const [confirmingRestore, setConfirmingRestore] = useState(false);

  return (
    <section className="backup-preview-card" aria-label="Restore Preview">
      <div className="section-heading">
        <div>
          <strong>Restore Preview</strong>
          <p>backup snapshot の内容だけを確認します。まだ current DB は変更しません。</p>
        </div>
        <button type="button" className="nav-chip" onClick={props.onClose}>
          閉じる
        </button>
      </div>
      <div className="backup-preview-grid">
        <MetricCard label="Projects" value={String(props.preview.projectCount)} />
        <MetricCard label="Items" value={String(props.preview.itemCount)} />
        <MetricCard
          label="Updated"
          value={
            props.preview.latestUpdatedAt
              ? formatBackupCreatedAt(props.preview.latestUpdatedAt)
              : "-"
          }
        />
      </div>
      <div className="backup-preview-meta">
        <div className="backup-preview-meta-row">
          <span>File</span>
          <strong>{props.preview.fileName}</strong>
        </div>
        <div className="backup-preview-meta-row">
          <span>Created</span>
          <strong>{formatBackupCreatedAt(props.preview.createdAt)}</strong>
        </div>
        <div className="backup-preview-meta-row">
          <span>Size</span>
          <strong>{formatBackupSize(props.preview.sizeBytes)}</strong>
        </div>
      </div>
      {props.canRestore === false ? (
        <p className="detail-field-hint">recovery mode では preview のみ利用できます。復元実行は後続 slice で対応します。</p>
      ) : confirmingRestore ? (
        <div className="backup-restore-confirm">
          <strong>この backup を current state に戻します。</strong>
          <p>desktop では restore 前に safety backup を自動作成します。</p>
          <div className="backup-restore-confirm-actions">
            <button
              type="button"
              className="nav-chip"
              onClick={() => setConfirmingRestore(false)}
            >
              キャンセル
            </button>
            <button
              type="button"
              className="danger"
              onClick={() => {
                setConfirmingRestore(false);
                props.onRestore();
              }}
            >
              Restore
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
            Restore
          </button>
        </div>
      )}
      {props.canRestore === false ? null : (
        <p className="detail-field-hint">restore 後は app state を再読込し、safety backup から再度戻せます。</p>
      )}
    </section>
  );
}

function ImportPreviewPanel(props: {
  preview: ProjectImportPreview;
  onCommit: () => void;
  onClose: () => void;
}) {
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
      ? "warning に一致する行はありません"
      : filterMode === "error"
        ? "error に一致する行はありません"
        : "preview 対象の行はありません";

  return (
    <section className="import-preview-panel">
      <div className="section-heading">
        <div>
          <strong>Excel Import Preview</strong>
          <p>{props.preview.sourcePath ?? "選択済み workbook"}</p>
        </div>
        <div className="toolbar-actions">
          <button type="button" className="nav-chip" onClick={props.onCommit} disabled={!canCommit}>
            適用
          </button>
          <button type="button" className="nav-chip" onClick={props.onClose}>
            閉じる
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
          Browser fallback では DependsOn は preview / validation のみで、適用時には反映しません。
        </div>
      ) : null}
      {warningRows.length > 0 ? (
        <section className="import-preview-warning-summary" aria-label="Warning Summary">
          <div className="section-heading import-preview-warning-summary-heading">
            <div>
              <strong>Warning Summary</strong>
              <p>適用前に確認したい warning 行を先にまとめています。</p>
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
              <strong>Warning-only Table</strong>
              <p>warning を持つ row だけを横並びで比較できます。</p>
            </div>
          </div>
          <div className="import-preview-warning-table">
            <div className="import-preview-warning-table-row import-preview-warning-table-header">
              <span>Row</span>
              <span>Project</span>
              <span>Title</span>
              <span>Action</span>
              <span>Warning</span>
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
          { id: "all", label: "全件" },
          { id: "warning", label: "Warning" },
          { id: "error", label: "Error" },
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
            <span>Row</span>
            <span>Action</span>
            <span>Project</span>
            <span>Title</span>
            <span>Validation</span>
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
                        {isCompareExpanded ? "差分を閉じる" : "差分"}
                      </button>
                    </div>
                  ) : null}
                  {canCompare && isCompareExpanded ? (
                    <div className="import-preview-compare" aria-label={`Row ${row.rowNumber} compare`}>
                      <div className="import-preview-compare-row import-preview-compare-header">
                        <span>Field</span>
                        <span>Before</span>
                        <span>After</span>
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

function PortfolioView(props: {
  summary: PortfolioSummary | null;
  onOpenProject: (projectId: string) => void;
}) {
  const projects = props.summary?.projects ?? [];
  const portfolioApi = window.sgc?.portfolio ?? browserApi.portfolio;
  const [filterMode, setFilterMode] = useState<PortfolioFilter>("all");
  const [expandedProjectIds, setExpandedProjectIds] = useState<Set<string>>(new Set());
  const [phaseMap, setPhaseMap] = useState<Record<string, PortfolioPhaseSummary[]>>({});
  const [loadingProjectIds, setLoadingProjectIds] = useState<Set<string>>(new Set());
  const [loadError, setLoadError] = useState<string | null>(null);
  const filteredProjects = projects.filter((project) => portfolioProjectMatchesFilter(project, filterMode));

  if (projects.length === 0) {
    return (
      <section className="empty-panel">
        <h2>Portfolio 0件</h2>
        <p>まず1つプロジェクトを作成して下さい</p>
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
          <h2>複数案件の危険箇所を横断で確認</h2>
          <p className="capture-copy">
            project 単位で進捗、期限超過、次マイルストーン、直近7日変更数、risk を一覧できます。
          </p>
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
            <strong>Portfolio Summary</strong>
            <p>展開で主要 phase を確認し、行クリックで Project Detail へ移動します。</p>
          </div>
        </div>
        <div className="roadmap-filter-chips">
          {([
            ["all", "全案件"],
            ["overdue", "遅延中"],
            ["week_milestone", "今週マイルストーン"],
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
            <div className="empty-table">条件に合う project はありません</div>
          ) : (
            filteredProjects.map((project) => {
              const isExpanded = expandedProjectIds.has(project.id);
              const phaseRows = phaseMap[project.id] ?? [];
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
                    phaseRows.length > 0 ? (
                      phaseRows.map((phase) => (
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
  projects: ProjectSummary[];
  onOpenProject: (projectId: string) => void;
}) {
  const roadmapApi = window.sgc?.projects ?? browserApi.projects;
  const [scale, setScale] = useState<RoadmapScale>("year");
  const [filterMode, setFilterMode] = useState<RoadmapFilter>("all");
  const [anchorYear, setAnchorYear] = useState(new Date().getFullYear());
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
      }),
    [anchorYear, scale]
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
          parentId: item.id,
          projectId: project.id,
          depth: 1,
        });
        const itemMatches = hasRoadmapDate(item) && roadmapItemMatchesFilter(item, filterMode);
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
        projectItem &&
        (filterMode === "all" ||
          roadmapItemMatchesFilter(projectItem, filterMode) ||
          rootRows.length > 0);

      if (includeProjectRow) {
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
  }, [expandedRoadmapItemIds, filterMode, projectDetails, props.projects]);
  const roadmapLayout = useMemo(
    () => buildRoadmapLayout(roadmapRows.map((row) => row.item), buckets),
    [buckets, roadmapRows]
  );
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
  const quarterHeaders = useMemo(() => buildRoadmapQuarterHeaders(buckets), [buckets]);
  const rangeLabel =
    scale === "year"
      ? `${anchorYear}年`
      : `FY${anchorYear} (${buckets[0]?.label ?? "-"} - ${buckets[buckets.length - 1]?.label ?? "-"})`;

  useEffect(() => {
    const viewportHeight = roadmapBodyRef.current?.clientHeight ?? ROADMAP_DEFAULT_VIEWPORT_HEIGHT;
    setRoadmapViewportHeight(viewportHeight);
  }, [loading, roadmapRows.length]);

  if (props.projects.length === 0) {
    return (
      <section className="empty-panel">
        <h2>Roadmap 0件</h2>
        <p>まず1つプロジェクトを作成して下さい</p>
      </section>
    );
  }

  return (
    <>
      <section className="roadmap-overview">
        <div>
          <p className="sidebar-label">Year / FY Roadmap</p>
          <h2>長期計画を月単位で俯瞰</h2>
          <p className="capture-copy">
            project と主要 row を month bucket へ載せ、必要時だけ descendant を開いて年間 / FY の見通しを確認できます。
          </p>
        </div>
        <div className="roadmap-toolbar">
          <div className="timeline-scale-buttons">
            <button
              type="button"
              className={scale === "year" ? "nav-chip active" : "nav-chip"}
              onClick={() => setScale("year")}
            >
              年
            </button>
            <button
              type="button"
              className={scale === "fy" ? "nav-chip active" : "nav-chip"}
              onClick={() => setScale("fy")}
            >
              FY
            </button>
          </div>
          <div className="roadmap-filter-chips">
            <button
              type="button"
              className={filterMode === "all" ? "nav-chip active" : "nav-chip"}
              onClick={() => setFilterMode("all")}
            >
              全件
            </button>
            <button
              type="button"
              className={filterMode === "overdue" ? "nav-chip active" : "nav-chip"}
              onClick={() => setFilterMode("overdue")}
            >
              期限超過
            </button>
            <button
              type="button"
              className={filterMode === "milestone" ? "nav-chip active" : "nav-chip"}
              onClick={() => setFilterMode("milestone")}
            >
              マイルストーン
            </button>
          </div>
          <div className="roadmap-year-nav">
            <button type="button" className="nav-chip" onClick={() => setAnchorYear((current) => current - 1)}>
              前年
            </button>
            <strong>{rangeLabel}</strong>
            <button type="button" className="nav-chip" onClick={() => setAnchorYear((current) => current + 1)}>
              次年
            </button>
          </div>
        </div>
      </section>

      <section className="roadmap-panel">
        {error ? <div className="error-banner">{error}</div> : null}
        <div
          className="roadmap-quarter-header roadmap-grid"
          style={{ gridTemplateColumns: `280px repeat(${buckets.length}, minmax(56px, 1fr))` }}
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
          style={{ gridTemplateColumns: `280px repeat(${buckets.length}, minmax(56px, 1fr))` }}
        >
          <span className="roadmap-header-title">項目</span>
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
            <div className="empty-table">roadmap を読み込み中です</div>
          ) : roadmapRows.length === 0 ? (
            <div className="empty-table">条件に合う project / root item はありません</div>
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
                  style={{ gridTemplateColumns: `280px repeat(${buckets.length}, minmax(56px, 1fr))` }}
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
    </>
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
  items: ItemRecord[];
  projects: Array<{ id: string; name: string; code: string }>;
  emptyMessage: string;
  onAssignProject: (itemId: string, projectId: string) => void;
  onAddDate: (itemId: string, date: string) => void;
  onAddTags: (itemId: string, tags: string[]) => void;
}) {
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

function portfolioProjectMatchesFilter(project: PortfolioProjectSummary, filterMode: PortfolioFilter): boolean {
  if (filterMode === "all") {
    return true;
  }

  if (filterMode === "overdue") {
    return project.overdueCount >= 1;
  }

  return isDateTextWithinCurrentWeek(project.nextMilestoneDate);
}

function isDateTextWithinCurrentWeek(value: string | null): boolean {
  if (!value) {
    return false;
  }

  const date = parseISO(normalizeDateInput(value));
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const now = new Date();
  return isWithinInterval(date, {
    start: startOfWeek(now, { weekStartsOn: 1 }),
    end: endOfWeek(now, { weekStartsOn: 1 }),
  });
}

function ItemRow(props: {
  item: ItemRecord;
  depth: number;
  hasChildren: boolean;
  expanded: boolean;
  isSelected: boolean;
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
  onOpenDetail: () => void;
}) {
  const {
    item,
    depth,
    hasChildren,
    expanded,
    isSelected,
    onToggle,
    onUpdate,
    onAddChild,
    onArchive,
    onMoveHierarchy,
    onOpenDetail,
  } = props;

  return (
    <div className={isSelected ? "table-row selected" : "table-row"}>
      <span>{item.wbsCode || "-"}</span>
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

function DetailDrawer(props: {
  item: ItemRecord | null;
  projectItems: ItemRecord[];
  onSelectItem: (itemId: string) => void;
  onUpdateItem: (patch: Partial<Pick<ItemRecord, "note" | "tags">>) => void;
}) {
  const { item, projectItems, onSelectItem, onUpdateItem } = props;
  const dependencyApi = typeof window === "undefined" ? null : window.sgc?.dependencies ?? null;
  const [dependencies, setDependencies] = useState<DependencyRecord[]>([]);
  const [dependenciesLoading, setDependenciesLoading] = useState(false);
  const [dependencyError, setDependencyError] = useState<string | null>(null);
  const [selectedPredecessorId, setSelectedPredecessorId] = useState("");
  const [lagDaysInput, setLagDaysInput] = useState("0");
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

  if (!item) {
    return (
      <section className="detail-drawer empty">
        <div>
          <p className="sidebar-label">Detail Drawer</p>
          <h3>行を選ぶと詳細を編集できます</h3>
          <p>note と tags と dependency はここで整理します。</p>
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

function formatBackupCreatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
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
    const childMatches = hasRoadmapDate(child) && roadmapItemMatchesFilter(child, props.filterMode);
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
  return Boolean(item.startDate || item.endDate || item.dueDate);
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
  if (item.status === "done" || item.status === "archived") {
    return false;
  }

  const effectiveDate = item.endDate ?? item.startDate ?? item.dueDate;
  if (!effectiveDate) {
    return false;
  }

  return normalizeDateInput(effectiveDate) < getTodayDateText();
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
