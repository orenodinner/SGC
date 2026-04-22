import { EXCEL_TASKS_SHEET_COLUMNS } from "../../domain/excel-contract";
import { wouldCreateDependencyCycle } from "../../domain/dependency-graph";
import {
  itemStatusSchema,
  itemTypeSchema,
  prioritySchema,
  type DependencyRecord,
  projectImportPreviewSchema,
  type ItemRecord,
  type ProjectImportPreview,
  type ProjectImportPreviewIssue,
  type ProjectImportPreviewRow,
  type ProjectImportPreviewWarning,
  type ProjectSummary,
} from "../../shared/contracts";
import { readZipEntries } from "./zip";

type TasksSheetRow = Record<(typeof EXCEL_TASKS_SHEET_COLUMNS)[number], string>;

export function buildProjectImportPreview(input: {
  project: ProjectSummary;
  sourcePath: string | null;
  workbookBytes: Uint8Array;
  items: ItemRecord[];
  projects: ProjectSummary[];
  dependencies: DependencyRecord[];
}): ProjectImportPreview {
  const rows = parseProjectImportTasksRows(input.workbookBytes);
  const existingItems = new Map(input.items.map((item) => [item.id, item]));
  const projectsByCode = new Map(input.projects.map((project) => [project.code, project]));
  const projectsByName = new Map(input.projects.map((project) => [project.name, project]));
  const currentProjectExistingIds = new Set(
    input.items
      .filter((item) => item.projectId === input.project.id)
      .map((item) => item.id)
  );
  const workbookRecordIds = new Set(
    rows
      .map((row) => row.RecordId.trim())
      .filter((recordId) => {
        const item = existingItems.get(recordId);
        return Boolean(recordId && item && item.projectId === input.project.id);
      })
  );
  const workbookTemporaryIds = collectWorkbookTemporaryIds(rows, existingItems);

  const previewRows = rows.map((row, index) =>
    classifyImportRow({
      project: input.project,
      row,
      rowNumber: index + 2,
      existingItems,
      projectsByCode,
      projectsByName,
      currentProjectExistingIds,
      workbookRecordIds,
      workbookTemporaryRecordIds: workbookTemporaryIds.availableIds,
      duplicateWorkbookTemporaryRecordIds: workbookTemporaryIds.duplicateIds,
      currentProjectDependencies: input.dependencies,
    })
  );

  return projectImportPreviewSchema.parse({
    sourcePath: input.sourcePath,
    newCount: previewRows.filter((row) => row.action === "new").length,
    updateCount: previewRows.filter((row) => row.action === "update").length,
    errorCount: previewRows.filter((row) => row.action === "error").length,
    rows: previewRows,
  });
}

