import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  addDays,
  differenceInCalendarDays,
  endOfDay,
  endOfWeek,
  isSameDay,
  parseISO,
  startOfDay,
  startOfWeek,
} from "date-fns";
import { wouldCreateDependencyCycle } from "../../domain/dependency-graph";
import {
  advanceRecurrenceNextOccurrenceAt,
  deriveRecurringOccurrenceEndDate,
} from "../../domain/recurrence";
import { buildProjectTemplateBody } from "../../domain/project-template";
import {
  buildVisibleRows,
  normalizeProjectItems,
  resolveSiblingReorder,
} from "../../domain/project-tree";
import { parseQuickCapture } from "../../domain/quick-capture";
import {
  buildTemplateApplyNodes,
  buildWbsTemplateApplyNodes,
  buildWbsTemplateBody,
} from "../../domain/wbs-template";
import { addWorkingDays, normalizeWorkingDayNumbers } from "../../domain/working-days";
import {
  backupAutoResultSchema,
  appSettingsSchema,
  backupEntrySchema,
  backupPreviewSchema,
  backupRestoreResultSchema,
  bulkPostponeInputSchema,
  createDependencyInputSchema,
  createItemInputSchema,
  createProjectInputSchema,
  updateAppSettingsInputSchema,
  applyProjectTemplateInputSchema,
  applyWbsTemplateInputSchema,
  itemStatusSchema,
  itemTypeSchema,
  dependencyRecordSchema,
  hierarchyMoveInputSchema,
  homeSummarySchema,
  portfolioProjectPhasesSchema,
  portfolioSummarySchema,
  prioritySchema,
  projectImportCommitResultSchema,
  projectDetailSchema,
  quickCaptureInputSchema,
  recurrenceRuleSchema,
  rowReorderInputSchema,
  saveProjectTemplateInputSchema,
  saveWbsTemplateInputSchema,
  templateRecordSchema,
  textBackupResultSchema,
  upsertRecurrenceRuleInputSchema,
  updateItemInputSchema,
  updateProjectInputSchema,
  type BackupEntry,
  type BackupAutoResult,
  type BackupPreview,
  type BackupRestoreResult,
  type TextBackupResult,
  type AppSettings,
  type ApplyProjectTemplateInput,
  type ApplyWbsTemplateInput,
  type BulkPostponeInput,
  type CreateDependencyInput,
  type CreateItemInput,
  type CreateProjectInput,
  type DependencyRecord,
  type HierarchyMoveInput,
  type HomeSummary,
  type ItemRecord,
  type PortfolioProjectPhases,
  type PortfolioSummary,
  type PostponeTarget,
  type ProjectDetail,
  type ProjectImportCommitResult,
  type ProjectSummary,
  type QuickCaptureInput,
  type RecurrenceRule,
  type RowReorderInput,
  type SaveProjectTemplateInput,
  type SaveWbsTemplateInput,
  type TemplateRecord,
  type UpsertRecurrenceRuleInput,
  type UpdateAppSettingsInput,
  type UpdateItemInput,
  type UpdateProjectInput,
} from "../../shared/contracts";
import { DatabaseManager } from "../../infra/db/database";
import {
  buildProjectImportPreview,
  parseProjectImportTasksRows,
} from "../../infra/excel/project-workbook-import";
import { exportProjectWorkbookXlsx } from "../../infra/excel/project-workbook-export";
import { DependencyRepository } from "../repositories/dependency-repository";
import { ItemRepository } from "../repositories/item-repository";
import { ProjectRepository } from "../repositories/project-repository";
import { RecurrenceRuleRepository } from "../repositories/recurrence-rule-repository";
import { SettingsRepository } from "../repositories/settings-repository";
import { TagRepository } from "../repositories/tag-repository";
import { TemplateRepository } from "../repositories/template-repository";

export const INBOX_PROJECT_CODE = "_INBOX";
export const INBOX_PROJECT_NAME = "Inbox";

export class WorkspaceService {
  private readonly projects: ProjectRepository;
  private readonly items: ItemRepository;
  private readonly tags: TagRepository;
  private readonly dependencies: DependencyRepository;
  private readonly templates: TemplateRepository;
  private readonly recurrenceRules: RecurrenceRuleRepository;
  private readonly settings: SettingsRepository;

  constructor(private readonly db: DatabaseManager) {
    this.projects = new ProjectRepository(db);
    this.items = new ItemRepository(db);
    this.tags = new TagRepository(db);
    this.dependencies = new DependencyRepository(db);
    this.templates = new TemplateRepository(db);
    this.recurrenceRules = new RecurrenceRuleRepository(db);
    this.settings = new SettingsRepository(db);
  }

  getAppSettings(): AppSettings {
    return appSettingsSchema.parse(this.ensureAppSettings());
  }

  updateAppSettings(input: UpdateAppSettingsInput): AppSettings {
    const parsed = updateAppSettingsInputSchema.parse(input);
    const current = this.ensureAppSettings();
    const nextSettings = {
      ...current,
      ...parsed,
      workingDayNumbers: normalizeWorkingDayNumbers(
        parsed.workingDayNumbers ?? current.workingDayNumbers
      ),
      updatedAt: new Date().toISOString(),
    };

    this.db.withTransaction(() => {
        this.settings.update({
          language: nextSettings.language,
          theme: nextSettings.theme,
          autoBackupEnabled: nextSettings.autoBackupEnabled,
          autoBackupRetentionLimit: nextSettings.autoBackupRetentionLimit,
          excelDefaultPriority: nextSettings.excelDefaultPriority,
          excelDefaultAssignee: nextSettings.excelDefaultAssignee,
          weekStartsOn: nextSettings.weekStartsOn,
          fyStartMonth: nextSettings.fyStartMonth,
          workingDayNumbers: nextSettings.workingDayNumbers,
          defaultView: nextSettings.defaultView,
          updatedAt: nextSettings.updatedAt,
        });
    });

    return appSettingsSchema.parse(nextSettings);
  }

  listProjects(): ProjectSummary[] {
    return this.projects.listByCodes([INBOX_PROJECT_CODE]);
  }

  listBackups(): BackupEntry[] {
    return this.db.listBackups().map((entry) => backupEntrySchema.parse(entry));
  }

  createBackup(): BackupEntry {
    return backupEntrySchema.parse(this.db.createBackup());
  }

  createTextBackup(input: { now?: Date } = {}): TextBackupResult {
    const createdAt = (input.now ?? new Date()).toISOString();
    const directoryPath = this.db.getTextBackupDirectory();
    fs.mkdirSync(directoryPath, { recursive: true });

    const snapshot = this.buildTextBackupSnapshot(createdAt);
    const fileNames = writeTextBackupSnapshot(directoryPath, snapshot);
    const gitResult = commitTextBackup(directoryPath, createdAt);

    return textBackupResultSchema.parse({
      directoryPath,
      createdAt,
      fileNames,
      gitAvailable: gitResult.gitAvailable,
      gitCommitted: gitResult.gitCommitted,
      commitSha: gitResult.commitSha,
      warning: gitResult.warning,
    });
  }

  ensureAutoBackup(input: { now?: Date } = {}): BackupAutoResult {
    const settings = this.ensureAppSettings();
    if (!settings.autoBackupEnabled) {
      return backupAutoResultSchema.parse({
        createdBackup: null,
        prunedFileNames: [],
        retentionLimit: settings.autoBackupRetentionLimit,
      });
    }

    return backupAutoResultSchema.parse(
      this.db.ensureAutoBackup({
        now: input.now,
        retentionLimit: settings.autoBackupRetentionLimit,
      })
    );
  }

  async previewBackup(entry: BackupEntry): Promise<BackupPreview> {
    const parsed = backupEntrySchema.parse(entry);
    if (!parsed.filePath) {
      throw new Error("Backup preview requires a local backup file");
    }

    const summary = await this.db.previewBackup(parsed.filePath);
    return backupPreviewSchema.parse({
      ...parsed,
      ...summary,
    });
  }

  async restoreBackup(entry: BackupEntry): Promise<BackupRestoreResult> {
    const parsed = backupEntrySchema.parse(entry);
    if (!parsed.filePath) {
      throw new Error("Backup restore requires a local backup file");
    }

    const safetyBackup = await this.db.restoreBackup(parsed.filePath);
    return backupRestoreResultSchema.parse({
      restoredBackup: parsed,
      safetyBackup,
    });
  }

