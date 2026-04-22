import { buildExcelWorkbookContract } from "../../domain/excel-contract";
import type { DependencyRecord, ItemRecord, ProjectSummary } from "../../shared/contracts";
import { exportWorkbookXlsx } from "./xlsx-writer";

export function exportProjectWorkbookXlsx(input: {
  project: ProjectSummary;
  items: ItemRecord[];
  dependencies: DependencyRecord[];
}): Uint8Array {
  const workbook = buildExcelWorkbookContract({
    project: input.project,
    items: input.items,
    dependencies: input.dependencies,
  });

  return exportWorkbookXlsx(workbook);
}