function classifyImportRow(input: {
  project: ProjectSummary;
  row: TasksSheetRow;
  rowNumber: number;
  existingItems: Map<string, ItemRecord>;
  projectsByCode: Map<string, ProjectSummary>;
  projectsByName: Map<string, ProjectSummary>;
  currentProjectExistingIds: Set<string>;
  workbookRecordIds: Set<string>;
  workbookTemporaryRecordIds: Set<string>;
  duplicateWorkbookTemporaryRecordIds: Set<string>;
  currentProjectDependencies: DependencyRecord[];
}): ProjectImportPreviewRow {
  const row = input.row;
  const recordId = row.RecordId.trim();
  const projectCode = row.ProjectCode.trim();
  const projectName = row.ProjectName.trim();
  const title = row.Title.trim();
  const parentRecordId = row.ParentRecordId.trim();
  const itemType = row.ItemType.trim();
  const percentValue = row.PercentComplete.trim();
  const issues: ProjectImportPreviewIssue[] = [];
  const warnings: ProjectImportPreviewWarning[] = [];
  const isTemporaryRecordId =
    isWorkbookTemporaryRecordId(recordId) && !input.existingItems.has(recordId);

  if (!title) {
    issues.push(issue("Title", "required"));
  }

  if (recordId && isTemporaryRecordId && input.duplicateWorkbookTemporaryRecordIds.has(recordId)) {
    issues.push(issue("RecordId", "duplicate temporary id"));
  }

  if (itemType && !itemTypeSchema.safeParse(itemType).success) {
    issues.push(issue("ItemType", "invalid value"));
  }

  if (row.Status.trim() && !itemStatusSchema.safeParse(row.Status.trim()).success) {
    issues.push(issue("Status", "invalid value"));
  }

  if (row.Priority.trim() && !prioritySchema.safeParse(row.Priority.trim()).success) {
    issues.push(issue("Priority", "invalid value"));
  }

  if (!isValidImportedDatePair(row.StartDate, row.EndDate)) {
    issues.push(issue("StartDate/EndDate", "must be paired ISO dates"));
  }

  if (row.DueDate.trim() && !isIsoDateOnly(row.DueDate.trim())) {
    issues.push(issue("DueDate", "must use yyyy-mm-dd"));
  }

  if (!isValidInteger(row.DurationDays.trim(), { min: 1 })) {
    issues.push(issue("DurationDays", "must be an integer >= 1"));
  }

  if (!isValidNumber(row.EstimateHours.trim(), { min: 0 })) {
    issues.push(issue("EstimateHours", "must be a number >= 0"));
  }

  if (percentValue) {
    const percent = Number(percentValue);
    if (Number.isNaN(percent) || percent < 0 || percent > 100) {
      issues.push(issue("PercentComplete", "must be between 0 and 100"));
    }
  }

  const dependsOnValidation = validateDependsOn({
    dependsOn: row.DependsOn,
    currentRecordId: recordId || null,
    currentProjectExistingIds: input.currentProjectExistingIds,
    workbookTemporaryRecordIds: input.workbookTemporaryRecordIds,
    existingItems: input.existingItems,
  });
  issues.push(...dependsOnValidation.issues);

  if (issues.length > 0) {
    return errorRow(input.rowNumber, row, issues);
  }

  if (recordId) {
    const existing = input.existingItems.get(recordId);
    if (existing) {
      if (existing.projectId !== input.project.id) {
        return errorRow(input.rowNumber, row, [issue("RecordId", "belongs to another project")]);
      }
      const resolvedProject = resolveProjectForImportRow({
        currentProject: input.project,
        projectCode,
        projectName,
        projectsByCode: input.projectsByCode,
        projectsByName: input.projectsByName,
      });
      if (!resolvedProject) {
        return errorRow(input.rowNumber, row, [issue("ProjectCode/ProjectName", "invalid value")]);
      }
      if (resolvedProject.id !== input.project.id) {
        return errorRow(input.rowNumber, row, [issue("ProjectCode/ProjectName", "mismatch for current import target")]);
      }
      if (parentRecordId === recordId) {
        return errorRow(input.rowNumber, row, [issue("ParentRecordId", "cannot reference itself")]);
      }
      if (
        parentRecordId &&
        !input.currentProjectExistingIds.has(parentRecordId) &&
        !input.workbookRecordIds.has(parentRecordId)
      ) {
        return errorRow(input.rowNumber, row, [issue("ParentRecordId", "not found")]);
      }
      const staleWarning = collectLastModifiedAtWarning(row.LastModifiedAt, existing.updatedAt);
      if (staleWarning) {
        warnings.push(staleWarning);
      }
      warnings.push(
        ...collectDependsOnCycleWarnings({
          currentProjectDependencies: input.currentProjectDependencies,
          successorItemId: recordId,
          desiredReferences: dependsOnValidation.references,
        })
      );
      return {
        rowNumber: input.rowNumber,
        action: "update",
        recordId,
        projectCode: projectCode || input.project.code,
        projectName: projectName || existing.projectName || input.project.name,
        title,
        message: "Update existing item",
        issues: [],
        warnings,
      };
    }

    if (!input.workbookTemporaryRecordIds.has(recordId)) {
      return errorRow(input.rowNumber, row, [issue("RecordId", "not found")]);
    }
  }

  const resolvedProject = resolveProjectForImportRow({
    currentProject: input.project,
    projectCode,
    projectName,
    projectsByCode: input.projectsByCode,
    projectsByName: input.projectsByName,
  });
  if (!resolvedProject) {
    return errorRow(input.rowNumber, row, [issue("ProjectCode/ProjectName", "invalid value")]);
  }
  if (resolvedProject.id !== input.project.id) {
    return errorRow(input.rowNumber, row, [issue("ProjectCode/ProjectName", "mismatch for current import target")]);
  }

  if (
    parentRecordId &&
    !input.currentProjectExistingIds.has(parentRecordId) &&
    !input.workbookRecordIds.has(parentRecordId)
  ) {
    return errorRow(input.rowNumber, row, [issue("ParentRecordId", "not found")]);
  }

  return {
    rowNumber: input.rowNumber,
    action: "new",
    recordId,
    projectCode: resolvedProject.code,
    projectName: resolvedProject.name,
    title,
    message: "Create new item",
    issues: [],
    warnings: [],
  };
}