  private buildTextBackupSnapshot(createdAt: string): TextBackupSnapshot {
    const projects = this.db.query<RawTableRow>(
      "SELECT * FROM project ORDER BY archived ASC, code COLLATE NOCASE ASC, name COLLATE NOCASE ASC, id ASC"
    );
    const items = this.db.query<RawTableRow>(
      "SELECT * FROM item ORDER BY project_id ASC, parent_id ASC, sort_order ASC, wbs_code ASC, id ASC"
    );
    const dependencies = this.db.query<RawTableRow>(
      "SELECT * FROM dependency ORDER BY project_id ASC, predecessor_item_id ASC, successor_item_id ASC, id ASC"
    );
    const tags = this.db.query<RawTableRow>(
      "SELECT * FROM tag ORDER BY name COLLATE NOCASE ASC, id ASC"
    );
    const itemTags = this.db.query<RawTableRow>(
      "SELECT * FROM item_tag ORDER BY item_id ASC, tag_id ASC"
    );
    const recurrenceRules = this.db.query<RawTableRow>(
      "SELECT * FROM recurrence_rule ORDER BY item_id ASC, id ASC"
    );
    const templates = this.db.query<RawTableRow>(
      "SELECT * FROM template ORDER BY kind ASC, name COLLATE NOCASE ASC, id ASC"
    );
    const settings = this.db.query<RawTableRow>(
      "SELECT * FROM app_settings ORDER BY workspace_id ASC"
    );

    return {
      manifest: {
        schemaVersion: 1,
        createdAt,
        counts: {
          projects: projects.length,
          items: items.length,
          dependencies: dependencies.length,
          tags: tags.length,
          itemTags: itemTags.length,
          recurrenceRules: recurrenceRules.length,
          templates: templates.length,
          settings: settings.length,
        },
      },
      projects,
      items,
      dependencies,
      tags,
      itemTags,
      recurrenceRules,
      templates,
      settings,
      projectMarkdownFiles: buildProjectMarkdownFiles(projects, items),
    };
  }

  getHomeSummary(): HomeSummary {
    const inboxProject = this.ensureInboxProject();
    const inboxItems = this.items.listInboxItems(inboxProject.id);
    const dashboardItems = this.items.listForDashboard();
    const now = new Date();
    const todayStart = startOfDay(now);
    const weekStartsOn = toDateFnsWeekStartsOn(this.ensureAppSettings().weekStartsOn);
    const weekStart = startOfWeek(now, { weekStartsOn });
    const weekEnd = endOfWeek(now, { weekStartsOn });

    return homeSummarySchema.parse({
      inboxItems: inboxItems
        .filter((item) => !item.isScheduled)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
      todayItems: dashboardItems.filter((item) => isScheduledOnDay(item, now)),
      overdueItems: dashboardItems.filter((item) => isOverdue(item, todayStart)),
      weekMilestones: dashboardItems.filter((item) => {
        if (item.type !== "milestone") {
          return false;
        }

        const effectiveDate = getEffectiveDate(item);
        if (!effectiveDate) {
          return false;
        }

        const date = parseISO(effectiveDate);
        return date >= weekStart && date <= weekEnd;
      }),
      recentProjects: this.listProjects().slice(0, 5),
    });
  }

  getPortfolioSummary(): PortfolioSummary {
    const now = new Date();
    const todayStart = startOfDay(now);
    const recentWindowStart = addDays(now, -7);

    return portfolioSummarySchema.parse({
      projects: this.listProjects().map((project) => {
        const projectItems = this.items.listByProject(project.id);
        const overdueItems = projectItems.filter((item) => isOverdue(item, todayStart));
        const nextMilestone = findNextMilestone(projectItems);
        const recentChangeCount7d = projectItems.filter(
          (item) => parseISO(item.updatedAt) >= recentWindowStart
        ).length;

        return {
          id: project.id,
          portfolioId: project.portfolioId,
          code: project.code,
          name: project.name,
          ownerName: project.ownerName,
          status: project.status,
          progressCached: project.progressCached,
          overdueCount: overdueItems.length,
          nextMilestoneTitle: nextMilestone?.title ?? null,
          nextMilestoneDate: nextMilestone?.date ?? null,
          recentChangeCount7d,
          riskLevel: computePortfolioRiskLevel({
            overdueCount: overdueItems.length,
            blockedCount: projectItems.filter((item) => item.status === "blocked").length,
            nextMilestoneDate: nextMilestone?.date ?? null,
            todayStart,
          }),
        };
      }),
    });
  }

  getPortfolioProjectPhases(projectId: string): PortfolioProjectPhases {
    this.mustGetProject(projectId);
    const now = new Date();
    const todayStart = startOfDay(now);
    const recentWindowStart = addDays(now, -7);
    const projectItems = this.items.listByProject(projectId);
    const phases = projectItems.filter((item) => item.parentId === null && item.type === "group");

    return portfolioProjectPhasesSchema.parse({
      projectId,
      phases: phases.map((phase) => {
        const scopeItems = collectSubtreeItems(projectItems, phase.id).filter(
          (item) => item.id !== phase.id
        );
        const overdueItems = scopeItems.filter((item) => isOverdue(item, todayStart));
        const nextMilestone = findNextMilestone(scopeItems);
        const recentChangeCount7d = scopeItems.filter(
          (item) => parseISO(item.updatedAt) >= recentWindowStart
        ).length;

        return {
          id: phase.id,
          projectId,
          wbsCode: phase.wbsCode,
          title: phase.title,
          status: phase.status,
          progressCached: phase.percentComplete,
          overdueCount: overdueItems.length,
          nextMilestoneTitle: nextMilestone?.title ?? null,
          nextMilestoneDate: nextMilestone?.date ?? null,
          recentChangeCount7d,
          riskLevel: computePortfolioRiskLevel({
            overdueCount: overdueItems.length,
            blockedCount: scopeItems.filter((item) => item.status === "blocked").length,
            nextMilestoneDate: nextMilestone?.date ?? null,
            todayStart,
          }),
          startDate: phase.startDate,
          endDate: phase.endDate,
        };
      }),
    });
  }

  createProject(input: CreateProjectInput): ProjectSummary {
    const parsed = createProjectInputSchema.parse(input);
    const now = new Date().toISOString();
    const projectId = randomUUID();
    const existingCount = this.listProjects().length + 1;

    this.db.withTransaction(() => {
      this.projects.insert({
        id: projectId,
        code: parsed.code ?? `PRJ-${String(existingCount).padStart(3, "0")}`,
        name: parsed.name,
        status: "not_started",
        priority: "medium",
        createdAt: now,
        updatedAt: now,
      });
    });

    return this.mustGetProject(projectId);
  }

  updateProject(input: UpdateProjectInput): ProjectSummary {
    const parsed = updateProjectInputSchema.parse(input);
    const currentProject = this.mustGetProject(parsed.id);

    this.db.withTransaction(() => {
      this.projects.update({
        id: parsed.id,
        name: parsed.name,
        code: parsed.code,
        ownerName: parsed.ownerName ?? currentProject.ownerName,
        updatedAt: new Date().toISOString(),
      });
    });

    return this.mustGetProject(parsed.id);
  }

  getProjectDetail(projectId: string): ProjectDetail {
    return projectDetailSchema.parse({
      project: this.mustGetProject(projectId),
      items: this.items.listByProject(projectId),
    });
  }

  previewProjectImport(input: {
    projectId: string;
    sourcePath: string | null;
    workbookBytes: Uint8Array;
  }) {
    const project = this.mustGetProject(input.projectId);
    return buildProjectImportPreview({
      project,
      sourcePath: input.sourcePath,
      supportsDependencyImport: true,
      workbookBytes: input.workbookBytes,
      items: this.items.listForDashboard(),
      projects: this.projects.list(),
      dependencies: this.dependencies.listByProject(project.id),
    });
  }

