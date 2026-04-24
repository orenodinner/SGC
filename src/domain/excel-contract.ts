import type { AppSettings, DependencyRecord, ItemRecord, ProjectSummary } from "../shared/contracts";

export const EXCEL_WORKBOOK_SHEETS = [
  "Dashboard",
  "Tasks",
  "Gantt_View",
  "MasterData",
] as const;

export const EXCEL_TASKS_SHEET_COLUMNS = [
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
] as const;

export type ExcelWorkbookSheetName = (typeof EXCEL_WORKBOOK_SHEETS)[number];
export type ExcelTasksSheetColumn = (typeof EXCEL_TASKS_SHEET_COLUMNS)[number];

export interface ExcelTasksSheetRow {
  RecordId: string;
  WorkspaceCode: string;
  PortfolioCode: string;
  PortfolioName: string;
  ProjectCode: string;
  ProjectName: string;
  ParentRecordId: string;
  WbsCode: string;
  ItemType: ItemRecord["type"];
  Title: string;
  Status: ItemRecord["status"];
  Priority: ItemRecord["priority"];
  Assignee: string;
  StartDate: string;
  EndDate: string;
  DueDate: string;
  DurationDays: number;
  PercentComplete: number;
  DependsOn: string;
  Tags: string;
  EstimateHours: number;
  ActualHours: number;
  Note: string;
  SortOrder: number;
  IsArchived: "TRUE" | "FALSE";
  LastModifiedAt: string;
}

export interface ExcelSheetContract<Row = Record<string, unknown>> {
  name: ExcelWorkbookSheetName;
  columns: readonly string[];
  rows: Row[];
}

export interface ExcelWorkbookContract {
  sheets: [
    ExcelSheetContract<Record<string, string | number>>,
    ExcelSheetContract<ExcelTasksSheetRow>,
    ExcelSheetContract<Record<string, string | number>>,
    ExcelSheetContract<Record<string, string | number>>,
  ];
}

interface BuildExcelWorkbookContractInput {
  workspaceCode?: string;
  project: Pick<ProjectSummary, "code" | "name">;
  items: ItemRecord[];
  dependencies: DependencyRecord[];
  excelDefaults?: {
    priority: AppSettings["excelDefaultPriority"];
    assignee: AppSettings["excelDefaultAssignee"];
  };
}

export function serializeDependsOn(dependencies: DependencyRecord[]): string {
  return dependencies
    .map((dependency) => formatDependencyReference(dependency.predecessorItemId, dependency.lagDays))
    .join(",");
}

export function buildExcelWorkbookContract(
  input: BuildExcelWorkbookContractInput
): ExcelWorkbookContract {
  const dependenciesBySuccessor = new Map<string, DependencyRecord[]>();
  for (const dependency of input.dependencies) {
    const entries = dependenciesBySuccessor.get(dependency.successorItemId) ?? [];
    entries.push(dependency);
    dependenciesBySuccessor.set(dependency.successorItemId, entries);
  }

  const taskRows = input.items.map((item) =>
    buildTasksSheetRow({
      workspaceCode: input.workspaceCode ?? "default",
      projectCode: input.project.code,
      projectName: input.project.name,
      item,
      dependencies: dependenciesBySuccessor.get(item.id) ?? [],
    })
  );

  return {
    sheets: [
      {
        name: "Dashboard",
        columns: ["Metric", "Value"],
        rows: buildDashboardRows(input.project, input.items),
      },
      {
        name: "Tasks",
        columns: EXCEL_TASKS_SHEET_COLUMNS,
        rows: taskRows,
      },
      {
        name: "Gantt_View",
        columns: [
          "WbsCode",
          "Title",
          "Status",
          "StartDate",
          "EndDate",
          "Assignee",
          "PercentComplete",
          "DependsOn",
        ],
        rows: buildGanttRows(input.items, dependenciesBySuccessor),
      },
      {
        name: "MasterData",
        columns: ["Category", "Code", "Label"],
        rows: buildMasterDataRows(input.excelDefaults),
      },
    ],
  };
}

