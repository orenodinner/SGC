import { describe, expect, it } from "vitest";
import {
  buildSearchFilterChips,
  createEmptySearchFilterState,
  itemMatchesSearchFilter,
  projectMatchesSearchFilter,
} from "./view-filters";
import type { ItemRecord, ProjectSummary } from "../shared/contracts";

function buildProject(overrides: Partial<ProjectSummary> = {}): ProjectSummary {
  return {
    id: "prj-1",
    workspaceId: "ws-default",
    portfolioId: null,
    code: "PRJ-1",
    name: "案件A",
    description: "",
    ownerName: "田中",
    status: "in_progress",
    priority: "medium",
    color: "",
    startDate: null,
    endDate: null,
    targetDate: null,
    progressCached: 0,
    riskLevel: "normal",
    archived: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function buildItem(overrides: Partial<ItemRecord> = {}): ItemRecord {
  return {
    id: "itm-1",
    workspaceId: "ws-default",
    projectId: "prj-1",
    projectName: "案件A",
    parentId: null,
    wbsCode: "1",
    type: "task",
    title: "要件整理",
    note: "顧客メモあり",
    status: "in_progress",
    priority: "high",
    assigneeName: "佐藤",
    startDate: "2026-05-01",
    endDate: "2026-05-03",
    dueDate: null,
    durationDays: 3,
    percentComplete: 20,
    estimateHours: 8,
    actualHours: 1,
    sortOrder: 1,
    isScheduled: true,
    isRecurring: false,
    archived: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    completedAt: null,
    tags: ["営業", "重要"],
    ...overrides,
  };
}

describe("view filters", () => {
  it("matches item filters across keyword, portfolio, tag, assignee, and roadmap eligibility", () => {
    const filter = {
      ...createEmptySearchFilterState(),
      keyword: "顧客",
      portfolioText: "pf-east",
      tagText: "営業",
      assigneeText: "佐藤",
      roadmapOnly: true,
    };
    const project = buildProject({ portfolioId: "pf-east" });
    const item = buildItem();

    expect(itemMatchesSearchFilter({ item, project, filter, todayText: "2026-05-02" })).toBe(true);
    expect(
      itemMatchesSearchFilter({
        item: buildItem({ assigneeName: "別担当" }),
        project,
        filter,
        todayText: "2026-05-02",
      })
    ).toBe(false);
  });

  it("matches project filters using project fields and descendant item fields", () => {
    const filter = {
      ...createEmptySearchFilterState(),
      portfolioText: "pf-a",
      tagText: "重要",
      overdueOnly: true,
      milestoneOnly: true,
      roadmapOnly: true,
    };
    const project = buildProject({
      portfolioId: "pf-a",
      startDate: "2026-05-01",
      endDate: "2026-05-31",
    });
    const detailItems = [
      buildItem({
        type: "milestone",
        endDate: "2026-04-01",
        startDate: "2026-04-01",
        tags: ["重要"],
        status: "in_progress",
      }),
    ];

    expect(projectMatchesSearchFilter({ project, detailItems, filter, todayText: "2026-04-10" })).toBe(true);
    expect(
      projectMatchesSearchFilter({
        project: buildProject({ portfolioId: "pf-b" }),
        detailItems,
        filter,
        todayText: "2026-04-10",
      })
    ).toBe(false);
  });

  it("builds active chips for non-default filter values", () => {
    const filter = {
      ...createEmptySearchFilterState(),
      keyword: "重要",
      projectId: "prj-1",
      overdueOnly: true,
      roadmapOnly: true,
    };

    expect(buildSearchFilterChips(filter, [buildProject()])).toEqual([
      { key: "keyword", label: "全文: 重要" },
      { key: "projectId", label: "Project: PRJ-1 案件A" },
      { key: "overdueOnly", label: "期限超過のみ" },
      { key: "roadmapOnly", label: "年間表示対象のみ" },
    ]);
  });

  it("builds active chips in English when requested", () => {
    const filter = {
      ...createEmptySearchFilterState(),
      keyword: "important",
      projectId: "prj-1",
      priority: "high" as const,
      overdueOnly: true,
    };

    expect(buildSearchFilterChips(filter, [buildProject()], "en")).toEqual([
      { key: "keyword", label: "Keyword: important" },
      { key: "projectId", label: "Project: PRJ-1 案件A" },
      { key: "priority", label: "Priority: high" },
      { key: "overdueOnly", label: "Overdue only" },
    ]);
  });
});