  commitProjectImport(input: {
    projectId: string;
    sourcePath: string | null;
    workbookBytes: Uint8Array;
  }): ProjectImportCommitResult {
    const project = this.mustGetProject(input.projectId);
    const items = this.items.listForDashboard();
    const projects = this.projects.list();
    const preview = buildProjectImportPreview({
      project,
      sourcePath: input.sourcePath,
      supportsDependencyImport: true,
      workbookBytes: input.workbookBytes,
      items,
      projects,
      dependencies: this.dependencies.listByProject(project.id),
    });
    const rows = parseProjectImportTasksRows(input.workbookBytes);
    const previewRowsByNumber = new Map(preview.rows.map((row) => [row.rowNumber, row]));
    const currentProjectItems = items.filter((item) => item.projectId === project.id);
    const itemsById = new Map(currentProjectItems.map((item) => [item.id, item]));
    const currentProjectExistingIds = new Set(currentProjectItems.map((item) => item.id));
    const workbookTemporaryRecordIdToItemId = new Map<string, string>();
    const desiredDependenciesBySuccessor = new Map<
      string,
      Array<{ predecessorItemId: string; lagDays: number }>
    >();
    const importedDependsOnBySuccessor = new Map<string, string>();
    const now = new Date().toISOString();
    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    this.db.withTransaction(() => {
      for (const [index, row] of rows.entries()) {
        const rowNumber = index + 2;
        const previewRow = previewRowsByNumber.get(rowNumber);
        if (!previewRow || previewRow.action === "error") {
          skippedCount += 1;
          continue;
        }

        if (previewRow.action === "update") {
          const existing = itemsById.get(row.RecordId.trim());
          if (!existing) {
            skippedCount += 1;
            continue;
          }

          const nextItem = buildImportedExistingItem({
            existing,
            row,
            now,
            itemsById,
          });
          this.items.updateEditable(nextItem);
          this.tags.attachNamesToItem(existing.id, parseImportedTagNames(row.Tags), now);
          itemsById.set(existing.id, nextItem);
          importedDependsOnBySuccessor.set(existing.id, row.DependsOn);
          updatedCount += 1;
          continue;
        }

        const itemId = randomUUID();
        const inserted = buildImportedNewItem({
          itemId,
          projectId: project.id,
          row,
          now,
          itemsById,
          nextSortOrder: this.items.nextSortOrder(
            project.id,
            resolveImportedParentId(row.ParentRecordId, itemsById)
          ),
        });
        this.items.insert(inserted);
        this.tags.attachNamesToItem(itemId, parseImportedTagNames(row.Tags), now);
        importedDependsOnBySuccessor.set(itemId, row.DependsOn);
        if (isWorkbookTemporaryRecordId(row.RecordId.trim())) {
          workbookTemporaryRecordIdToItemId.set(row.RecordId.trim(), itemId);
        }
        createdCount += 1;
      }

      for (const [successorItemId, dependsOnValue] of importedDependsOnBySuccessor.entries()) {
        desiredDependenciesBySuccessor.set(
          successorItemId,
          parseImportedDependsOn(dependsOnValue, (recordId) => {
            if (currentProjectExistingIds.has(recordId)) {
              return recordId;
            }
            return workbookTemporaryRecordIdToItemId.get(recordId) ?? null;
          })
        );
      }

      replaceImportedDependencies({
        projectId: project.id,
        dependencies: this.dependencies,
        desiredDependenciesBySuccessor,
        updatedAt: now,
      });

      if (createdCount > 0 || updatedCount > 0) {
        this.rebalanceProject(project.id);
      }
    });

    return projectImportCommitResultSchema.parse({
      sourcePath: input.sourcePath,
      createdCount,
      updatedCount,
      skippedCount,
    });
  }

  exportProjectWorkbook(projectId: string): Uint8Array {
    const project = this.mustGetProject(projectId);
    const settings = this.ensureAppSettings();
    return exportProjectWorkbookXlsx({
      project,
      items: this.items.listByProject(projectId),
      dependencies: this.dependencies.listByProject(projectId),
      excelDefaults: {
        priority: settings.excelDefaultPriority,
        assignee: settings.excelDefaultAssignee,
      },
    });
  }

  listDependenciesByProject(projectId: string): DependencyRecord[] {
    this.mustGetProject(projectId);
    return this.dependencies
      .listByProject(projectId)
      .map((dependency) => dependencyRecordSchema.parse(dependency));
  }

  createDependency(input: CreateDependencyInput): DependencyRecord {
    const parsed = createDependencyInputSchema.parse(input);
    const predecessor = this.mustGetItem(parsed.predecessorItemId);
    const successor = this.mustGetItem(parsed.successorItemId);

    if (predecessor.id === successor.id) {
      throw new Error("Dependency predecessor and successor must be different");
    }
    if (predecessor.archived || successor.archived) {
      throw new Error("Archived items cannot be linked by dependency");
    }
    if (predecessor.projectId !== successor.projectId) {
      throw new Error("Dependency items must belong to the same project");
    }

    const existing = this.dependencies.findByEdge({
      projectId: predecessor.projectId,
      predecessorItemId: predecessor.id,
      successorItemId: successor.id,
      type: parsed.type,
    });
    if (existing) {
      throw new Error("Dependency already exists");
    }
    if (
      wouldCreateDependencyCycle(
        this.dependencies.listByProject(predecessor.projectId),
        predecessor.id,
        successor.id
      )
    ) {
      throw new Error("Dependency cycle is not allowed");
    }

    const now = new Date().toISOString();
    const dependencyId = randomUUID();

    this.db.withTransaction(() => {
      this.dependencies.insert({
        id: dependencyId,
        projectId: predecessor.projectId,
        predecessorItemId: predecessor.id,
        successorItemId: successor.id,
        type: parsed.type,
        lagDays: parsed.lagDays,
        createdAt: now,
        updatedAt: now,
      });
    });

    const created = this.dependencies.getById(dependencyId);
    if (!created) {
      throw new Error(`Dependency not found after create: ${dependencyId}`);
    }

    return dependencyRecordSchema.parse(created);
  }

  deleteDependency(dependencyId: string): void {
    const dependency = this.dependencies.getById(dependencyId);
    if (!dependency) {
      throw new Error(`Dependency not found: ${dependencyId}`);
    }

    this.db.withTransaction(() => {
      this.dependencies.delete(dependencyId);
    });
  }

  listTemplates(): TemplateRecord[] {
    return this.templates.list().map((template) => templateRecordSchema.parse(template));
  }

  saveWbsTemplate(input: SaveWbsTemplateInput): TemplateRecord {
    const parsed = saveWbsTemplateInputSchema.parse(input);
    const rootItem = this.mustGetItem(parsed.rootItemId);
    if (rootItem.archived) {
      throw new Error("Archived items cannot be saved as template");
    }

    const projectItems = this.items.listByProject(rootItem.projectId);
    const now = new Date().toISOString();
    const templateId = randomUUID();
    const body = buildWbsTemplateBody({
      items: projectItems,
      rootItemId: rootItem.id,
      sourceProjectId: rootItem.projectId,
    });
    const template: TemplateRecord = {
      id: templateId,
      workspaceId: rootItem.workspaceId,
      kind: "wbs",
      name: parsed.name ?? rootItem.title,
      body,
      createdAt: now,
      updatedAt: now,
    };

    this.db.withTransaction(() => {
      this.templates.insert({
        id: template.id,
        workspaceId: template.workspaceId,
        kind: template.kind,
        name: template.name,
        body: template.body,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt,
      });
    });

    return templateRecordSchema.parse(template);
  }

  saveProjectTemplate(input: SaveProjectTemplateInput): TemplateRecord {
    const parsed = saveProjectTemplateInputSchema.parse(input);
    const project = this.mustGetProject(parsed.projectId);
    if (project.archived) {
      throw new Error("Archived projects cannot be saved as template");
    }

    const projectItems = this.items.listByProject(project.id);
    const now = new Date().toISOString();
    const templateId = randomUUID();
    const template: TemplateRecord = {
      id: templateId,
      workspaceId: project.workspaceId,
      kind: "project",
      name: parsed.name ?? project.name,
      body: buildProjectTemplateBody({
        project,
        items: projectItems,
      }),
      createdAt: now,
      updatedAt: now,
    };

    this.db.withTransaction(() => {
      this.templates.insert({
        id: template.id,
        workspaceId: template.workspaceId,
        kind: template.kind,
        name: template.name,
        body: template.body,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt,
      });
    });

    return templateRecordSchema.parse(template);
  }

  applyWbsTemplate(input: ApplyWbsTemplateInput): ItemRecord[] {
    const parsed = applyWbsTemplateInputSchema.parse(input);
    const project = this.mustGetProject(parsed.projectId);
    const template = this.templates.getById(parsed.templateId);
    if (!template || template.kind !== "wbs") {
      throw new Error(`Template not found: ${parsed.templateId}`);
    }

    const orderedNodes = buildWbsTemplateApplyNodes(template.body);
    if (orderedNodes.length === 0) {
      throw new Error(`Template has no nodes: ${parsed.templateId}`);
    }

    const now = new Date().toISOString();
    const createdItemIds: string[] = [];

    this.db.withTransaction(() => {
      this.insertTemplateNodesIntoProject({
        projectId: project.id,
        orderedNodes,
        now,
        createdItemIds,
      });

      this.rebalanceProject(project.id);
    });

    return createdItemIds.map((itemId) => this.mustGetItem(itemId));
  }

  applyProjectTemplate(input: ApplyProjectTemplateInput): ProjectDetail {
    const parsed = applyProjectTemplateInputSchema.parse(input);
    const template = this.templates.getById(parsed.templateId);
    if (!template || template.kind !== "project") {
      throw new Error(`Template not found: ${parsed.templateId}`);
    }

    const now = new Date().toISOString();
    const projectId = randomUUID();
    const existingCount = this.listProjects().length + 1;
    const projectCode = `PRJ-${String(existingCount).padStart(3, "0")}`;
    const createdItemIds: string[] = [];

    this.db.withTransaction(() => {
      this.projects.insert({
        id: projectId,
        code: projectCode,
        name: template.body.projectFields.name,
        description: template.body.projectFields.description,
        ownerName: template.body.projectFields.ownerName,
        status: "not_started",
        priority: template.body.projectFields.priority,
        color: template.body.projectFields.color,
        createdAt: now,
        updatedAt: now,
      });

      this.insertTemplateNodesIntoProject({
        projectId,
        orderedNodes: buildTemplateApplyNodes(template.body.templateItems),
        now,
        createdItemIds,
      });

      this.rebalanceProject(projectId);
    });

    return this.getProjectDetail(projectId);
  }

