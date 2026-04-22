import { describe, expect, it } from "vitest";
import { EXCEL_TASKS_SHEET_COLUMNS } from "../../domain/excel-contract";
import { exportWorkbookXlsx } from "./xlsx-writer";
import { buildProjectImportPreview } from "./project-workbook-import";
import type { DependencyRecord, ItemRecord, ProjectSummary } from "../../shared/contracts";

function makeProject(overrides: Partial<ProjectSummary> = {}): ProjectSummary {
  return {
    id: overrides.id ?? "prj-a",
    workspaceId: "ws-default",
    code: overrides.code ?? "PRJ-A",
    name: overrides.name ?? "案件A",
    description: "",
    ownerName: "",
    status: "not_started",
    priority: "medium",
    color: "#000000",
    startDate: null,
    endDate: null,
    targetDate: null,
    progressCached: 0,
    riskLevel: "low",
    archived: false,
    createdAt: "2026-04-22T00:00:00.000Z",
    updatedAt: "2026-04-22T00:00:00.000Z",
  };
}

function makeItem(overrides: Partial<ItemRecord> = {}): ItemRecord {
  return {
    id: overrides.id ?? "itm-existing",
    workspaceId: "ws-default",
    projectId: overrides.projectId ?? "prj-a",
    projectName: overrides.projectName ?? "案件A",
    parentId: null,
    wbsCode: "1",
    type: "task",
    title: overrides.title ?? "既存タスク",
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
    sortOrder: 1,
    isScheduled: false,
    isRecurring: false,
    archived: false,
    createdAt: "2026-04-22T00:00:00.000Z",
    updatedAt: "2026-04-22T00:00:00.000Z",
    completedAt: null,
    tags: [],
  };
}

function makeTaskRow(
  overrides: Partial<Record<(typeof EXCEL_TASKS_SHEET_COLUMNS)[number], string>> = {}
): Record<(typeof EXCEL_TASKS_SHEET_COLUMNS)[number], string> {
  return {
    RecordId: "",
    WorkspaceCode: "default",
    PortfolioCode: "",
    PortfolioName: "",
    ProjectCode: "PRJ-A",
    ProjectName: "案件A",
    ParentRecordId: "",
    WbsCode: "1",
    ItemType: "task",
    Title: "行",
    Status: "not_started",
    Priority: "medium",
    Assignee: "",
    StartDate: "",
    EndDate: "",
    DueDate: "",
    DurationDays: "1",
    PercentComplete: "0",
    DependsOn: "",
    Tags: "",
    EstimateHours: "0",
    ActualHours: "0",
    Note: "",
    SortOrder: "1",
    IsArchived: "FALSE",
    LastModifiedAt: "2026-04-22T00:00:00.000Z",
    ...overrides,
  };
}

function makeDependency(overrides: Partial<DependencyRecord> = {}): DependencyRecord {
  return {
    id: overrides.id ?? "dep-1",
    projectId: overrides.projectId ?? "prj-a",
    predecessorItemId: overrides.predecessorItemId ?? "itm-prev",
    successorItemId: overrides.successorItemId ?? "itm-existing",
    type: "finish_to_start",
    lagDays: overrides.lagDays ?? 0,
    createdAt: "2026-04-22T00:00:00.000Z",
    updatedAt: "2026-04-22T00:00:00.000Z",
  };
}