function errorRow(
  rowNumber: number,
  row: TasksSheetRow,
  issues: ProjectImportPreviewIssue[]
): ProjectImportPreviewRow {
  return {
    rowNumber,
    action: "error",
    recordId: row.RecordId.trim(),
    projectCode: row.ProjectCode.trim(),
    projectName: row.ProjectName.trim(),
    title: row.Title.trim(),
    message: formatIssueSummary(issues),
    issues,
    warnings: [],
  };
}

function issue(field: string, message: string): ProjectImportPreviewIssue {
  return { field, message };
}

function warning(field: string, message: string): ProjectImportPreviewWarning {
  return { field, message };
}

function formatIssueSummary(issues: ProjectImportPreviewIssue[]): string {
  if (issues.length === 1) {
    return `${issues[0].field}: ${issues[0].message}`;
  }
  return `${issues.length} validation issues`;
}

function collectLastModifiedAtWarning(
  importedLastModifiedAt: string,
  existingUpdatedAt: string
): ProjectImportPreviewWarning | null {
  const importedText = importedLastModifiedAt.trim();
  if (!importedText) {
    return null;
  }

  const importedDate = new Date(importedText);
  const existingDate = new Date(existingUpdatedAt);
  if (Number.isNaN(importedDate.getTime()) || Number.isNaN(existingDate.getTime())) {
    return null;
  }

  if (importedDate >= existingDate) {
    return null;
  }

  return warning("LastModifiedAt", "workbook row is older than current item");
}

function collectDependsOnCycleWarnings(input: {
  currentProjectDependencies: DependencyRecord[];
  successorItemId: string;
  desiredReferences: PreviewDependencyReference[];
}): ProjectImportPreviewWarning[] {
  const nextDependencies = input.currentProjectDependencies.filter(
    (dependency) => dependency.successorItemId !== input.successorItemId
  );
  const warnings: ProjectImportPreviewWarning[] = [];

  for (const desiredReference of input.desiredReferences.filter((reference) => reference.source === "existing")) {
    if (
      nextDependencies.some(
        (dependency) =>
          dependency.predecessorItemId === desiredReference.recordId &&
          dependency.successorItemId === input.successorItemId &&
          dependency.type === "finish_to_start"
      )
    ) {
      continue;
    }

    if (
      wouldCreateDependencyCycle(
        nextDependencies,
        desiredReference.recordId,
        input.successorItemId
      )
    ) {
      warnings.push(
        warning("DependsOn", `would create dependency cycle on apply: ${desiredReference.token}`)
      );
      continue;
    }

    nextDependencies.push({
      id: `preview-${desiredReference.recordId}-${input.successorItemId}`,
      projectId: "",
      predecessorItemId: desiredReference.recordId,
      successorItemId: input.successorItemId,
      type: "finish_to_start",
      lagDays: desiredReference.lagDays,
      createdAt: "",
      updatedAt: "",
    });
  }

  return warnings;
}

