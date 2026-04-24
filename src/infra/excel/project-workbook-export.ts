import { buildExcelWorkbookContract } from "../../domain/excel-contract";
import type { AppSettings, DependencyRecord, ItemRecord, ProjectSummary } from "../../shared/contracts";
import { exportWorkbookXlsx } from "./xlsx-writer";

export function exportProjectWorkbookXlsx(input: {
  project: ProjectSummary;
  items: ItemRecord[];
  dependencies: DependencyRecord[];
  excelDefaults?: {
    priority: AppSettings["excelDefaultPriority"];
    assignee: AppSettings["excelDefaultAssignee"];
  };
}): Uint8Array {
  const workbook = buildExcelWorkbookContract({
    project: input.project,
    items: input.items,
    dependencies: input.dependencies,
    excelDefaults: input.excelDefaults,
  });

  return exportWorkbookXlsx(workbook);
}