function buildDashboardRows(
  project: Pick<ProjectSummary, "code" | "name">,
  items: ItemRecord[]
): Array<Record<string, string | number>> {
  return [
    { Metric: "ProjectCode", Value: project.code },
    { Metric: "ProjectName", Value: project.name },
    { Metric: "ItemCount", Value: items.length },
    { Metric: "ScheduledCount", Value: items.filter((item) => item.isScheduled).length },
    { Metric: "MilestoneCount", Value: items.filter((item) => item.type === "milestone").length },
    {
      Metric: "CompletedCount",
      Value: items.filter((item) => item.status === "done").length,
    },
  ];
}

function buildGanttRows(
  items: ItemRecord[],
  dependenciesBySuccessor: Map<string, DependencyRecord[]>
): Array<Record<string, string | number>> {
  return items.map((item) => ({
    WbsCode: item.wbsCode,
    Title: item.title,
    Status: item.status,
    StartDate: item.startDate ?? "",
    EndDate: item.endDate ?? "",
    Assignee: item.assigneeName,
    PercentComplete: item.percentComplete,
    DependsOn: serializeDependsOn(dependenciesBySuccessor.get(item.id) ?? []),
  }));
}

function buildMasterDataRows(
  excelDefaults?: BuildExcelWorkbookContractInput["excelDefaults"]
): Array<Record<string, string | number>> {
  const rows = [
    { Category: "ItemType", Code: "group", Label: "group" },
    { Category: "ItemType", Code: "task", Label: "task" },
    { Category: "ItemType", Code: "milestone", Label: "milestone" },
    { Category: "Status", Code: "not_started", Label: "not_started" },
    { Category: "Status", Code: "in_progress", Label: "in_progress" },
    { Category: "Status", Code: "blocked", Label: "blocked" },
    { Category: "Status", Code: "done", Label: "done" },
    { Category: "Status", Code: "archived", Label: "archived" },
    { Category: "Priority", Code: "low", Label: "low" },
    { Category: "Priority", Code: "medium", Label: "medium" },
    { Category: "Priority", Code: "high", Label: "high" },
    { Category: "Priority", Code: "critical", Label: "critical" },
    { Category: "Hint", Code: "DependsOn", Label: "itm_101,itm_102+2" },
    { Category: "Hint", Code: "Dates", Label: "Use ISO date format yyyy-mm-dd" },
  ];

  if (excelDefaults) {
    rows.push(
      { Category: "Default", Code: "Priority", Label: excelDefaults.priority },
      { Category: "Default", Code: "Assignee", Label: excelDefaults.assignee }
    );
  }

  return rows;
}

function buildTasksSheetRow(input: {
  workspaceCode: string;
  projectCode: string;
  projectName: string;
  item: ItemRecord;
  dependencies: DependencyRecord[];
}): ExcelTasksSheetRow {
  const { item } = input;

  return {
    RecordId: item.id,
    WorkspaceCode: input.workspaceCode,
    PortfolioCode: "",
    PortfolioName: "",
    ProjectCode: input.projectCode,
    ProjectName: input.projectName,
    ParentRecordId: item.parentId ?? "",
    WbsCode: item.wbsCode,
    ItemType: item.type,
    Title: item.title,
    Status: item.status,
    Priority: item.priority,
    Assignee: item.assigneeName,
    StartDate: item.startDate ?? "",
    EndDate: item.endDate ?? "",
    DueDate: item.dueDate ?? "",
    DurationDays: item.durationDays,
    PercentComplete: item.percentComplete,
    DependsOn: serializeDependsOn(input.dependencies),
    Tags: item.tags.join(","),
    EstimateHours: item.estimateHours,
    ActualHours: item.actualHours,
    Note: item.note,
    SortOrder: item.sortOrder,
    IsArchived: item.archived ? "TRUE" : "FALSE",
    LastModifiedAt: item.updatedAt,
  };
}

function formatDependencyReference(predecessorItemId: string, lagDays: number): string {
  if (lagDays === 0) {
    return predecessorItemId;
  }

  if (lagDays > 0) {
    return `${predecessorItemId}+${lagDays}`;
  }

  return `${predecessorItemId}${lagDays}`;
}