  getRecurrenceRuleByItem(itemId: string): RecurrenceRule | null {
    const item = this.mustGetItem(itemId);
    if (item.archived) {
      return null;
    }
    const rule = this.recurrenceRules.getByItemId(itemId);
    return rule ? recurrenceRuleSchema.parse(rule) : null;
  }

  upsertRecurrenceRule(input: UpsertRecurrenceRuleInput): RecurrenceRule {
    const parsed = upsertRecurrenceRuleInputSchema.parse(input);
    const item = this.mustGetItem(parsed.itemId);

    if (item.archived) {
      throw new Error("Recurrence rules cannot be attached to archived items");
    }
    if (item.type !== "task") {
      throw new Error("Recurrence rules are supported for task items only");
    }

    const existing = this.recurrenceRules.getByItemId(parsed.itemId);
    const now = new Date().toISOString();
    const nextRule: RecurrenceRule = {
      id: existing?.id ?? randomUUID(),
      itemId: parsed.itemId,
      rruleText: parsed.rruleText,
      nextOccurrenceAt: parsed.nextOccurrenceAt ?? null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    this.db.withTransaction(() => {
      this.recurrenceRules.upsert({
        id: nextRule.id,
        itemId: nextRule.itemId,
        rruleText: nextRule.rruleText,
        nextOccurrenceAt: nextRule.nextOccurrenceAt,
        createdAt: nextRule.createdAt,
        updatedAt: nextRule.updatedAt,
      });
      this.items.setRecurringFlag(parsed.itemId, true, now);
    });

    return recurrenceRuleSchema.parse(this.recurrenceRules.getByItemId(parsed.itemId));
  }

  deleteRecurrenceRuleByItem(itemId: string): void {
    this.mustGetItem(itemId);
    const now = new Date().toISOString();

    this.db.withTransaction(() => {
      this.recurrenceRules.deleteByItemId(itemId);
      this.items.setRecurringFlag(itemId, false, now);
    });
  }

  createItem(input: CreateItemInput): ItemRecord {
    const parsed = createItemInputSchema.parse(input);
    const project = this.mustGetProject(parsed.projectId);
    const itemId = randomUUID();
    const now = new Date().toISOString();

    this.db.withTransaction(() => {
      this.items.insert({
        id: itemId,
        projectId: project.id,
        parentId: parsed.parentId ?? null,
        title: parsed.title,
        type: parsed.type,
        note: "",
        status: "not_started",
        priority: "medium",
        assigneeName: "",
        startDate: null,
        endDate: null,
        dueDate: null,
        estimateHours: 0,
        durationDays: 1,
        isScheduled: false,
        sortOrder: this.items.nextSortOrder(project.id, parsed.parentId ?? null),
        createdAt: now,
        updatedAt: now,
      });

      this.rebalanceProject(project.id);
    });

    return this.mustGetItem(itemId);
  }

  createQuickCapture(input: QuickCaptureInput): ItemRecord {
    const parsedInput = quickCaptureInputSchema.parse(input);
    const parsed = parseQuickCapture(parsedInput.text);
    const projectMatch = this.resolveProjectFromCapture(parsed.title);
    const project = projectMatch ?? this.ensureInboxProject();
    const title = stripMatchedProjectPrefix(parsed.title, projectMatch) || parsed.title;
    const now = new Date().toISOString();
    const itemId = randomUUID();

    this.db.withTransaction(() => {
      this.items.insert({
        id: itemId,
        projectId: project.id,
        parentId: null,
        title,
        type: "task",
        note: parsed.note,
        status: "not_started",
        priority: parsed.priority,
        assigneeName: parsed.assigneeName,
        startDate: parsed.startDate,
        endDate: parsed.endDate,
        dueDate: parsed.dueDate,
        estimateHours: parsed.estimateHours,
        durationDays: deriveDurationDays(parsed.startDate, parsed.endDate),
        isScheduled: parsed.isScheduled,
        sortOrder: this.items.nextSortOrder(project.id, null),
        createdAt: now,
        updatedAt: now,
      });
      this.tags.attachNamesToItem(itemId, parsed.tags, now);
      this.rebalanceProject(project.id);
    });

    return this.mustGetItem(itemId);
  }

  bulkPostponeOverdue(input: BulkPostponeInput): ItemRecord[] {
    const parsed = bulkPostponeInputSchema.parse(input);
    const now = new Date();
    const targetDateText = formatDateOnly(
      getPostponeDate(parsed.target, now, this.ensureAppSettings().weekStartsOn)
    );
    const overdueItems = this.items
      .listForDashboard()
      .filter((item) => isOverdue(item, startOfDay(now)));

    if (overdueItems.length === 0) {
      return [];
    }

    const updatedAt = now.toISOString();
    const changedProjectIds = new Set<string>();

    this.db.withTransaction(() => {
      for (const item of overdueItems) {
        const nextStartDate = item.startDate ? targetDateText : item.startDate;
        const nextEndDate = item.endDate ? targetDateText : item.endDate;
        const nextItem: ItemRecord = {
          ...item,
          startDate: nextStartDate,
          endDate: nextEndDate,
          dueDate: targetDateText,
          isScheduled: Boolean(nextStartDate && nextEndDate),
          durationDays: deriveDurationDays(nextStartDate, nextEndDate),
          updatedAt,
        };

        this.items.updateEditable(nextItem);
        changedProjectIds.add(item.projectId);
      }

      for (const projectId of changedProjectIds) {
        this.rebalanceProject(projectId);
      }
    });

    return overdueItems.map((item) => this.mustGetItem(item.id));
  }

  moveItemHierarchy(input: HierarchyMoveInput): ItemRecord {
    const parsed = hierarchyMoveInputSchema.parse(input);
    const item = this.mustGetItem(parsed.itemId);
    const items = this.items.listByProject(item.projectId);
    const now = new Date().toISOString();

    const nextHierarchy = resolveHierarchyMove(items, parsed.itemId, parsed.direction);
    if (!nextHierarchy) {
      return item;
    }

    const nextItem: ItemRecord = {
      ...item,
      parentId: nextHierarchy.parentId,
      sortOrder: nextHierarchy.sortOrder,
      updatedAt: now,
    };

    this.db.withTransaction(() => {
      this.items.updateDerived(nextItem);
      this.rebalanceProject(item.projectId);
    });

    return this.mustGetItem(item.id);
  }

  reorderItemRow(input: RowReorderInput): ItemRecord {
    const parsed = rowReorderInputSchema.parse(input);
    const item = this.mustGetItem(parsed.itemId);
    const items = this.items.listByProject(item.projectId);
    const reorderPatches = resolveSiblingReorder({
      items,
      itemId: parsed.itemId,
      targetItemId: parsed.targetItemId,
      placement: parsed.placement,
    });
    if (!reorderPatches) {
      return item;
    }

    const itemsById = new Map(items.map((entry) => [entry.id, entry]));
    const now = new Date().toISOString();

    this.db.withTransaction(() => {
      for (const patch of reorderPatches) {
        const target = itemsById.get(patch.id);
        if (!target) {
          continue;
        }
        this.items.updateDerived({
          ...target,
          sortOrder: patch.sortOrder,
          updatedAt: now,
        });
      }
      this.rebalanceProject(item.projectId);
    });

    return this.mustGetItem(item.id);
  }

  updateItem(input: UpdateItemInput): ItemRecord {
    const parsed = updateItemInputSchema.parse(input);
    const existing = this.mustGetItem(parsed.id);
    const projectItems = this.items.listByProject(existing.projectId);
    const itemStateById = new Map(projectItems.map((item) => [item.id, item]));
    const nextProjectId = parsed.projectId ?? existing.projectId;
    const targetProject = nextProjectId === existing.projectId ? null : this.mustGetProject(nextProjectId);
    const now = new Date().toISOString();
    const rescheduleDeltaDays =
      (parsed.rescheduleScope === "with_descendants" || parsed.rescheduleScope === "with_dependents") &&
      !targetProject
        ? resolveRescheduleDeltaDays(existing, parsed)
        : 0;
    const descendantItems =
      (parsed.rescheduleScope === "with_descendants" || parsed.rescheduleScope === "with_dependents") &&
      rescheduleDeltaDays !== 0
        ? collectSubtreeItems(projectItems, existing.id).filter((item) => item.id !== existing.id)
        : [];
    const nextItem: ItemRecord = {
      ...existing,
      projectId: nextProjectId,
      parentId: targetProject ? null : existing.parentId,
      title: parsed.title ?? existing.title,
      type: parsed.type ?? existing.type,
      status: parsed.status ?? existing.status,
      priority: parsed.priority ?? existing.priority,
      percentComplete: parsed.percentComplete ?? existing.percentComplete,
      startDate: parsed.startDate === undefined ? existing.startDate : parsed.startDate,
      endDate: parsed.endDate === undefined ? existing.endDate : parsed.endDate,
      dueDate:
        parsed.startDate === undefined && parsed.endDate === undefined
          ? existing.dueDate
          : parsed.endDate ?? parsed.startDate ?? existing.dueDate,
      estimateHours: parsed.estimateHours ?? existing.estimateHours,
      assigneeName: parsed.assigneeName ?? existing.assigneeName,
      note: parsed.note ?? existing.note,
      isScheduled:
        parsed.startDate === undefined && parsed.endDate === undefined
          ? existing.isScheduled
          : Boolean((parsed.startDate ?? existing.startDate) && (parsed.endDate ?? existing.endDate)),
      durationDays: deriveDurationDays(
        parsed.startDate === undefined ? existing.startDate : parsed.startDate,
        parsed.endDate === undefined ? existing.endDate : parsed.endDate
      ),
      sortOrder: targetProject ? this.items.nextSortOrder(targetProject.id, null) : existing.sortOrder,
      updatedAt: now,
      completedAt:
        (parsed.status ?? existing.status) === "done"
          ? existing.completedAt ?? now
          : null,
    };
    itemStateById.set(nextItem.id, nextItem);

    const shiftedDescendants =
      rescheduleDeltaDays !== 0
        ? descendantItems.map((item) => shiftScheduledItemDates(itemStateById.get(item.id) ?? item, rescheduleDeltaDays, now))
        : [];
    for (const descendant of shiftedDescendants) {
      itemStateById.set(descendant.id, descendant);
    }
      const dependencyItemsById =
        parsed.rescheduleScope === "with_dependents" && rescheduleDeltaDays !== 0 && !targetProject
          ? buildDependentShiftItemsById({
              itemsById: itemStateById,
              projectItems,
              dependencies: this.dependencies.listByProject(existing.projectId),
              changedRootIds: [existing.id, ...descendantItems.map((item) => item.id)],
              updatedAt: now,
              workingDayNumbers: this.ensureAppSettings().workingDayNumbers,
            })
          : new Map<string, ItemRecord>();
    for (const [itemId, item] of dependencyItemsById.entries()) {
      itemStateById.set(itemId, item);
    }
    const recurrenceRule =
      existing.status !== "done" && nextItem.status === "done"
        ? this.recurrenceRules.getByItemId(existing.id)
        : null;
    const recurringOccurrence = recurrenceRule
      ? buildRecurringGeneration({
          sourceItem: nextItem,
          recurrenceRule,
          now,
          nextSortOrder: this.items.nextSortOrder(nextItem.projectId, nextItem.parentId),
        })
      : null;

    this.db.withTransaction(() => {
      this.items.updateEditable(nextItem);
      for (const descendant of shiftedDescendants) {
        this.items.updateEditable(descendant);
      }
      for (const dependencyItem of dependencyItemsById.values()) {
        this.items.updateEditable(dependencyItem);
      }
      if (parsed.tags !== undefined) {
        this.tags.attachNamesToItem(parsed.id, parsed.tags, now);
      }
      if (recurringOccurrence) {
        this.items.insert(recurringOccurrence.item);
        if (nextItem.tags.length > 0) {
          this.tags.attachNamesToItem(recurringOccurrence.item.id, nextItem.tags, now);
        }
        this.recurrenceRules.deleteByItemId(existing.id);
        this.items.setRecurringFlag(existing.id, false, now);
        this.recurrenceRules.upsert(recurringOccurrence.rule);
        this.items.setRecurringFlag(recurringOccurrence.item.id, true, now);
      }
      if (existing.projectId !== nextItem.projectId) {
        this.rebalanceProject(existing.projectId);
      }
      this.rebalanceProject(nextItem.projectId);
    });

    return this.mustGetItem(parsed.id);
  }

  archiveItem(itemId: string): void {
    const item = this.mustGetItem(itemId);
    const allItems = this.items.listByProject(item.projectId);
    const targets = collectSubtreeIds(allItems, itemId);
    const now = new Date().toISOString();

    this.db.withTransaction(() => {
      this.items.archiveMany(targets, now);
      this.rebalanceProject(item.projectId);
    });
  }

  private insertTemplateNodesIntoProject(input: {
    projectId: string;
    orderedNodes: ReturnType<typeof buildTemplateApplyNodes>;
    now: string;
    createdItemIds: string[];
  }): void {
    const itemIdByNodeId = new Map<string, string>();
    const nextSortOrderByParent = new Map<string | null, number>();

    for (const node of input.orderedNodes) {
      const parentId = node.parentNodeId ? itemIdByNodeId.get(node.parentNodeId) ?? null : null;
      const nextSortOrder =
        nextSortOrderByParent.get(parentId) ?? this.items.nextSortOrder(input.projectId, parentId);
      const itemId = randomUUID();

      this.items.insert({
        id: itemId,
        projectId: input.projectId,
        parentId,
        title: node.title,
        type: node.type,
        note: node.note,
        status: "not_started",
        priority: node.priority,
        assigneeName: node.assigneeName,
        startDate: null,
        endDate: null,
        dueDate: null,
        estimateHours: node.estimateHours,
        durationDays: node.durationDays,
        percentComplete: 0,
        actualHours: 0,
        isScheduled: false,
        sortOrder: nextSortOrder,
        createdAt: input.now,
        updatedAt: input.now,
        completedAt: null,
      });
      this.tags.attachNamesToItem(itemId, node.tags, input.now);
      itemIdByNodeId.set(node.nodeId, itemId);
      nextSortOrderByParent.set(parentId, nextSortOrder + 1);
      input.createdItemIds.push(itemId);
    }
  }

  private rebalanceProject(projectId: string): void {
    const detail = this.getProjectDetail(projectId);
    const rollup = normalizeProjectItems(detail.items);
    const now = new Date().toISOString();

    for (const item of rollup.items) {
      this.items.updateDerived({
        ...item,
        updatedAt: now,
      });
    }

    this.projects.updateDerived({
      id: projectId,
      startDate: rollup.projectStartDate,
      endDate: rollup.projectEndDate,
      progressCached: rollup.projectProgress,
      updatedAt: now,
    });
  }

  private ensureInboxProject(): ProjectSummary {
    const existing = this.projects.getByCode(INBOX_PROJECT_CODE);
    if (existing) {
      return existing;
    }

    const now = new Date().toISOString();
    const projectId = randomUUID();
    this.db.withTransaction(() => {
      this.projects.insert({
        id: projectId,
        code: INBOX_PROJECT_CODE,
        name: INBOX_PROJECT_NAME,
        status: "not_started",
        priority: "medium",
        createdAt: now,
        updatedAt: now,
      });
    });

    return this.mustGetProject(projectId);
  }

  private resolveProjectFromCapture(title: string): ProjectSummary | null {
    for (const project of this.listProjects()) {
      if (title === project.name || title.startsWith(`${project.name} `)) {
        return project;
      }
      if (title === project.code || title.startsWith(`${project.code} `)) {
        return project;
      }
    }

    return null;
  }

  private mustGetProject(projectId: string): ProjectSummary {
    const project = this.projects.getById(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    return project;
  }

  private mustGetItem(itemId: string): ItemRecord {
    const item = this.items.getById(itemId);
    if (!item) {
      throw new Error(`Item not found: ${itemId}`);
    }

    return item;
  }

  private ensureAppSettings(): AppSettings {
    const existing = this.settings.get();
    if (existing) {
      return existing;
    }

    const now = new Date().toISOString();
      const defaults: AppSettings = {
        workspaceId: "ws-default",
        language: "ja",
        theme: "light",
        autoBackupEnabled: true,
        autoBackupRetentionLimit: 7,
        excelDefaultPriority: "medium",
        excelDefaultAssignee: "",
        weekStartsOn: "monday",
        fyStartMonth: 4,
        workingDayNumbers: [1, 2, 3, 4, 5],
        defaultView: "home",
        createdAt: now,
        updatedAt: now,
    };

    this.db.withTransaction(() => {
        this.settings.insert({
          language: defaults.language,
          theme: defaults.theme,
          autoBackupEnabled: defaults.autoBackupEnabled,
          autoBackupRetentionLimit: defaults.autoBackupRetentionLimit,
          excelDefaultPriority: defaults.excelDefaultPriority,
          excelDefaultAssignee: defaults.excelDefaultAssignee,
          weekStartsOn: defaults.weekStartsOn,
          fyStartMonth: defaults.fyStartMonth,
          workingDayNumbers: defaults.workingDayNumbers,
          defaultView: defaults.defaultView,
          createdAt: defaults.createdAt,
          updatedAt: defaults.updatedAt,
      });
    });

    return defaults;
  }
}

type JsonPrimitive = string | number | boolean | null;
type RawTableRow = Record<string, JsonPrimitive>;

interface TextBackupSnapshot {
  manifest: {
    schemaVersion: 1;
    createdAt: string;
    counts: Record<string, number>;
  };
  projects: RawTableRow[];
  items: RawTableRow[];
  dependencies: RawTableRow[];
  tags: RawTableRow[];
  itemTags: RawTableRow[];
  recurrenceRules: RawTableRow[];
  templates: RawTableRow[];
  settings: RawTableRow[];
  projectMarkdownFiles: Array<{ fileName: string; content: string }>;
}

interface TextBackupGitResult {
  gitAvailable: boolean;
  gitCommitted: boolean;
  commitSha: string | null;
  warning: string | null;
}

function writeTextBackupSnapshot(directoryPath: string, snapshot: TextBackupSnapshot): string[] {
  const projectsDirectory = path.join(directoryPath, "projects");
  fs.mkdirSync(projectsDirectory, { recursive: true });

  const files = new Map<string, string>([
    ["README.md", buildTextBackupReadme()],
    ["manifest.json", stableJson(snapshot.manifest)],
    ["projects.json", stableJson(snapshot.projects)],
    ["items.json", stableJson(snapshot.items)],
    ["dependencies.json", stableJson(snapshot.dependencies)],
    ["tags.json", stableJson(snapshot.tags)],
    ["item_tags.json", stableJson(snapshot.itemTags)],
    ["recurrence_rules.json", stableJson(snapshot.recurrenceRules)],
    ["templates.json", stableJson(snapshot.templates)],
    ["settings.json", stableJson(snapshot.settings)],
  ]);

  for (const [fileName, content] of files) {
    fs.writeFileSync(path.join(directoryPath, fileName), content, "utf8");
  }

  const currentProjectFiles = new Set(snapshot.projectMarkdownFiles.map((entry) => entry.fileName));
  for (const entry of fs.readdirSync(projectsDirectory, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith(".md") && !currentProjectFiles.has(entry.name)) {
      fs.rmSync(path.join(projectsDirectory, entry.name), { force: true });
    }
  }

  for (const entry of snapshot.projectMarkdownFiles) {
    fs.writeFileSync(path.join(projectsDirectory, entry.fileName), entry.content, "utf8");
  }

  return [
    ...files.keys(),
    ...snapshot.projectMarkdownFiles.map((entry) => `projects/${entry.fileName}`),
  ];
}

function commitTextBackup(directoryPath: string, createdAt: string): TextBackupGitResult {
  const versionResult = runGit(directoryPath, ["--version"]);
  if (versionResult.status !== 0) {
    return {
      gitAvailable: false,
      gitCommitted: false,
      commitSha: null,
      warning: "git command is not available; text files were written without a commit",
    };
  }

  if (runGit(directoryPath, ["rev-parse", "--is-inside-work-tree"]).status !== 0) {
    const initResult = runGit(directoryPath, ["init"]);
    if (initResult.status !== 0) {
      return {
        gitAvailable: true,
        gitCommitted: false,
        commitSha: null,
        warning: normalizeGitError(initResult) || "git init failed",
      };
    }
  }

  runGit(directoryPath, ["config", "user.name", "SGC Backup"]);
  runGit(directoryPath, ["config", "user.email", "sgc-backup@local"]);

  const addResult = runGit(directoryPath, ["add", "."]);
  if (addResult.status !== 0) {
    return {
      gitAvailable: true,
      gitCommitted: false,
      commitSha: null,
      warning: normalizeGitError(addResult) || "git add failed",
    };
  }

  const commitResult = runGit(directoryPath, [
    "commit",
    "-m",
    `Text backup ${createdAt.replace("T", " ").replace("Z", " UTC")}`,
  ]);
  if (commitResult.status !== 0) {
    const output = `${commitResult.stdout}\n${commitResult.stderr}`.toLowerCase();
    if (output.includes("nothing to commit")) {
      return {
        gitAvailable: true,
        gitCommitted: false,
        commitSha: getGitHeadSha(directoryPath),
        warning: null,
      };
    }
    return {
      gitAvailable: true,
      gitCommitted: false,
      commitSha: null,
      warning: normalizeGitError(commitResult) || "git commit failed",
    };
  }

  return {
    gitAvailable: true,
    gitCommitted: true,
    commitSha: getGitHeadSha(directoryPath),
    warning: null,
  };
}

function runGit(
  directoryPath: string,
  args: string[]
): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync("git", args, {
    cwd: directoryPath,
    encoding: "utf8",
    windowsHide: true,
  });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function getGitHeadSha(directoryPath: string): string | null {
  const result = runGit(directoryPath, ["rev-parse", "--short", "HEAD"]);
  if (result.status !== 0) {
    return null;
  }
  const sha = result.stdout.trim();
  return sha || null;
}

function normalizeGitError(result: { stdout: string; stderr: string }): string {
  return `${result.stderr}\n${result.stdout}`.trim().replace(/\s+/g, " ");
}

function buildTextBackupReadme(): string {
  return [
    "# SGC Text Backup",
    "",
    "This directory is a Git repository managed by SGC.",
    "Each snapshot writes deterministic JSON plus per-project Markdown so task and Gantt data can be reviewed with normal text diff tools.",
    "",
    "SQLite backups remain the restore source of truth. This text backup is for audit, manual recovery, and history review.",
    "",
  ].join("\n");
}

function buildProjectMarkdownFiles(
  projects: RawTableRow[],
  items: RawTableRow[]
): Array<{ fileName: string; content: string }> {
  return projects.map((project) => {
    const projectId = String(project.id ?? "");
    const projectItems = items.filter((item) => item.project_id === projectId);
    const code = String(project.code ?? projectId);
    const name = String(project.name ?? "");
    const fileName = `${sanitizeTextBackupFileName(code || "project")}-${sanitizeTextBackupFileName(
      projectId.slice(0, 8) || "unknown"
    )}.md`;
    const rows = projectItems.map((item) =>
      [
        escapeMarkdownCell(String(item.wbs_code ?? "")),
        escapeMarkdownCell(String(item.title ?? "")),
        escapeMarkdownCell(String(item.type ?? "")),
        escapeMarkdownCell(String(item.status ?? "")),
        escapeMarkdownCell(String(item.assignee_name ?? "")),
        escapeMarkdownCell(String(item.start_date ?? "")),
        escapeMarkdownCell(String(item.end_date ?? "")),
        escapeMarkdownCell(String(item.percent_complete ?? "")),
      ].join(" | ")
    );

    return {
      fileName,
      content: [
        `# ${code} ${name}`.trim(),
        "",
        `- Project ID: ${projectId}`,
        `- Status: ${String(project.status ?? "")}`,
        `- Priority: ${String(project.priority ?? "")}`,
        "",
        "| WBS | Title | Type | Status | Assignee | Start | End | Progress |",
        "| --- | --- | --- | --- | --- | --- | --- | --- |",
        ...rows.map((row) => `| ${row} |`),
        "",
      ].join("\n"),
    };
  });
}

function stableJson(value: unknown): string {
  return `${JSON.stringify(sortJsonValue(value), null, 2)}\n`;
}

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sortJsonValue(entry));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, sortJsonValue(entry)])
    );
  }
  return value;
}