export function parseProjectImportTasksRows(workbookBytes: Uint8Array): TasksSheetRow[] {
  const entries = readZipEntries(workbookBytes);
  const decoder = new TextDecoder();
  const workbookXml = readXml(entries, "xl/workbook.xml", decoder);
  const workbookRelsXml = readXml(entries, "xl/_rels/workbook.xml.rels", decoder);
  const sharedStrings = parseSharedStrings(entries.get("xl/sharedStrings.xml"), decoder);
  const tasksSheetPath = resolveTasksSheetPath(workbookXml, workbookRelsXml);
  const sheetXml = readXml(entries, tasksSheetPath, decoder);

  return parseSheetRows(sheetXml, sharedStrings);
}

function resolveProjectForImportRow(input: {
  currentProject: ProjectSummary;
  projectCode: string;
  projectName: string;
  projectsByCode: Map<string, ProjectSummary>;
  projectsByName: Map<string, ProjectSummary>;
}): ProjectSummary | null {
  if (!input.projectCode && !input.projectName) {
    return input.currentProject;
  }
  const byCode = input.projectCode ? input.projectsByCode.get(input.projectCode) ?? null : null;
  const byName = input.projectName ? input.projectsByName.get(input.projectName) ?? null : null;

  if (input.projectCode && !byCode) {
    return null;
  }
  if (input.projectName && !byName) {
    return null;
  }
  if (byCode && byName) {
    return byCode.id === byName.id ? byCode : null;
  }

  return byCode ?? byName ?? input.currentProject;
}

function isValidImportedDatePair(startDate: string, endDate: string): boolean {
  const normalizedStart = startDate.trim();
  const normalizedEnd = endDate.trim();
  if (!normalizedStart && !normalizedEnd) {
    return true;
  }
  return isIsoDateOnly(normalizedStart) && isIsoDateOnly(normalizedEnd);
}

function isIsoDateOnly(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isValidInteger(value: string, constraints: { min?: number } = {}): boolean {
  if (!value) {
    return true;
  }
  if (!/^-?\d+$/.test(value)) {
    return false;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    return false;
  }
  if (constraints.min !== undefined && parsed < constraints.min) {
    return false;
  }
  return true;
}

function isValidNumber(value: string, constraints: { min?: number } = {}): boolean {
  if (!value) {
    return true;
  }
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return false;
  }
  if (constraints.min !== undefined && parsed < constraints.min) {
    return false;
  }
  return true;
}

interface PreviewDependencyReference {
  token: string;
  recordId: string;
  lagDays: number;
  source: "existing" | "temporary";
}

function validateDependsOn(input: {
  dependsOn: string;
  currentRecordId: string | null;
  currentProjectExistingIds: Set<string>;
  workbookTemporaryRecordIds: Set<string>;
  existingItems: Map<string, ItemRecord>;
}): {
  issues: ProjectImportPreviewIssue[];
  references: PreviewDependencyReference[];
} {
  const tokens = input.dependsOn
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
  const issues: ProjectImportPreviewIssue[] = [];
  const references: PreviewDependencyReference[] = [];

  for (const token of tokens) {
    const reference = parseDependencyReferenceToken(token, {
      currentProjectExistingIds: input.currentProjectExistingIds,
      workbookTemporaryRecordIds: input.workbookTemporaryRecordIds,
    });
    if (reference) {
      if (input.currentRecordId && reference.recordId === input.currentRecordId) {
        issues.push(issue("DependsOn", `cannot reference itself: ${token}`));
      } else {
        references.push({
          token,
          recordId: reference.recordId,
          lagDays: reference.lagDays,
          source: reference.source,
        });
      }
      continue;
    }

    const fallbackRecordId = extractDependencyRecordIdCandidate(token);
    const existingReferencedItem = input.existingItems.get(fallbackRecordId);
    if (existingReferencedItem) {
      issues.push(issue("DependsOn", `must reference current project item: ${token}`));
      continue;
    }

    if (looksLikeDependencyReferenceToken(token)) {
      issues.push(issue("DependsOn", `reference not found: ${token}`));
      continue;
    }

    issues.push(issue("DependsOn", `invalid token format: ${token}`));
  }

  return { issues, references };
}

