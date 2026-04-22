import { describe, expect, it } from "vitest";
import { buildExcelWorkbookContract } from "../../domain/excel-contract";
import type { DependencyRecord, ItemRecord, ProjectSummary } from "../../shared/contracts";
import { readStoredZipEntries } from "../../test/zip-test-utils";
import { exportWorkbookXlsx } from "./xlsx-writer";

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

describe("exportWorkbookXlsx", () => {
  it("writes a valid xlsx zip with four sheets and canonical Tasks data", () => {
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

    const bytes = exportWorkbookXlsx(workbook);
    const entries = readStoredZipEntries(bytes);

    expect(Array.from(bytes.slice(0, 2))).toEqual([0x50, 0x4b]);
    expect(entries.has("[Content_Types].xml")).toBe(true);
    expect(entries.has("xl/workbook.xml")).toBe(true);
    expect(entries.has("xl/worksheets/sheet1.xml")).toBe(true);
    expect(entries.has("xl/worksheets/sheet2.xml")).toBe(true);
    expect(entries.has("xl/worksheets/sheet3.xml")).toBe(true);
    expect(entries.has("xl/worksheets/sheet4.xml")).toBe(true);

    expect(entries.get("xl/workbook.xml")).toContain('sheet name="Dashboard"');
    expect(entries.get("xl/workbook.xml")).toContain('sheet name="Tasks"');
    expect(entries.get("xl/workbook.xml")).toContain('sheet name="Gantt_View"');
    expect(entries.get("xl/workbook.xml")).toContain('sheet name="MasterData"');
    expect(entries.get("xl/worksheets/sheet2.xml")).toContain("RecordId");
    expect(entries.get("xl/worksheets/sheet2.xml")).toContain("DependsOn");
    expect(entries.get("xl/worksheets/sheet2.xml")).toContain("itm_101,itm_102+2");
    expect(entries.get("xl/worksheets/sheet3.xml")).toContain("基本設計");
    expect(entries.get("xl/worksheets/sheet4.xml")).toContain("Use ISO date format yyyy-mm-dd");
  });
});