function sanitizeTextBackupFileName(value: string): string {
  return (
    [...value]
      .map((character) => {
        const code = character.charCodeAt(0);
        if ('<>:"/\\|?*'.includes(character) || code <= 31) {
          return "_";
        }
        return character;
      })
      .join("")
      .trim() || "project"
  );
}

function escapeMarkdownCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function buildImportedExistingItem(input: {
  existing: ItemRecord;
  row: {
    Title: string;
    ItemType: string;
    Status: string;
    Priority: string;
    Assignee: string;
    StartDate: string;
    EndDate: string;
    DueDate: string;
    DurationDays: string;
    PercentComplete: string;
    EstimateHours: string;
    Note: string;
    ParentRecordId: string;
  };
  now: string;
  itemsById: Map<string, ItemRecord>;
}): ItemRecord {
  const startDate = normalizeImportedDate(input.row.StartDate);
  const endDate = normalizeImportedDate(input.row.EndDate);
  const dueDate =
    normalizeImportedDate(input.row.DueDate) ?? endDate ?? startDate ?? null;
  const nextStatus = itemStatusSchema.parse(input.row.Status.trim() || input.existing.status);

  return {
    ...input.existing,
    parentId: resolveImportedParentId(input.row.ParentRecordId, input.itemsById),
    title: input.row.Title.trim(),
    type: itemTypeSchema.parse(input.row.ItemType.trim() || input.existing.type),
    status: nextStatus,
    priority: prioritySchema.parse(input.row.Priority.trim() || input.existing.priority),
    assigneeName: input.row.Assignee.trim(),
    startDate,
    endDate,
    dueDate,
    durationDays: parseImportedInteger(input.row.DurationDays, input.existing.durationDays),
    percentComplete: parseImportedNumber(
      input.row.PercentComplete,
      input.existing.percentComplete
    ),
    estimateHours: parseImportedNumber(input.row.EstimateHours, input.existing.estimateHours),
    note: input.row.Note,
    isScheduled: Boolean(startDate && endDate),
    updatedAt: input.now,
    completedAt:
      nextStatus === "done"
        ? input.existing.completedAt ?? input.now
        : null,
  };
}

