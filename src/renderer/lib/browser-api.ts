import {
  addDays,
  differenceInCalendarDays,
  endOfDay,
  endOfWeek,
  isSameDay,
  parseISO,
  startOfDay,
  startOfWeek,
} from "date-fns";
import { exportProjectWorkbookXlsx } from "../../infra/excel/project-workbook-export";
import { normalizeProjectItems } from "../../domain/project-tree";
import { parseQuickCapture } from "../../domain/quick-capture";
import { addWorkingDays } from "../../domain/working-days";
import type {
  CreateDependencyInput,
  CreateItemInput,
  DependencyRecord,
  CreateProjectInput,
  HomeSummary,
  ItemRecord,
  PostponeTarget,
  ProjectDetail,
  ProjectImportCommitResult,
  ProjectImportPreview,
  ProjectExportResult,
  PortfolioProjectPhases,
  PortfolioSummary,
  ProjectSummary,
  QuickCaptureInput,
  RendererApi,
  UpdateItemInput,
  UpdateProjectInput,
} from "../../shared/contracts";

const INBOX_PROJECT_CODE = "_INBOX";
const INBOX_PROJECT_NAME = "Inbox";

const memory = {
  projects: [] as ProjectSummary[],
  items: [] as ItemRecord[],
};

export const browserApi: RendererApi = {
  home: {
    async getSummary(): Promise<HomeSummary> {
      const inboxProject = ensureInboxProject();
      const now = new Date();
      const todayStart = startOfDay(now);
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
      const dashboardItems = memory.items.filter(
        (item) => !item.archived && item.projectId !== inboxProject.id
      );

      return {
        inboxItems: memory.items
          .filter((item) => item.projectId === inboxProject.id && !item.archived && !item.isScheduled)
          .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
        todayItems: dashboardItems.filter((item) => isScheduledOnDay(item, now)),
        overdueItems: dashboardItems.filter((item) => isOverdue(item, todayStart)),
        weekMilestones: dashboardItems.filter((item) => {
          if (item.type !== "milestone") {
            return false;
          }
          const effectiveDate = getEffectiveDate(item);
          if (!effectiveDate) {
            return false;
          }
          const date = parseISO(effectiveDate);
          return date >= weekStart && date <= weekEnd;
        }),
        recentProjects: listUserProjects().slice(0, 5),
      };
    },
  },
  portfolio: {
    async getSummary(): Promise<PortfolioSummary> {
      const now = new Date();
      const todayStart = startOfDay(now);
      const recentWindowStart = addDays(now, -7);

      return {
        projects: listUserProjects().map((project) => {
          const projectItems = memory.items.filter(
            (item) => item.projectId === project.id && !item.archived
          );
          const overdueItems = projectItems.filter((item) => isOverdue(item, todayStart));
          const nextMilestone = findNextMilestone(projectItems);
          const recentChangeCount7d = projectItems.filter(
            (item) => parseISO(item.updatedAt) >= recentWindowStart
          ).length;

          return {
            id: project.id,
            code: project.code,
            name: project.name,
            ownerName: project.ownerName,
            status: project.status,
            progressCached: project.progressCached,
            overdueCount: overdueItems.length,
            nextMilestoneTitle: nextMilestone?.title ?? null,
            nextMilestoneDate: nextMilestone?.date ?? null,
            recentChangeCount7d,
            riskLevel: computePortfolioRiskLevel({
              overdueCount: overdueItems.length,
              blockedCount: projectItems.filter((item) => item.status === "blocked").length,
              nextMilestoneDate: nextMilestone?.date ?? null,
              todayStart,
            }),
          };
        }),
      };
    },
    async getProjectPhases(projectId: string): Promise<PortfolioProjectPhases> {
      const projectItems = memory.items.filter(
        (item) => item.projectId === projectId && !item.archived
      );
      const now = new Date();
      const todayStart = startOfDay(now);
      const recentWindowStart = addDays(now, -7);
      const phases = projectItems.filter(
        (item) => item.parentId === null && item.type === "group"
      );

      return {
        projectId,
        phases: phases.map((phase) => {
          const scopeItems = collectSubtreeItems(projectItems, phase.id).filter(
            (item) => item.id !== phase.id
          );
          const overdueItems = scopeItems.filter((item) => isOverdue(item, todayStart));
          const nextMilestone = findNextMilestone(scopeItems);
          const recentChangeCount7d = scopeItems.filter(
            (item) => parseISO(item.updatedAt) >= recentWindowStart
          ).length;

          return {
            id: phase.id,
            projectId,
            wbsCode: phase.wbsCode,
            title: phase.title,
            status: phase.status,
            progressCached: phase.percentComplete,
            overdueCount: overdueItems.length,
            nextMilestoneTitle: nextMilestone?.title ?? null,
            nextMilestoneDate: nextMilestone?.date ?? null,
            recentChangeCount7d,
            riskLevel: computePortfolioRiskLevel({
              overdueCount: overdueItems.length,
              blockedCount: scopeItems.filter((item) => item.status === "blocked").length,
              nextMilestoneDate: nextMilestone?.date ?? null,
              todayStart,
            }),
            startDate: phase.startDate,
            endDate: phase.endDate,
          };
        }),
      };
    },
  },
  dependencies: {
    async listByProject(projectId: string): Promise<DependencyRecord[]> {
      requireProject(projectId);
      return [];
    },
    async create(input: CreateDependencyInput): Promise<DependencyRecord> {
      void input;
      throw new Error("Dependency API is not available in browser mode");
    },
    async delete(dependencyId: string): Promise<void> {
      void dependencyId;
      throw new Error("Dependency API is not available in browser mode");
    },
  },
  projects: {
    async list() {
      return listUserProjects();
    },
    async create(input: CreateProjectInput) {
      const now = new Date().toISOString();
      const project: ProjectSummary = {
        id: crypto.randomUUID(),
        workspaceId: "browser",
        code: input.code ?? `PRJ-${String(listUserProjects().length + 1).padStart(3, "0")}`,
        name: input.name,
        description: "",
        ownerName: "",
        status: "not_started",
        priority: "medium",
        color: "",
        startDate: null,
        endDate: null,
        targetDate: null,
        progressCached: 0,
        riskLevel: "normal",
        archived: false,
        createdAt: now,
        updatedAt: now,
      };

      memory.projects.unshift(project);
      return project;
    },
    async update(input: UpdateProjectInput) {
      const project = requireProject(input.id);
      project.name = input.name;
      project.code = input.code;
      project.updatedAt = new Date().toISOString();
      return project;
    },
    async get(projectId: string): Promise<ProjectDetail> {
      return {
        project: requireProject(projectId),
        items: memory.items.filter((item) => item.projectId === projectId && !item.archived),
      };
    },
    async previewImport(projectId: string): Promise<ProjectImportPreview | null> {
      void projectId;
      throw new Error("Import preview is not available in browser mode");
    },
    async commitImport(
      projectId: string,
      sourcePath: string
    ): Promise<ProjectImportCommitResult> {
      void projectId;
      void sourcePath;
      throw new Error("Import commit is not available in browser mode");
    },
    async exportWorkbook(projectId: string): Promise<ProjectExportResult> {
      const project = requireProject(projectId);
      const items = memory.items.filter((item) => item.projectId === projectId && !item.archived);
      const bytes = exportProjectWorkbookXlsx({
        project,
        items,
        dependencies: [],
      });
      const browserBytes = new Uint8Array(Array.from(bytes));
      const blob = new Blob([browserBytes], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${sanitizeFileName(project.code || project.name || "project")}.xlsx`;
      anchor.click();
      URL.revokeObjectURL(url);
      return { filePath: null };
    },
  },
  items: {
    async create(input: CreateItemInput) {
      const now = new Date().toISOString();
      const siblings = memory.items.filter(
        (item) =>
          item.projectId === input.projectId &&
          item.parentId === (input.parentId ?? null) &&
          !item.archived
      );

      const item: ItemRecord = {
        id: crypto.randomUUID(),
        workspaceId: "browser",
        projectId: input.projectId,
        projectName: requireProject(input.projectId).name,
        parentId: input.parentId ?? null,
        wbsCode: "",
        type: input.type ?? "task",
        title: input.title,
        note: "",
        status: "not_started",
        priority: "medium",
        assigneeName: "",
        startDate: null,
        endDate: null,
        dueDate: null,
        durationDays: 1,
        percentComplete: 0,
        estimateHours: 0,
        actualHours: 0,
        sortOrder: siblings.length + 1,
        isScheduled: false,
        isRecurring: false,
        archived: false,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
        tags: [],
      };

      memory.items.push(item);
      rebalanceProject(input.projectId);
      return requireItem(item.id);
    },
    async update(input: UpdateItemInput) {
      const item = requireItem(input.id);
      const previousProjectId = item.projectId;
      const projectItems = memory.items.filter((entry) => entry.projectId === item.projectId && !entry.archived);
      const itemStateById = new Map(projectItems.map((entry) => [entry.id, entry]));
      const rescheduleDeltaDays =
        (input.rescheduleScope === "with_descendants" || input.rescheduleScope === "with_dependents") &&
        input.projectId === undefined
          ? resolveRescheduleDeltaDays(item, input)
          : 0;
      const descendantItems =
        (input.rescheduleScope === "with_descendants" || input.rescheduleScope === "with_dependents") &&
        rescheduleDeltaDays !== 0
          ? collectSubtreeItems(projectItems, item.id).filter((entry) => entry.id !== item.id)
          : [];
      if (input.title !== undefined) {
        item.title = input.title;
      }
      if (input.projectId !== undefined && input.projectId !== item.projectId) {
        const nextProject = requireProject(input.projectId);
        item.projectId = nextProject.id;
        item.projectName = nextProject.name;
        item.parentId = null;
        item.sortOrder = nextSiblingSortOrder(
          memory.items.filter((entry) => entry.projectId === nextProject.id && !entry.archived),
          null
        );
      }
      if (input.type !== undefined) {
        item.type = input.type;
      }
      if (input.status !== undefined) {
        item.status = input.status;
      }
      if (input.priority !== undefined) {
        item.priority = input.priority;
      }
      if (input.percentComplete !== undefined) {
        item.percentComplete = input.percentComplete;
      }
      if (input.startDate !== undefined) {
        item.startDate = input.startDate;
      }
      if (input.endDate !== undefined) {
        item.endDate = input.endDate;
      }
      if (input.assigneeName !== undefined) {
        item.assigneeName = input.assigneeName;
      }
      if (input.note !== undefined) {
        item.note = input.note;
      }
      if (input.tags !== undefined) {
        item.tags = normalizeTagNames(input.tags);
      }
      item.dueDate = item.endDate ?? item.startDate ?? item.dueDate;
      item.updatedAt = new Date().toISOString();
      item.completedAt = item.status === "done" ? item.completedAt ?? item.updatedAt : null;
      item.isScheduled = Boolean(item.startDate && item.endDate);
      itemStateById.set(item.id, item);
      for (const descendant of descendantItems) {
        applyShiftedDates(descendant, rescheduleDeltaDays, item.updatedAt);
        itemStateById.set(descendant.id, descendant);
      }
      if (input.rescheduleScope === "with_dependents" && rescheduleDeltaDays !== 0 && input.projectId === undefined) {
        applyDependentShift({
          itemsById: itemStateById,
          projectItems,
          dependencies: [],
          changedRootIds: [item.id, ...descendantItems.map((entry) => entry.id)],
          updatedAt: item.updatedAt,
        });
      }
      if (previousProjectId !== item.projectId) {
        rebalanceProject(previousProjectId);
      }
      rebalanceProject(item.projectId);
      return requireItem(item.id);
    },
    async archive(itemId: string) {
      const item = requireItem(itemId);
      const ids = collectSubtreeIds(item.projectId, itemId);
      for (const id of ids) {
        const target = requireItem(id);
        target.archived = true;
        target.status = "archived";
      }
      rebalanceProject(item.projectId);
    },
    async bulkPostponeOverdue(input) {
      const now = new Date();
      const targetDateText = formatDateOnly(getPostponeDate(input.target, now));
      const overdueItems = memory.items.filter((item) => !item.archived && isOverdue(item, startOfDay(now)));

      for (const item of overdueItems) {
        item.startDate = item.startDate ? targetDateText : item.startDate;
        item.endDate = item.endDate ? targetDateText : item.endDate;
        item.dueDate = targetDateText;
        item.isScheduled = Boolean(item.startDate && item.endDate);
        item.durationDays = deriveDurationDays(item.startDate, item.endDate);
        item.updatedAt = now.toISOString();
      }

      for (const projectId of new Set(overdueItems.map((item) => item.projectId))) {
        rebalanceProject(projectId);
      }

      return overdueItems.map((item) => requireItem(item.id));
    },
    async moveHierarchy(input) {
      const item = requireItem(input.itemId);
      const nextHierarchy = resolveHierarchyMove(
        memory.items.filter((entry) => entry.projectId === item.projectId && !entry.archived),
        input.itemId,
        input.direction
      );
      if (!nextHierarchy) {
        return item;
      }

      item.parentId = nextHierarchy.parentId;
      item.sortOrder = nextHierarchy.sortOrder;
      item.updatedAt = new Date().toISOString();
      rebalanceProject(item.projectId);
      return requireItem(item.id);
    },
  },
  quickCapture: {
    async create(input: QuickCaptureInput) {
      const parsed = parseQuickCapture(input.text);
      const matchedProject = resolveProjectFromCapture(parsed.title);
      const project = matchedProject ?? ensureInboxProject();
      const title = stripMatchedProjectPrefix(parsed.title, matchedProject) || parsed.title;
      const siblings = memory.items.filter(
        (item) => item.projectId === project.id && item.parentId === null && !item.archived
      );
      const now = new Date().toISOString();

      const item: ItemRecord = {
        id: crypto.randomUUID(),
        workspaceId: "browser",
        projectId: project.id,
        projectName: project.name,
        parentId: null,
        wbsCode: "",
        type: "task",
        title,
        note: parsed.note,
        status: "not_started",
        priority: parsed.priority,
        assigneeName: parsed.assigneeName,
        startDate: parsed.startDate,
        endDate: parsed.endDate,
        dueDate: parsed.dueDate,
        durationDays: deriveDurationDays(parsed.startDate, parsed.endDate),
        percentComplete: 0,
        estimateHours: parsed.estimateHours,
        actualHours: 0,
        sortOrder: siblings.length + 1,
        isScheduled: parsed.isScheduled,
        isRecurring: false,
        archived: false,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
        tags: parsed.tags,
      };

      memory.items.push(item);
      rebalanceProject(project.id);
      return requireItem(item.id);
    },
  },
};

function rebalanceProject(projectId: string): void {
  const project = requireProject(projectId);
  const projectItems = memory.items.filter((item) => item.projectId === projectId && !item.archived);
  const rollup = normalizeProjectItems(projectItems);
  const now = new Date().toISOString();

  for (const item of rollup.items) {
    const target = requireItem(item.id);
    Object.assign(target, item, { updatedAt: now, projectName: project.name });
  }

  project.startDate = rollup.projectStartDate;
  project.endDate = rollup.projectEndDate;
  project.progressCached = rollup.projectProgress;
  project.updatedAt = now;
}

function listUserProjects(): ProjectSummary[] {
  return [...memory.projects]
    .filter((project) => !project.archived && project.code !== INBOX_PROJECT_CODE)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
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

function ensureInboxProject(): ProjectSummary {
  const existing = memory.projects.find((project) => project.code === INBOX_PROJECT_CODE && !project.archived);
  if (existing) {
    return existing;
  }

  const now = new Date().toISOString();
  const project: ProjectSummary = {
    id: crypto.randomUUID(),
    workspaceId: "browser",
    code: INBOX_PROJECT_CODE,
    name: INBOX_PROJECT_NAME,
    description: "",
    ownerName: "",
    status: "not_started",
    priority: "medium",
    color: "",
    startDate: null,
    endDate: null,
    targetDate: null,
    progressCached: 0,
    riskLevel: "normal",
    archived: false,
    createdAt: now,
    updatedAt: now,
  };

  memory.projects.push(project);
  return project;
}

function resolveProjectFromCapture(title: string): ProjectSummary | null {
  for (const project of listUserProjects()) {
    if (title === project.name || title.startsWith(`${project.name} `)) {
      return project;
    }
    if (title === project.code || title.startsWith(`${project.code} `)) {
      return project;
    }
  }
  return null;
}

function stripMatchedProjectPrefix(title: string, project: ProjectSummary | null): string {
  if (!project) {
    return title;
  }
  if (title.startsWith(`${project.name} `)) {
    return title.slice(project.name.length).trim();
  }
  if (title.startsWith(`${project.code} `)) {
    return title.slice(project.code.length).trim();
  }
  return title;
}

function collectSubtreeIds(projectId: string, rootId: string): string[] {
  const projectItems = memory.items.filter((item) => item.projectId === projectId);
  const childrenByParent = new Map<string | null, ItemRecord[]>();
  for (const item of projectItems) {
    const siblings = childrenByParent.get(item.parentId) ?? [];
    siblings.push(item);
    childrenByParent.set(item.parentId, siblings);
  }

  const ids: string[] = [];
  const visit = (itemId: string): void => {
    ids.push(itemId);
    for (const child of childrenByParent.get(itemId) ?? []) {
      visit(child.id);
    }
  };

  visit(rootId);
  return ids;
}

function collectSubtreeItems(items: ItemRecord[], rootId: string): ItemRecord[] {
  const ids = new Set(collectSubtreeIdsForItems(items, rootId));
  return items.filter((item) => ids.has(item.id));
}

function collectSubtreeIdsForItems(items: ItemRecord[], rootId: string): string[] {
  const childrenByParent = new Map<string | null, ItemRecord[]>();
  for (const item of items) {
    const siblings = childrenByParent.get(item.parentId) ?? [];
    siblings.push(item);
    childrenByParent.set(item.parentId, siblings);
  }

  const ids: string[] = [];
  const visit = (itemId: string): void => {
    ids.push(itemId);
    for (const child of childrenByParent.get(itemId) ?? []) {
      visit(child.id);
    }
  };

  visit(rootId);
  return ids;
}

function getEffectiveDate(item: ItemRecord): string | null {
  return item.endDate ?? item.startDate ?? item.dueDate;
}

function findNextMilestone(
  items: ItemRecord[]
): { title: string; date: string } | null {
  const milestones = items
    .filter((item) => item.type === "milestone" && item.status !== "done" && item.status !== "archived")
    .map((item) => ({
      title: item.title,
      date: getEffectiveDate(item),
    }))
    .filter((item): item is { title: string; date: string } => Boolean(item.date))
    .sort((left, right) => left.date.localeCompare(right.date));

  return milestones[0] ?? null;
}

function computePortfolioRiskLevel(input: {
  overdueCount: number;
  blockedCount: number;
  nextMilestoneDate: string | null;
  todayStart: Date;
}): string {
  if (input.overdueCount >= 5) {
    return "high";
  }

  if (input.overdueCount >= 1) {
    return "medium";
  }

  if (
    input.blockedCount > 0 &&
    input.nextMilestoneDate &&
    parseISO(input.nextMilestoneDate) <= addDays(input.todayStart, 7)
  ) {
    return "high";
  }

  return "normal";
}

function isOverdue(item: ItemRecord, todayStart: Date): boolean {
  if (item.status === "done" || item.status === "archived") {
    return false;
  }

  const dateText = getEffectiveDate(item);
  return dateText ? parseISO(dateText) < todayStart : false;
}

function isScheduledOnDay(item: ItemRecord, day: Date): boolean {
  const start = item.startDate ? parseISO(item.startDate) : null;
  const end = item.endDate ? parseISO(item.endDate) : null;
  const due = item.dueDate ? parseISO(item.dueDate) : null;

  if (start && end) {
    return start <= endOfDay(day) && end >= startOfDay(day);
  }

  return due ? isSameDay(due, day) : false;
}

function deriveDurationDays(startDate: string | null, endDate: string | null): number {
  if (!startDate || !endDate) {
    return 1;
  }

  const diff = endOfDay(parseISO(endDate)).getTime() - startOfDay(parseISO(startDate)).getTime();
  return Math.max(Math.round(diff / (24 * 60 * 60 * 1000)) + 1, 1);
}

function getPostponeDate(target: PostponeTarget, now: Date): Date {
  switch (target) {
    case "today":
      return startOfDay(now);
    case "tomorrow":
      return startOfDay(addDays(now, 1));
    case "week_end":
      return startOfDay(endOfWeek(now, { weekStartsOn: 1 }));
  }
}

function formatDateOnly(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function resolveHierarchyMove(
  items: ItemRecord[],
  itemId: string,
  direction: "indent" | "outdent"
): { parentId: string | null; sortOrder: number } | null {
  const item = items.find((entry) => entry.id === itemId);
  if (!item) {
    return null;
  }

  if (direction === "outdent") {
    if (!item.parentId) {
      return null;
    }
    const parent = items.find((entry) => entry.id === item.parentId);
    return {
      parentId: parent?.parentId ?? null,
      sortOrder: nextSiblingSortOrder(items, parent?.parentId ?? null),
    };
  }

  const ordered = buildPreorder(items);
  const currentIndex = ordered.findIndex((entry) => entry.id === itemId);
  if (currentIndex <= 0) {
    return null;
  }

  const previousItem = ordered[currentIndex - 1];
  if (!previousItem || previousItem.type === "milestone" || previousItem.id === item.parentId) {
    return null;
  }

  return {
    parentId: previousItem.id,
    sortOrder: nextSiblingSortOrder(items, previousItem.id),
  };
}

function buildPreorder(items: ItemRecord[]): ItemRecord[] {
  const childrenByParent = new Map<string | null, ItemRecord[]>();
  for (const item of items) {
    const siblings = childrenByParent.get(item.parentId) ?? [];
    siblings.push(item);
    childrenByParent.set(item.parentId, siblings);
  }

  const sortItems = (values: ItemRecord[]) =>
    [...values].sort((left, right) =>
      left.sortOrder === right.sortOrder
        ? left.createdAt.localeCompare(right.createdAt)
        : left.sortOrder - right.sortOrder
    );

  const ordered: ItemRecord[] = [];
  const walk = (parentId: string | null): void => {
    for (const child of sortItems(childrenByParent.get(parentId) ?? [])) {
      ordered.push(child);
      walk(child.id);
    }
  };

  walk(null);
  return ordered;
}

function nextSiblingSortOrder(items: ItemRecord[], parentId: string | null): number {
  const siblings = items.filter((entry) => entry.parentId === parentId && !entry.archived);
  const maxSortOrder = siblings.reduce((max, entry) => Math.max(max, entry.sortOrder), 0);
  return maxSortOrder + 1;
}

function requireProject(projectId: string): ProjectSummary {
  const project = memory.projects.find((entry) => entry.id === projectId && !entry.archived);
  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }

  return project;
}

function requireItem(itemId: string): ItemRecord {
  const item = memory.items.find((entry) => entry.id === itemId);
  if (!item) {
    throw new Error(`Item not found: ${itemId}`);
  }

  return item;
}

function normalizeTagNames(tagNames: string[]): string[] {
  return [...new Set(tagNames.map((name) => name.trim()).filter(Boolean))];
}

function resolveRescheduleDeltaDays(item: ItemRecord, input: UpdateItemInput): number {
  if (input.startDate === undefined || input.endDate === undefined) {
    return 0;
  }

  const nextStartDate = input.startDate;
  const nextEndDate = input.endDate;
  if (!item.startDate || !item.endDate || !nextStartDate || !nextEndDate) {
    return 0;
  }

  const startDeltaDays = differenceInCalendarDays(parseISO(nextStartDate), parseISO(item.startDate));
  const endDeltaDays = differenceInCalendarDays(parseISO(nextEndDate), parseISO(item.endDate));
  return startDeltaDays === endDeltaDays ? startDeltaDays : 0;
}

function applyShiftedDates(item: ItemRecord, deltaDays: number, updatedAt: string): void {
  item.startDate = shiftDateText(item.startDate, deltaDays);
  item.endDate = shiftDateText(item.endDate, deltaDays);
  item.dueDate = shiftDateText(item.dueDate, deltaDays);
  item.durationDays = deriveDurationDays(item.startDate, item.endDate);
  item.isScheduled = Boolean(item.startDate && item.endDate);
  item.updatedAt = updatedAt;
}

function shiftDateText(value: string | null, deltaDays: number): string | null {
  if (!value || deltaDays === 0) {
    return value;
  }

  return formatDateOnly(addDays(parseISO(value), deltaDays));
}

function applyDependentShift(input: {
  itemsById: Map<string, ItemRecord>;
  projectItems: ItemRecord[];
  dependencies: DependencyRecord[];
  changedRootIds: string[];
  updatedAt: string;
}): void {
  const dependenciesByPredecessor = new Map<string, DependencyRecord[]>();
  for (const dependency of input.dependencies) {
    const bucket = dependenciesByPredecessor.get(dependency.predecessorItemId) ?? [];
    bucket.push(dependency);
    dependenciesByPredecessor.set(dependency.predecessorItemId, bucket);
  }

  const queue = [...new Set(input.changedRootIds)];
  while (queue.length > 0) {
    const predecessorId = queue.shift();
    if (!predecessorId) {
      continue;
    }

    const predecessor = input.itemsById.get(predecessorId);
    const predecessorEndDate = predecessor?.endDate ?? predecessor?.startDate;
    if (!predecessor || !predecessorEndDate) {
      continue;
    }

    for (const dependency of dependenciesByPredecessor.get(predecessorId) ?? []) {
      const successor = input.itemsById.get(dependency.successorItemId);
      if (!successor || !successor.startDate || !successor.endDate) {
        continue;
      }

      const earliestSuccessorStart = formatDateOnly(
        addWorkingDays(parseISO(predecessorEndDate), dependency.lagDays + 1)
      );
      const deltaDays = differenceInCalendarDays(
        parseISO(earliestSuccessorStart),
        parseISO(successor.startDate)
      );
      if (deltaDays <= 0) {
        continue;
      }

      const subtreeItems = collectSubtreeItems(input.projectItems, successor.id);
      for (const subtreeItem of subtreeItems) {
        const currentItem = input.itemsById.get(subtreeItem.id) ?? subtreeItem;
        applyShiftedDates(currentItem, deltaDays, input.updatedAt);
        input.itemsById.set(currentItem.id, currentItem);
        queue.push(currentItem.id);
      }
    }
  }
}
