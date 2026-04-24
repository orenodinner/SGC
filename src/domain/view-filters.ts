import type { AppLanguage, ItemRecord, Priority, ProjectSummary } from "../shared/contracts";

export interface SearchFilterState {
  keyword: string;
  projectId: string;
  portfolioText: string;
  status: ItemRecord["status"] | "";
  priority: Priority | "";
  tagText: string;
  assigneeText: string;
  overdueOnly: boolean;
  milestoneOnly: boolean;
  roadmapOnly: boolean;
}

export interface SearchFilterChip {
  key: string;
  label: string;
}

export function createEmptySearchFilterState(): SearchFilterState {
  return {
    keyword: "",
    projectId: "",
    portfolioText: "",
    status: "",
    priority: "",
    tagText: "",
    assigneeText: "",
    overdueOnly: false,
    milestoneOnly: false,
    roadmapOnly: false,
  };
}

export function buildSearchFilterChips(
  filter: SearchFilterState,
  projects: Array<Pick<ProjectSummary, "id" | "name" | "code">>,
  language: AppLanguage = "ja"
): SearchFilterChip[] {
  const chips: SearchFilterChip[] = [];
  const labels =
    language === "ja"
      ? {
          keyword: "全文",
          project: "Project",
          portfolio: "Portfolio",
          status: "状態",
          priority: "優先度",
          tag: "タグ",
          assignee: "担当",
          overdueOnly: "期限超過のみ",
          milestoneOnly: "マイルストーンのみ",
          roadmapOnly: "年間表示対象のみ",
        }
      : {
          keyword: "Keyword",
          project: "Project",
          portfolio: "Portfolio",
          status: "Status",
          priority: "Priority",
          tag: "Tag",
          assignee: "Assignee",
          overdueOnly: "Overdue only",
          milestoneOnly: "Milestones only",
          roadmapOnly: "Roadmap-eligible only",
        };
  if (filter.keyword) {
    chips.push({ key: "keyword", label: `${labels.keyword}: ${filter.keyword}` });
  }
  if (filter.projectId) {
    const project = projects.find((entry) => entry.id === filter.projectId);
    chips.push({
      key: "projectId",
      label: `${labels.project}: ${project ? `${project.code} ${project.name}` : filter.projectId}`,
    });
  }
  if (filter.portfolioText) {
    chips.push({ key: "portfolioText", label: `${labels.portfolio}: ${filter.portfolioText}` });
  }
  if (filter.status) {
    chips.push({ key: "status", label: `${labels.status}: ${filter.status}` });
  }
  if (filter.priority) {
    chips.push({ key: "priority", label: `${labels.priority}: ${filter.priority}` });
  }
  if (filter.tagText) {
    chips.push({ key: "tagText", label: `${labels.tag}: ${filter.tagText}` });
  }
  if (filter.assigneeText) {
    chips.push({ key: "assigneeText", label: `${labels.assignee}: ${filter.assigneeText}` });
  }
  if (filter.overdueOnly) {
    chips.push({ key: "overdueOnly", label: labels.overdueOnly });
  }
  if (filter.milestoneOnly) {
    chips.push({ key: "milestoneOnly", label: labels.milestoneOnly });
  }
  if (filter.roadmapOnly) {
    chips.push({ key: "roadmapOnly", label: labels.roadmapOnly });
  }
  return chips;
}

export function hasActiveSearchFilters(filter: SearchFilterState): boolean {
  return buildSearchFilterChips(filter, []).length > 0;
}

export function itemMatchesSearchFilter(input: {
  item: ItemRecord;
  project: Pick<ProjectSummary, "id" | "name" | "code" | "portfolioId"> | null;
  filter: SearchFilterState;
  todayText?: string;
}): boolean {
  const { item, project, filter } = input;
  const keyword = normalizeFilterText(filter.keyword);
  const tagText = normalizeFilterText(filter.tagText);
  const assigneeText = normalizeFilterText(filter.assigneeText);
  const portfolioText = normalizeFilterText(filter.portfolioText);

  if (keyword) {
    const haystacks = [
      item.title,
      item.note,
      item.projectName ?? "",
      project?.name ?? "",
      project?.code ?? "",
    ];
    if (!haystacks.some((value) => normalizeFilterText(value).includes(keyword))) {
      return false;
    }
  }

  if (filter.projectId && item.projectId !== filter.projectId) {
    return false;
  }

  if (portfolioText && !normalizeFilterText(project?.portfolioId ?? "").includes(portfolioText)) {
    return false;
  }

  if (filter.status && item.status !== filter.status) {
    return false;
  }

  if (filter.priority && item.priority !== filter.priority) {
    return false;
  }

  if (tagText) {
    const matchesTag = item.tags.some((tag) => normalizeFilterText(tag).includes(tagText));
    if (!matchesTag) {
      return false;
    }
  }

  if (assigneeText && !normalizeFilterText(item.assigneeName).includes(assigneeText)) {
    return false;
  }

  if (filter.overdueOnly && !isOverdueItem(item, input.todayText)) {
    return false;
  }

  if (filter.milestoneOnly && item.type !== "milestone") {
    return false;
  }

  if (filter.roadmapOnly && !isRoadmapEligibleItem(item)) {
    return false;
  }

  return true;
}