function buildImportedNewItem(input: {
  itemId: string;
  projectId: string;
  row: {
    Title: string;
    ItemType: string;
    Status: string;
    Priority: string;
    Assignee: string;
    StartDate: string;
    EndDate: string;
    DueDate: string;
    DurationDays: string;
    PercentComplete: string;
    EstimateHours: string;
    Note: string;
    ParentRecordId: string;
  };
  now: string;
  itemsById: Map<string, ItemRecord>;
  nextSortOrder: number;
}): Parameters<ItemRepository["insert"]>[0] {
  const startDate = normalizeImportedDate(input.row.StartDate);
  const endDate = normalizeImportedDate(input.row.EndDate);
  const dueDate =
    normalizeImportedDate(input.row.DueDate) ?? endDate ?? startDate ?? null;
  const nextStatus = itemStatusSchema.parse(input.row.Status.trim() || "not_started");

  return {
    id: input.itemId,
    projectId: input.projectId,
    parentId: resolveImportedParentId(input.row.ParentRecordId, input.itemsById),
    title: input.row.Title.trim(),
    type: itemTypeSchema.parse(input.row.ItemType.trim() || "task"),
    note: input.row.Note,
    status: nextStatus,
    priority: prioritySchema.parse(input.row.Priority.trim() || "medium"),
    assigneeName: input.row.Assignee.trim(),
    startDate,
    endDate,
    dueDate,
    estimateHours: parseImportedNumber(input.row.EstimateHours, 0),
    durationDays: parseImportedInteger(
      input.row.DurationDays,
      deriveDurationDays(startDate, endDate)
    ),
    percentComplete: parseImportedNumber(input.row.PercentComplete, 0),
    isScheduled: Boolean(startDate && endDate),
    sortOrder: input.nextSortOrder,
    actualHours: 0,
    createdAt: input.now,
    updatedAt: input.now,
    completedAt: nextStatus === "done" ? input.now : null,
  };
}

