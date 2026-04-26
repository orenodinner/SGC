import type { ExcelStyledCell, ExcelWorkbookContract } from "../../domain/excel-contract";
import type { RoadmapScale } from "../../domain/roadmap";
import type { ItemRecord } from "../../shared/contracts";
import { exportWorkbookXlsx } from "./xlsx-writer";

export interface RoadmapWorkbookBucket {
  key: string;
  label: string;
  yearLabel: string;
  quarterLabel: string;
}

export interface RoadmapWorkbookRow {
  kind: "project" | "item";
  title: string;
  subtitle: string;
  projectCode: string;
  projectName: string;
  depth: number;
  itemType: ItemRecord["type"];
  status: ItemRecord["status"];
  assigneeName: string;
  startDate: string;
  endDate: string;
  percentComplete: number;
  startColumn: number | null;
  endColumn: number | null;
  isMilestone: boolean;
}

export interface RoadmapWorkbookExportInput {
  scale: RoadmapScale;
  anchorYear: number;
  yearSpan: number;
  rangeLabel: string;
  generatedAt: string;
  buckets: RoadmapWorkbookBucket[];
  rows: RoadmapWorkbookRow[];
}

export function exportRoadmapWorkbookXlsx(input: RoadmapWorkbookExportInput): Uint8Array {
  return exportWorkbookXlsx(buildRoadmapWorkbookContract(input));
}

export function buildRoadmapWorkbookContract(input: RoadmapWorkbookExportInput): ExcelWorkbookContract {
  const monthColumns = input.buckets.map((bucket) => bucket.label);
  const ganttColumns = [
    "Project",
    "WBS/Code",
    "Kind",
    "Type",
    "Title",
    "Assignee",
    "Status",
    "Start",
    "End",
    "Progress",
    ...monthColumns,
  ];

  return {
    sheets: [
      {
        name: "Roadmap_Gantt",
        columns: ganttColumns,
        rows: input.rows.map((row) => buildRoadmapGanttRow(row, input.buckets)),
        columnWidths: buildRoadmapColumnWidths(ganttColumns, monthColumns),
      },
      {
        name: "Roadmap_Data",
        columns: ["Metric", "Value"],
        rows: [
          { Metric: "Scale", Value: input.scale },
          { Metric: "AnchorYear", Value: input.anchorYear },
          { Metric: "YearSpan", Value: input.yearSpan },
          { Metric: "Range", Value: input.rangeLabel },
          { Metric: "GeneratedAt", Value: input.generatedAt },
          { Metric: "RowCount", Value: input.rows.length },
          { Metric: "MonthCount", Value: input.buckets.length },
        ],
        columnWidths: {
          Metric: 18,
          Value: 44,
        },
      },
    ],
  };
}

function buildRoadmapGanttRow(
  row: RoadmapWorkbookRow,
  buckets: RoadmapWorkbookBucket[]
): Record<string, string | number | ExcelStyledCell> {
  const output: Record<string, string | number | ExcelStyledCell> = {
    Project: row.projectName,
    "WBS/Code": row.subtitle,
    Kind: row.kind,
    Type: row.itemType,
    Title: `${"  ".repeat(row.depth)}${row.title}`,
    Assignee: row.assigneeName,
    Status: row.status,
    Start: row.startDate,
    End: row.endDate,
    Progress: row.percentComplete,
  };

  for (const [index, bucket] of buckets.entries()) {
    output[bucket.label] = buildRoadmapMonthCell(row, index);
  }

  return output;
}

function buildRoadmapMonthCell(row: RoadmapWorkbookRow, bucketIndex: number): string | ExcelStyledCell {
  if (row.startColumn === null || row.endColumn === null) {
    return "";
  }

  if (bucketIndex < row.startColumn || bucketIndex > row.endColumn) {
    return "";
  }

  if (row.isMilestone) {
    return bucketIndex === row.startColumn
      ? { value: "◆", style: "milestone" }
      : "";
  }

  return {
    value: "",
    style:
      row.status === "done"
        ? "doneBar"
        : row.kind === "project"
          ? "projectBar"
          : "taskBar",
  };
}

function buildRoadmapColumnWidths(
  columns: readonly string[],
  monthColumns: readonly string[]
): Partial<Record<string, number>> {
  const widths: Partial<Record<string, number>> = {
    Project: 22,
    "WBS/Code": 12,
    Kind: 10,
    Type: 12,
    Title: 34,
    Assignee: 14,
    Status: 14,
    Start: 12,
    End: 12,
    Progress: 10,
  };

  for (const column of monthColumns) {
    widths[column] = 6;
  }

  return Object.fromEntries(columns.map((column) => [column, widths[column] ?? 12]));
}
