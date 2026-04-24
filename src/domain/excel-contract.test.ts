import { describe, expect, it } from "vitest";
import type { DependencyRecord, ItemRecord, ProjectSummary } from "../shared/contracts";
import {
  buildExcelWorkbookContract,
  EXCEL_TASKS_SHEET_COLUMNS,
  EXCEL_WORKBOOK_SHEETS,
  serializeDependsOn,
} from "./excel-contract";

function makeProject(overrides: Partial<ProjectSummary> = {}): ProjectSummary {
  return {
    id: overrides.id ?? "prj-1",
    workspaceId: "ws-default",
    code: overrides.code ?? "PRJ-A",
    name: overrides.name ?? "案件A",
    description: "",
    ownerName: "",
    status: overrides.status ?? "not_started",
    priority: overrides.priority ?? "medium",
    color: "#000000",
    startDate: overrides.startDate ?? null,
    endDate: overrides.endDate ?? null,
    targetDate: overrides.targetDate ?? null,
    progressCached: overrides.progressCached ?? 0,
    riskLevel: overrides.riskLevel ?? "low",
    archived: overrides.archived ?? false,
    createdAt: "2026-04-22T00:00:00.000Z",
    updatedAt: "2026-04-22T00:00:00.000Z",
  };
}

function makeItem(overrides: Partial<ItemRecord> = {}): ItemRecord {
  return {
    id: overrides.id ?? "itm-1",
    workspaceId: "ws-default",
    projectId: overrides.projectId ?? "prj-1",
    projectName: overrides.projectName ?? "案件A",
    parentId: overrides.parentId ?? null,
    wbsCode: overrides.wbsCode ?? "1",
    type: overrides.type ?? "task",
    title: overrides.title ?? "基本設計",
    note: overrides.note ?? "",
    status: overrides.status ?? "in_progress",
    priority: overrides.priority ?? "high",
    assigneeName: overrides.assigneeName ?? "田中",
    startDate: overrides.startDate ?? "2026-04-01",
    endDate: overrides.endDate ?? "2026-04-10",
    dueDate: overrides.dueDate ?? "2026-04-10",
    durationDays: overrides.durationDays ?? 7,
    percentComplete: overrides.percentComplete ?? 40,
    estimateHours: overrides.estimateHours ?? 16,
    actualHours: overrides.actualHours ?? 8,
    sortOrder: overrides.sortOrder ?? 120,
    isScheduled: overrides.isScheduled ?? true,
    isRecurring: overrides.isRecurring ?? false,
    archived: overrides.archived ?? false,
    createdAt: "2026-04-22T00:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-04-22T10:00:00.000Z",
    completedAt: overrides.completedAt ?? null,
    tags: overrides.tags ?? ["設計", "重要"],
  };
}

function makeDependency(overrides: Partial<DependencyRecord> = {}): DependencyRecord {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    projectId: overrides.projectId ?? "prj-1",
    predecessorItemId: overrides.predecessorItemId ?? "itm_101",
    successorItemId: overrides.successorItemId ?? "itm-1",
    type: "finish_to_start",
    lagDays: overrides.lagDays ?? 0,
    createdAt: "2026-04-22T00:00:00.000Z",
    updatedAt: "2026-04-22T00:00:00.000Z",
  };
}

describe("Excel workbook contract", () => {
  it("keeps the canonical workbook sheet order", () => {
    expect(EXCEL_WORKBOOK_SHEETS).toEqual([
      "Dashboard",
      "Tasks",
      "Gantt_View",
      "MasterData",
    ]);
  });

  it("keeps the canonical Tasks header order", () => {
    expect(EXCEL_TASKS_SHEET_COLUMNS).toEqual([
      "RecordId",
      "WorkspaceCode",
      "PortfolioCode",
      "PortfolioName",
      "ProjectCode",
      "ProjectName",
      "ParentRecordId",
      "WbsCode",
      "ItemType",
      "Title",
      "Status",
      "Priority",
      "Assignee",
      "StartDate",
      "EndDate",
      "DueDate",
      "DurationDays",
      "PercentComplete",
      "DependsOn",
      "Tags",
      "EstimateHours",
      "ActualHours",
      "Note",
      "SortOrder",
      "IsArchived",
      "LastModifiedAt",
    ]);
  });

  it("serializes dependency references with zero, positive, and negative lag", () => {
    const value = serializeDependsOn([
      makeDependency({
        predecessorItemId: "itm_101",
        lagDays: 0,
      }),
      makeDependency({
        predecessorItemId: "itm_102",
        lagDays: 2,
      }),
      makeDependency({
        predecessorItemId: "itm_103",
        lagDays: -1,
      }),
    ]);

    expect(value).toBe("itm_101,itm_102+2,itm_103-1");
  });

  it("builds a Tasks row that matches the canonical export contract", () => {
    const workbook = buildExcelWorkbookContract({
      project: makeProject(),
      items: [makeItem()],
      dependencies: [
        makeDependency({
          predecessorItemId: "itm_101",
          lagDays: 0,
        }),
        makeDependency({
          predecessorItemId: "itm_102",
          lagDays: 2,
        }),
      ],
    });

    expect(workbook.sheets.map((sheet) => sheet.name)).toEqual([
      "Dashboard",
      "Tasks",
      "Gantt_View",
      "MasterData",
    ]);

    expect(workbook.sheets[1]).toMatchObject({
      name: "Tasks",
      columns: EXCEL_TASKS_SHEET_COLUMNS,
    });
    expect(workbook.sheets[1].rows[0]).toEqual({
      RecordId: "itm-1",
      WorkspaceCode: "default",
      PortfolioCode: "",
      PortfolioName: "",
      ProjectCode: "PRJ-A",
      ProjectName: "案件A",
      ParentRecordId: "",
      WbsCode: "1",
      ItemType: "task",
      Title: "基本設計",
      Status: "in_progress",
      Priority: "high",
      Assignee: "田中",
      StartDate: "2026-04-01",
      EndDate: "2026-04-10",
      DueDate: "2026-04-10",
      DurationDays: 7,
      PercentComplete: 40,
      DependsOn: "itm_101,itm_102+2",
      Tags: "設計,重要",
      EstimateHours: 16,
      ActualHours: 8,
      Note: "",
      SortOrder: 120,
      IsArchived: "FALSE",
      LastModifiedAt: "2026-04-22T10:00:00.000Z",
    });
  });

  it("adds Excel default hints to MasterData rows when settings are provided", () => {
    const workbook = buildExcelWorkbookContract({
      project: makeProject(),
      items: [makeItem()],
      dependencies: [],
      excelDefaults: {
        priority: "critical",
        assignee: "佐藤",
      },
    });

    expect(workbook.sheets[3].rows).toEqual(
      expect.arrayContaining([
        { Category: "Default", Code: "Priority", Label: "critical" },
        { Category: "Default", Code: "Assignee", Label: "佐藤" },
      ])
    );
  });
});