describe("buildProjectImportPreview", () => {
  it("classifies tasks sheet rows into new, update, and error", () => {
    const workbookBytes = exportWorkbookXlsx({
      sheets: [
        {
          name: "Dashboard",
          columns: ["Metric", "Value"],
          rows: [],
        },
        {
          name: "Tasks",
          columns: EXCEL_TASKS_SHEET_COLUMNS,
          rows: [
            makeTaskRow({
              RecordId: "itm-existing",
              ProjectCode: "PRJ-A",
              ProjectName: "案件A",
              Title: "更新対象",
            }),
            makeTaskRow({
              RecordId: "",
              ProjectCode: "PRJ-A",
              ProjectName: "案件A",
              Title: "新規追加",
            }),
            makeTaskRow({
              RecordId: "itm-missing",
              ProjectCode: "PRJ-A",
              ProjectName: "案件A",
              Title: "不正更新",
            }),
          ],
        },
        {
          name: "Gantt_View",
          columns: ["Title"],
          rows: [],
        },
        {
          name: "MasterData",
          columns: ["Category", "Code", "Label"],
          rows: [],
        },
      ],
    });

    const preview = buildProjectImportPreview({
      project: makeProject(),
      sourcePath: "C:/tmp/import.xlsx",
      workbookBytes,
      items: [makeItem()],
      projects: [makeProject(), makeProject({ id: "prj-b", code: "PRJ-B", name: "案件B" })],
      dependencies: [],
    });

    expect(preview.newCount).toBe(1);
    expect(preview.updateCount).toBe(1);
    expect(preview.errorCount).toBe(1);
    expect(preview.rows).toEqual([
      expect.objectContaining({
        rowNumber: 2,
        action: "update",
        title: "更新対象",
        issues: [],
        warnings: [],
      }),
      expect.objectContaining({
        rowNumber: 3,
        action: "new",
        title: "新規追加",
        issues: [],
        warnings: [],
      }),
      expect.objectContaining({
        rowNumber: 4,
        action: "error",
        title: "不正更新",
        message: "RecordId: not found",
        issues: [{ field: "RecordId", message: "not found" }],
        warnings: [],
      }),
    ]);
  });

  it("collects multiple field-level issues for one error row", () => {
    const workbookBytes = exportWorkbookXlsx({
      sheets: [
        {
          name: "Dashboard",
          columns: ["Metric", "Value"],
          rows: [],
        },
        {
          name: "Tasks",
          columns: EXCEL_TASKS_SHEET_COLUMNS,
          rows: [
            makeTaskRow({
              Title: "",
              Status: "bad_status",
              DueDate: "2026/04/22",
              PercentComplete: "250",
            }),
          ],
        },
        {
          name: "Gantt_View",
          columns: ["Title"],
          rows: [],
        },
        {
          name: "MasterData",
          columns: ["Category", "Code", "Label"],
          rows: [],
        },
      ],
    });

    const preview = buildProjectImportPreview({
      project: makeProject(),
      sourcePath: "C:/tmp/import.xlsx",
      workbookBytes,
      items: [makeItem()],
      projects: [makeProject()],
      dependencies: [],
    });

    expect(preview.errorCount).toBe(1);
    expect(preview.rows[0]).toEqual(
      expect.objectContaining({
        action: "error",
        message: "4 validation issues",
        issues: [
          { field: "Title", message: "required" },
          { field: "Status", message: "invalid value" },
          { field: "DueDate", message: "must use yyyy-mm-dd" },
          { field: "PercentComplete", message: "must be between 0 and 100" },
        ],
        warnings: [],
      })
    );
  });

  it("validates DependsOn tokens against current project items", () => {
    const workbookBytes = exportWorkbookXlsx({
      sheets: [
        {
          name: "Dashboard",
          columns: ["Metric", "Value"],
          rows: [],
        },
        {
          name: "Tasks",
          columns: EXCEL_TASKS_SHEET_COLUMNS,
          rows: [
            makeTaskRow({
              RecordId: "itm-existing",
              ProjectCode: "PRJ-A",
              ProjectName: "案件A",
              Title: "依存更新",
              DependsOn: "itm-prev,itm-existing+1,itm-other+2,itm-missing+3,bad token",
            }),
          ],
        },
        {
          name: "Gantt_View",
          columns: ["Title"],
          rows: [],
        },
        {
          name: "MasterData",
          columns: ["Category", "Code", "Label"],
          rows: [],
        },
      ],
    });

    const preview = buildProjectImportPreview({
      project: makeProject(),
      sourcePath: "C:/tmp/import.xlsx",
      workbookBytes,
      items: [
        makeItem(),
        makeItem({ id: "itm-prev", title: "前工程" }),
        makeItem({
          id: "itm-other",
          projectId: "prj-b",
          projectName: "案件B",
          title: "別案件タスク",
        }),
      ],
      projects: [makeProject(), makeProject({ id: "prj-b", code: "PRJ-B", name: "案件B" })],
      dependencies: [],
    });

    expect(preview.errorCount).toBe(1);
    expect(preview.rows[0]).toEqual(
      expect.objectContaining({
        action: "error",
        message: "4 validation issues",
        issues: [
          { field: "DependsOn", message: "cannot reference itself: itm-existing+1" },
          { field: "DependsOn", message: "must reference current project item: itm-other+2" },
          { field: "DependsOn", message: "reference not found: itm-missing+3" },
          { field: "DependsOn", message: "invalid token format: bad token" },
        ],
        warnings: [],
      })
    );
  });

  it("adds a warning when workbook LastModifiedAt is older than the existing item", () => {
    const workbookBytes = exportWorkbookXlsx({
      sheets: [
        {
          name: "Dashboard",
          columns: ["Metric", "Value"],
          rows: [],
        },
        {
          name: "Tasks",
          columns: EXCEL_TASKS_SHEET_COLUMNS,
          rows: [
            makeTaskRow({
              RecordId: "itm-existing",
              ProjectCode: "PRJ-A",
              ProjectName: "案件A",
              Title: "更新対象",
              LastModifiedAt: "2026-04-20T00:00:00.000Z",
            }),
          ],
        },
        {
          name: "Gantt_View",
          columns: ["Title"],
          rows: [],
        },
        {
          name: "MasterData",
          columns: ["Category", "Code", "Label"],
          rows: [],
        },
      ],
    });

    const preview = buildProjectImportPreview({
      project: makeProject(),
      sourcePath: "C:/tmp/import.xlsx",
      workbookBytes,
      items: [makeItem({ updatedAt: "2026-04-22T00:00:00.000Z" })],
      projects: [makeProject()],
      dependencies: [],
    });

    expect(preview.errorCount).toBe(0);
    expect(preview.updateCount).toBe(1);
    expect(preview.rows[0]).toEqual(
      expect.objectContaining({
        action: "update",
        issues: [],
        warnings: [{ field: "LastModifiedAt", message: "workbook row is older than current item" }],
      })
    );
  });

  it("adds a warning when imported DependsOn would create a dependency cycle", () => {
    const workbookBytes = exportWorkbookXlsx({
      sheets: [
        {
          name: "Dashboard",
          columns: ["Metric", "Value"],
          rows: [],
        },
        {
          name: "Tasks",
          columns: EXCEL_TASKS_SHEET_COLUMNS,
          rows: [
            makeTaskRow({
              RecordId: "itm-prev",
              ProjectCode: "PRJ-A",
              ProjectName: "案件A",
              Title: "先行タスク",
              DependsOn: "itm-existing",
            }),
          ],
        },
        {
          name: "Gantt_View",
          columns: ["Title"],
          rows: [],
        },
        {
          name: "MasterData",
          columns: ["Category", "Code", "Label"],
          rows: [],
        },
      ],
    });

    const preview = buildProjectImportPreview({
      project: makeProject(),
      sourcePath: "C:/tmp/import-cycle-warning.xlsx",
      workbookBytes,
      items: [
        makeItem({ id: "itm-prev", title: "先行タスク" }),
        makeItem({ id: "itm-existing", title: "後続タスク" }),
      ],
      projects: [makeProject()],
      dependencies: [makeDependency()],
    });

    expect(preview.errorCount).toBe(0);
    expect(preview.updateCount).toBe(1);
    expect(preview.rows[0]).toEqual(
      expect.objectContaining({
        action: "update",
        issues: [],
        warnings: [{ field: "DependsOn", message: "would create dependency cycle on apply: itm-existing" }],
      })
    );
  });
});