function parseDependencyReferenceToken(
  token: string,
  allowedIds: {
    currentProjectExistingIds: Set<string>;
    workbookTemporaryRecordIds: Set<string>;
  }
): { recordId: string; lagDays: number; source: "existing" | "temporary" } | null {
  const tokenSource = resolvePreviewDependencySource(token, allowedIds);
  if (tokenSource) {
    return {
      recordId: token,
      lagDays: 0,
      source: tokenSource,
    };
  }

  const lagMatch = token.match(/^(.*?)([+-]\d+)$/);
  if (!lagMatch) {
    return null;
  }

  const recordId = lagMatch[1];
  const lagDays = Number(lagMatch[2]);
  const source = resolvePreviewDependencySource(recordId, allowedIds);
  if (!recordId || Number.isNaN(lagDays) || !source) {
    return null;
  }

  return {
    recordId,
    lagDays,
    source,
  };
}

function resolvePreviewDependencySource(
  recordId: string,
  allowedIds: {
    currentProjectExistingIds: Set<string>;
    workbookTemporaryRecordIds: Set<string>;
  }
): "existing" | "temporary" | null {
  if (allowedIds.currentProjectExistingIds.has(recordId)) {
    return "existing";
  }
  if (allowedIds.workbookTemporaryRecordIds.has(recordId)) {
    return "temporary";
  }
  return null;
}

function collectWorkbookTemporaryIds(
  rows: TasksSheetRow[],
  existingItems: Map<string, ItemRecord>
): {
  availableIds: Set<string>;
  duplicateIds: Set<string>;
} {
  const counts = new Map<string, number>();

  for (const row of rows) {
    const recordId = row.RecordId.trim();
    if (!isWorkbookTemporaryRecordId(recordId) || existingItems.has(recordId)) {
      continue;
    }

    counts.set(recordId, (counts.get(recordId) ?? 0) + 1);
  }

  return {
    availableIds: new Set(
      [...counts.entries()].filter(([, count]) => count === 1).map(([recordId]) => recordId)
    ),
    duplicateIds: new Set(
      [...counts.entries()].filter(([, count]) => count > 1).map(([recordId]) => recordId)
    ),
  };
}

function isWorkbookTemporaryRecordId(recordId: string): boolean {
  return /^tmp_[^,\s]+$/u.test(recordId);
}

function extractDependencyRecordIdCandidate(token: string): string {
  const lagMatch = token.match(/^(.*?)([+-]\d+)$/);
  if (lagMatch?.[1]) {
    return lagMatch[1];
  }

  return token;
}

function looksLikeDependencyReferenceToken(token: string): boolean {
  return /^[^,\s]+(?:[+-]\d+)?$/.test(token);
}

function readXml(entries: Map<string, Uint8Array>, path: string, decoder: TextDecoder): string {
  const value = entries.get(path);
  if (!value) {
    throw new Error(`Workbook entry not found: ${path}`);
  }
  return decoder.decode(value);
}

