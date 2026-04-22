import {
  EXCEL_TASKS_SHEET_COLUMNS,
  type ExcelWorkbookContract,
  type ExcelTasksSheetRow,
} from "../domain/excel-contract";
import { parseProjectImportTasksRows } from "../infra/excel/project-workbook-import";
import { exportWorkbookXlsx } from "../infra/excel/xlsx-writer";

export type RoundTripTasksSheetRow = Record<
  (typeof EXCEL_TASKS_SHEET_COLUMNS)[number],
  string
>;

export function buildRoundTripWorkbookFixture(input: {
  exportedWorkbookBytes: Uint8Array;
  mutateRows?: (rows: RoundTripTasksSheetRow[]) => RoundTripTasksSheetRow[];
}): Uint8Array {
  const baseRows = parseProjectImportTasksRows(input.exportedWorkbookBytes).map((row) => ({
    ...row,
  }));
  const mutatedRows = input.mutateRows ? input.mutateRows(baseRows) : baseRows;

  const workbook: ExcelWorkbookContract = {
    sheets: [
      {
        name: "Dashboard",
        columns: ["Metric", "Value"],
        rows: [],
      },
      {
        name: "Tasks",
        columns: EXCEL_TASKS_SHEET_COLUMNS,
        rows: mutatedRows.map(toWorkbookTaskRow),
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
  };

  return exportWorkbookXlsx(workbook);
}

function toWorkbookTaskRow(row: RoundTripTasksSheetRow): ExcelTasksSheetRow {
  return {
    ...row,
    ItemType: row.ItemType as ExcelTasksSheetRow["ItemType"],
    Status: row.Status as ExcelTasksSheetRow["Status"],
    Priority: row.Priority as ExcelTasksSheetRow["Priority"],
    DurationDays: Number(row.DurationDays || "0"),
    PercentComplete: Number(row.PercentComplete || "0"),
    EstimateHours: Number(row.EstimateHours || "0"),
    ActualHours: Number(row.ActualHours || "0"),
    SortOrder: Number(row.SortOrder || "0"),
    IsArchived: row.IsArchived === "TRUE" ? "TRUE" : "FALSE",
  };
}