function normalizeImportedDate(value: string): string | null {
  const normalized = value.trim();
  return normalized || null;
}

function parseImportedInteger(value: string, fallback: number): number {
  const normalized = value.trim();
  if (!normalized) {
    return fallback;
  }
  const parsed = Number(normalized);
  return Number.isInteger(parsed) ? parsed : fallback;
}

function parseImportedNumber(value: string, fallback: number): number {
  const normalized = value.trim();
  if (!normalized) {
    return fallback;
  }
  const parsed = Number(normalized);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function parseImportedTagNames(value: string): string[] {
  return value
    .split(/[,\s]+/u)
    .map((tag) => tag.trim().replace(/^#/, ""))
    .filter(Boolean);
}

function parseImportedDependsOn(
  value: string,
  resolveRecordId: (recordId: string) => string | null
): Array<{ predecessorItemId: string; lagDays: number }> {
  return value
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => parseImportedDependencyToken(token, resolveRecordId))
    .filter((reference): reference is { predecessorItemId: string; lagDays: number } => Boolean(reference));
}

function parseImportedDependencyToken(
  token: string,
  resolveRecordId: (recordId: string) => string | null
): { predecessorItemId: string; lagDays: number } | null {
  const directRecordId = resolveRecordId(token);
  if (directRecordId) {
    return {
      predecessorItemId: directRecordId,
      lagDays: 0,
    };
  }

  const lagMatch = token.match(/^(.*?)([+-]\d+)$/);
  if (!lagMatch?.[1]) {
    return null;
  }

  const predecessorRecordId = lagMatch[1];
  const lagDays = Number(lagMatch[2]);
  const predecessorItemId = resolveRecordId(predecessorRecordId);
  if (!predecessorItemId || Number.isNaN(lagDays)) {
    return null;
  }

  return {
    predecessorItemId,
    lagDays,
  };
}

function isWorkbookTemporaryRecordId(recordId: string): boolean {
  return /^tmp_[^,\s]+$/u.test(recordId);
}

function replaceImportedDependencies(input: {
  projectId: string;
  dependencies: DependencyRepository;
  desiredDependenciesBySuccessor: Map<string, Array<{ predecessorItemId: string; lagDays: number }>>;
  updatedAt: string;
}): void {
  const successorItemIds = [...input.desiredDependenciesBySuccessor.keys()];
  if (successorItemIds.length === 0) {
    return;
  }

  const currentDependencies = input.dependencies.listByProject(input.projectId);
  const remainingDependencies = currentDependencies.filter(
    (dependency) => !input.desiredDependenciesBySuccessor.has(dependency.successorItemId)
  );
  input.dependencies.deleteBySuccessorItemIds(input.projectId, successorItemIds);

  const nextDependencies = [...remainingDependencies];
  for (const successorItemId of successorItemIds) {
    const desiredDependencies = input.desiredDependenciesBySuccessor.get(successorItemId) ?? [];
    for (const desiredDependency of desiredDependencies) {
      if (
        nextDependencies.some(
          (dependency) =>
            dependency.predecessorItemId === desiredDependency.predecessorItemId &&
            dependency.successorItemId === successorItemId &&
            dependency.type === "finish_to_start"
        )
      ) {
        continue;
      }

      if (
        wouldCreateDependencyCycle(
          nextDependencies,
          desiredDependency.predecessorItemId,
          successorItemId
        )
      ) {
        throw new Error("Imported dependency cycle is not allowed");
      }

      const dependency: DependencyRecord = {
        id: randomUUID(),
        projectId: input.projectId,
        predecessorItemId: desiredDependency.predecessorItemId,
        successorItemId,
        type: "finish_to_start",
        lagDays: desiredDependency.lagDays,
        createdAt: input.updatedAt,
        updatedAt: input.updatedAt,
      };
      input.dependencies.insert({
        id: dependency.id,
        projectId: dependency.projectId,
        predecessorItemId: dependency.predecessorItemId,
        successorItemId: dependency.successorItemId,
        type: dependency.type,
        lagDays: dependency.lagDays,
        createdAt: dependency.createdAt,
        updatedAt: dependency.updatedAt,
      });
      nextDependencies.push(dependency);
    }
  }
}

function resolveImportedParentId(
  parentRecordId: string,
  itemsById: Map<string, ItemRecord>
): string | null {
  const normalized = parentRecordId.trim();
  if (!normalized) {
    return null;
  }
  return itemsById.has(normalized) ? normalized : null;
}

function getEffectiveDate(item: ItemRecord): string | null {
  return item.endDate ?? item.startDate ?? item.dueDate;
}

function buildRecurringGeneration(input: {
  sourceItem: ItemRecord;
  recurrenceRule: RecurrenceRule;
  now: string;
  nextSortOrder: number;
}): {
  item: Parameters<ItemRepository["insert"]>[0];
  rule: RecurrenceRule;
} | null {
  if (
    input.sourceItem.type !== "task" ||
    !input.sourceItem.startDate ||
    !input.sourceItem.endDate ||
    !input.recurrenceRule.nextOccurrenceAt
  ) {
    return null;
  }

  const nextOccurrenceStartDate = input.recurrenceRule.nextOccurrenceAt;
  const recurringDurationDays = deriveDurationDays(
    input.sourceItem.startDate,
    input.sourceItem.endDate
  );
  const nextOccurrenceEndDate = deriveRecurringOccurrenceEndDate(
    nextOccurrenceStartDate,
    recurringDurationDays
  );
  const generatedItemId = randomUUID();
  const nextOccurrenceAt = advanceRecurrenceNextOccurrenceAt(
    input.recurrenceRule.rruleText,
    nextOccurrenceStartDate
  );

  return {
    item: {
      id: generatedItemId,
      projectId: input.sourceItem.projectId,
      parentId: input.sourceItem.parentId,
      title: input.sourceItem.title,
      type: "task",
      note: input.sourceItem.note,
      status: "not_started",
      priority: input.sourceItem.priority,
      assigneeName: input.sourceItem.assigneeName,
      startDate: nextOccurrenceStartDate,
      endDate: nextOccurrenceEndDate,
      dueDate: nextOccurrenceEndDate,
      estimateHours: input.sourceItem.estimateHours,
      durationDays: recurringDurationDays,
      percentComplete: 0,
      actualHours: 0,
      isScheduled: true,
      sortOrder: input.nextSortOrder,
      createdAt: input.now,
      updatedAt: input.now,
      completedAt: null,
    },
    rule: {
      ...input.recurrenceRule,
      itemId: generatedItemId,
      nextOccurrenceAt,
      updatedAt: input.now,
    },
  };
}

function collectSubtreeItems(items: ItemRecord[], rootId: string): ItemRecord[] {
  const ids = new Set(collectSubtreeIds(items, rootId));
  return items.filter((item) => ids.has(item.id));
}

function findNextMilestone(
  items: ItemRecord[]
): { title: string; date: string } | null {
  const milestones = items
    .filter((item) => item.type === "milestone" && item.status !== "done" && item.status !== "archived")
    .map((item) => ({
      title: item.title,
      date: getEffectiveDate(item),
    }))
    .filter((item): item is { title: string; date: string } => Boolean(item.date))
    .sort((left, right) => left.date.localeCompare(right.date));

  return milestones[0] ?? null;
}

function isOverdue(item: ItemRecord, todayStart: Date): boolean {
  if (item.status === "done" || item.status === "archived") {
    return false;
  }

  const dateText = getEffectiveDate(item);
  return dateText ? parseISO(dateText) < todayStart : false;
}

function computePortfolioRiskLevel(input: {
  overdueCount: number;
  blockedCount: number;
  nextMilestoneDate: string | null;
  todayStart: Date;
}): string {
  if (input.overdueCount >= 5) {
    return "high";
  }

  if (input.overdueCount >= 1) {
    return "medium";
  }

  if (
    input.blockedCount > 0 &&
    input.nextMilestoneDate &&
    parseISO(input.nextMilestoneDate) <= addDays(input.todayStart, 7)
  ) {
    return "high";
  }

  return "normal";
}

function isScheduledOnDay(item: ItemRecord, day: Date): boolean {
  if (item.status === "archived") {
    return false;
  }

  const start = item.startDate ? parseISO(item.startDate) : null;
  const end = item.endDate ? parseISO(item.endDate) : null;
  const due = item.dueDate ? parseISO(item.dueDate) : null;

  if (start && end) {
    return start <= endOfDay(day) && end >= startOfDay(day);
  }

  return due ? isSameDay(due, day) : false;
}

function deriveDurationDays(startDate: string | null, endDate: string | null): number {
  if (!startDate || !endDate) {
    return 1;
  }

  return Math.max(differenceInCalendarDays(parseISO(endDate), parseISO(startDate)) + 1, 1);
}

function getPostponeDate(
  target: PostponeTarget,
  now: Date,
  weekStartsOn: AppSettings["weekStartsOn"]
): Date {
  switch (target) {
    case "today":
      return startOfDay(now);
    case "tomorrow":
      return startOfDay(addDays(now, 1));
    case "week_end":
      return startOfDay(endOfWeek(now, { weekStartsOn: toDateFnsWeekStartsOn(weekStartsOn) }));
  }
}

function formatDateOnly(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function toDateFnsWeekStartsOn(weekStartsOn: AppSettings["weekStartsOn"]): 0 | 1 {
  return weekStartsOn === "sunday" ? 0 : 1;
}

function stripMatchedProjectPrefix(title: string, project: ProjectSummary | null): string {
  if (!project) {
    return title;
  }

  if (title === project.name || title === project.code) {
    return title;
  }

  if (title.startsWith(`${project.name} `)) {
    return title.slice(project.name.length).trim();
  }

  if (title.startsWith(`${project.code} `)) {
    return title.slice(project.code.length).trim();
  }

  return title;
}

function resolveHierarchyMove(
  items: ItemRecord[],
  itemId: string,
  direction: "indent" | "outdent"
): { parentId: string | null; sortOrder: number } | null {
  const item = items.find((entry) => entry.id === itemId);
  if (!item) {
    return null;
  }

  if (direction === "outdent") {
    if (!item.parentId) {
      return null;
    }

    const parent = items.find((entry) => entry.id === item.parentId);
    return {
      parentId: parent?.parentId ?? null,
      sortOrder: nextSiblingSortOrder(items, parent?.parentId ?? null),
    };
  }

  const expandedIds = new Set(items.map((entry) => entry.id));
  const visibleRows = buildVisibleRows(items, expandedIds);
  const rowIndex = visibleRows.findIndex((row) => row.item.id === itemId);
  if (rowIndex <= 0) {
    return null;
  }

  const previousItem = visibleRows[rowIndex - 1]?.item;
  if (!previousItem || previousItem.type === "milestone" || previousItem.id === item.parentId) {
    return null;
  }

  return {
    parentId: previousItem.id,
    sortOrder: nextSiblingSortOrder(items, previousItem.id),
  };
}

function nextSiblingSortOrder(items: ItemRecord[], parentId: string | null): number {
  const siblings = items.filter((entry) => !entry.archived && entry.parentId === parentId);
  const maxSortOrder = siblings.reduce((max, entry) => Math.max(max, entry.sortOrder), 0);
  return maxSortOrder + 1;
}

function collectSubtreeIds(items: ItemRecord[], rootId: string): string[] {
  const childrenByParent = new Map<string | null, ItemRecord[]>();
  for (const item of items) {
    const siblings = childrenByParent.get(item.parentId) ?? [];
    siblings.push(item);
    childrenByParent.set(item.parentId, siblings);
  }

  const result: string[] = [];
  const walk = (itemId: string): void => {
    result.push(itemId);
    for (const child of childrenByParent.get(itemId) ?? []) {
      walk(child.id);
    }
  };

  walk(rootId);
  return result;
}

function resolveRescheduleDeltaDays(
  existing: ItemRecord,
  patch: UpdateItemInput
): number {
  if (patch.startDate === undefined || patch.endDate === undefined) {
    return 0;
  }

  const nextStartDate = patch.startDate;
  const nextEndDate = patch.endDate;
  if (!existing.startDate || !existing.endDate || !nextStartDate || !nextEndDate) {
    return 0;
  }

  const startDeltaDays = differenceInCalendarDays(parseISO(nextStartDate), parseISO(existing.startDate));
  const endDeltaDays = differenceInCalendarDays(parseISO(nextEndDate), parseISO(existing.endDate));
  return startDeltaDays === endDeltaDays ? startDeltaDays : 0;
}

function shiftScheduledItemDates(item: ItemRecord, deltaDays: number, updatedAt: string): ItemRecord {
  const startDate = shiftDateText(item.startDate, deltaDays);
  const endDate = shiftDateText(item.endDate, deltaDays);
  const dueDate = shiftDateText(item.dueDate, deltaDays);

  return {
    ...item,
    startDate,
    endDate,
    dueDate,
    durationDays: deriveDurationDays(startDate, endDate),
    isScheduled: Boolean(startDate && endDate),
    updatedAt,
  };
}

function shiftDateText(value: string | null, deltaDays: number): string | null {
  if (!value || deltaDays === 0) {
    return value;
  }

  return formatDateOnly(addDays(parseISO(value), deltaDays));
}

function buildDependentShiftItemsById(input: {
  itemsById: Map<string, ItemRecord>;
  projectItems: ItemRecord[];
  dependencies: DependencyRecord[];
  changedRootIds: string[];
  updatedAt: string;
  workingDayNumbers: AppSettings["workingDayNumbers"];
}): Map<string, ItemRecord> {
  const changedItemsById = new Map<string, ItemRecord>();
  const dependenciesByPredecessor = new Map<string, DependencyRecord[]>();
  for (const dependency of input.dependencies) {
    const bucket = dependenciesByPredecessor.get(dependency.predecessorItemId) ?? [];
    bucket.push(dependency);
    dependenciesByPredecessor.set(dependency.predecessorItemId, bucket);
  }

  const queue = [...new Set(input.changedRootIds)];
  while (queue.length > 0) {
    const predecessorId = queue.shift();
    if (!predecessorId) {
      continue;
    }

    const predecessor = input.itemsById.get(predecessorId);
    const predecessorEndDate = predecessor?.endDate ?? predecessor?.startDate;
    if (!predecessor || !predecessorEndDate) {
      continue;
    }

    for (const dependency of dependenciesByPredecessor.get(predecessorId) ?? []) {
      const successor = input.itemsById.get(dependency.successorItemId);
      if (!successor || !successor.startDate || !successor.endDate) {
        continue;
      }

      const earliestSuccessorStart = formatDateOnly(
        addWorkingDays(
          parseISO(predecessorEndDate),
          dependency.lagDays + 1,
          input.workingDayNumbers
        )
      );
      const deltaDays = differenceInCalendarDays(
        parseISO(earliestSuccessorStart),
        parseISO(successor.startDate)
      );
      if (deltaDays <= 0) {
        continue;
      }

      const subtreeItems = collectSubtreeItems(input.projectItems, successor.id);
      for (const subtreeItem of subtreeItems) {
        const currentItem = input.itemsById.get(subtreeItem.id) ?? subtreeItem;
        const shiftedItem = shiftScheduledItemDates(currentItem, deltaDays, input.updatedAt);
        input.itemsById.set(shiftedItem.id, shiftedItem);
        changedItemsById.set(shiftedItem.id, shiftedItem);
        queue.push(shiftedItem.id);
      }
    }
  }

  return changedItemsById;
}