function resolveTasksSheetPath(workbookXml: string, workbookRelsXml: string): string {
  const sheets = [...workbookXml.matchAll(/<sheet\b[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)].map(
    (match) => ({
      name: decodeXml(match[1]),
      relationId: match[2],
    })
  );
  const tasksSheet = sheets.find((sheet) => sheet.name === "Tasks");
  if (!tasksSheet) {
    throw new Error("Tasks sheet not found");
  }

  const relationships = [...workbookRelsXml.matchAll(/<Relationship\b[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g)].map(
    (match) => ({
      id: match[1],
      target: match[2],
    })
  );
  const relationship = relationships.find((entry) => entry.id === tasksSheet.relationId);
  if (!relationship) {
    throw new Error("Tasks sheet relationship not found");
  }

  return relationship.target.startsWith("/")
    ? relationship.target.slice(1)
    : `xl/${relationship.target.replace(/^\/?/, "")}`;
}

function parseSharedStrings(sharedStringsBytes: Uint8Array | undefined, decoder: TextDecoder): string[] {
  if (!sharedStringsBytes) {
    return [];
  }

  const xml = decoder.decode(sharedStringsBytes);
  return [...xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((match) =>
    [...match[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)]
      .map((textMatch) => decodeXml(textMatch[1]))
      .join("")
  );
}

function parseSheetRows(sheetXml: string, sharedStrings: string[]): TasksSheetRow[] {
  const parsedRows = [...sheetXml.matchAll(/<row\b[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)].map(
    (match) => ({
      rowNumber: Number(match[1]),
      valuesByColumn: parseRowCells(match[2], sharedStrings),
    })
  );

  const headerRow = parsedRows.find((row) => row.rowNumber === 1);
  if (!headerRow) {
    throw new Error("Tasks sheet header row not found");
  }

  const headers = EXCEL_TASKS_SHEET_COLUMNS.map((column, index) => {
    const headerValue = (headerRow.valuesByColumn.get(index + 1) ?? "").trim();
    if (headerValue !== column) {
      throw new Error(`Tasks sheet header mismatch at column ${index + 1}: expected ${column}`);
    }
    return column;
  });

  return parsedRows
    .filter((row) => row.rowNumber > 1)
    .map((row) => {
      const values = headers.map((_, index) => row.valuesByColumn.get(index + 1) ?? "");
      return Object.fromEntries(headers.map((column, index) => [column, values[index]])) as unknown as TasksSheetRow;
    })
    .filter((row) => Object.values(row).some((value) => value.trim() !== ""));
}

function parseRowCells(rowXml: string, sharedStrings: string[]): Map<number, string> {
  const valuesByColumn = new Map<number, string>();
  const cellMatches = rowXml.matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>|<c\b([^>]*)\/>/g);

  for (const match of cellMatches) {
    const attributes = match[1] ?? match[3] ?? "";
    const body = match[2] ?? "";
    const refMatch = attributes.match(/\br="([A-Z]+)\d+"/);
    if (!refMatch) {
      continue;
    }

    const typeMatch = attributes.match(/\bt="([^"]+)"/);
    const type = typeMatch?.[1] ?? null;
    const columnNumber = columnNameToNumber(refMatch[1]);
    valuesByColumn.set(columnNumber, parseCellValue(type, body, sharedStrings));
  }

  return valuesByColumn;
}

function parseCellValue(
  type: string | null,
  body: string,
  sharedStrings: string[]
): string {
  if (type === "inlineStr") {
    return [...body.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)]
      .map((match) => decodeXml(match[1]))
      .join("");
  }

  const valueMatch = body.match(/<v>([\s\S]*?)<\/v>/);
  const valueText = valueMatch ? decodeXml(valueMatch[1]) : "";
  if (type === "s") {
    const sharedIndex = Number(valueText);
    return Number.isNaN(sharedIndex) ? "" : sharedStrings[sharedIndex] ?? "";
  }
  if (type === "b") {
    return valueText === "1" ? "TRUE" : "FALSE";
  }
  return valueText;
}

function columnNameToNumber(columnName: string): number {
  return [...columnName].reduce((value, character) => value * 26 + (character.charCodeAt(0) - 64), 0);
}

function decodeXml(value: string): string {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
}