export function projectMatchesSearchFilter(input: {
  project: Pick<
    ProjectSummary,
    "id" | "name" | "code" | "description" | "ownerName" | "portfolioId" | "status" | "priority" | "startDate" | "endDate" | "targetDate"
  >;
  detailItems: ItemRecord[];
  filter: SearchFilterState;
  todayText?: string;
}): boolean {
  const { project, detailItems, filter } = input;
  const keyword = normalizeFilterText(filter.keyword);
  const assigneeText = normalizeFilterText(filter.assigneeText);
  const tagText = normalizeFilterText(filter.tagText);
  const portfolioText = normalizeFilterText(filter.portfolioText);

  if (keyword) {
    const projectMatchesKeyword = [
      project.name,
      project.code,
      project.description,
      project.ownerName,
    ].some((value) => normalizeFilterText(value).includes(keyword));
    const itemMatchesKeyword = detailItems.some((item) =>
      itemMatchesSearchFilter({
        item,
        project,
        filter: {
          ...createEmptySearchFilterState(),
          keyword: filter.keyword,
        },
        todayText: input.todayText,
      })
    );
    if (!projectMatchesKeyword && !itemMatchesKeyword) {
      return false;
    }
  }

  if (filter.projectId && project.id !== filter.projectId) {
    return false;
  }

  if (portfolioText && !normalizeFilterText(project.portfolioId ?? "").includes(portfolioText)) {
    return false;
  }

  if (filter.status && project.status !== filter.status) {
    return false;
  }

  if (filter.priority && project.priority !== filter.priority) {
    return false;
  }

  if (tagText) {
    const matchesTag = detailItems.some((item) =>
      item.tags.some((tag) => normalizeFilterText(tag).includes(tagText))
    );
    if (!matchesTag) {
      return false;
    }
  }

  if (assigneeText) {
    const projectMatchesAssignee = normalizeFilterText(project.ownerName).includes(assigneeText);
    const itemMatchesAssignee = detailItems.some((item) =>
      normalizeFilterText(item.assigneeName).includes(assigneeText)
    );
    if (!projectMatchesAssignee && !itemMatchesAssignee) {
      return false;
    }
  }

  if (filter.overdueOnly) {
    const hasOverdueItem = detailItems.some((item) => isOverdueItem(item, input.todayText));
    if (!hasOverdueItem) {
      return false;
    }
  }

  if (filter.milestoneOnly) {
    const hasMilestone = detailItems.some((item) => item.type === "milestone");
    if (!hasMilestone) {
      return false;
    }
  }

  if (filter.roadmapOnly) {
    const projectEligible =
      Boolean(project.startDate) || Boolean(project.endDate) || Boolean(project.targetDate);
    const itemEligible = detailItems.some((item) => isRoadmapEligibleItem(item));
    if (!projectEligible && !itemEligible) {
      return false;
    }
  }

  return true;
}

export function isRoadmapEligibleItem(item: Pick<ItemRecord, "startDate" | "endDate" | "dueDate">): boolean {
  return Boolean(item.startDate || item.endDate || item.dueDate);
}

export function isOverdueItem(
  item: Pick<ItemRecord, "status" | "startDate" | "endDate" | "dueDate">,
  todayText = getTodayDateText()
): boolean {
  if (item.status === "done" || item.status === "archived") {
    return false;
  }

  const effectiveDate = item.endDate ?? item.startDate ?? item.dueDate;
  if (!effectiveDate) {
    return false;
  }

  return normalizeDateText(effectiveDate) < todayText;
}

function normalizeFilterText(value: string): string {
  return value.trim().toLocaleLowerCase("ja-JP");
}

function normalizeDateText(value: string): string {
  return value.slice(0, 10);
}

function getTodayDateText(): string {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
