import { z } from "zod";

export const itemTypeSchema = z.enum(["group", "task", "milestone"]);
export const itemStatusSchema = z.enum([
  "not_started",
  "in_progress",
  "blocked",
  "done",
  "archived",
]);
export const prioritySchema = z.enum(["low", "medium", "high", "critical"]);
export const postponeTargetSchema = z.enum(["today", "tomorrow", "week_end"]);
export const hierarchyMoveDirectionSchema = z.enum(["indent", "outdent"]);
export const rowReorderPlacementSchema = z.enum(["before", "after"]);
export const dependencyTypeSchema = z.enum(["finish_to_start"]);
export const rescheduleScopeSchema = z.enum(["single", "with_descendants", "with_dependents"]);
export const templateKindSchema = z.enum(["wbs", "project"]);
export const appLanguageSchema = z.enum(["ja", "en"]);
export const appThemeSchema = z.enum(["light", "dark"]);
export const weekStartsOnSchema = z.enum(["monday", "sunday"]);
export const appDefaultViewSchema = z.enum(["home", "portfolio", "roadmap"]);
export const autoBackupRetentionLimitSchema = z.number().int().min(1).max(30);
export const workingDayNumberSchema = z.number().int().min(0).max(6);
export const workingDayNumbersSchema = z
  .array(workingDayNumberSchema)
  .min(1)
  .max(7)
  .refine((values) => new Set(values).size === values.length, "working day numbers must be unique");
export const appSettingsSchema = z.object({
  workspaceId: z.string(),
  language: appLanguageSchema,
  theme: appThemeSchema,
  autoBackupEnabled: z.boolean(),
  autoBackupRetentionLimit: autoBackupRetentionLimitSchema,
  excelDefaultPriority: prioritySchema,
  excelDefaultAssignee: z.string().max(80),
  weekStartsOn: weekStartsOnSchema,
  fyStartMonth: z.number().int().min(1).max(12),
  workingDayNumbers: workingDayNumbersSchema,
  defaultView: appDefaultViewSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export const updateAppSettingsInputSchema = z.object({
  language: appLanguageSchema.optional(),
  theme: appThemeSchema.optional(),
  autoBackupEnabled: z.boolean().optional(),
  autoBackupRetentionLimit: autoBackupRetentionLimitSchema.optional(),
  excelDefaultPriority: prioritySchema.optional(),
  excelDefaultAssignee: z.string().max(80).optional(),
  weekStartsOn: weekStartsOnSchema.optional(),
  fyStartMonth: z.number().int().min(1).max(12).optional(),
  workingDayNumbers: workingDayNumbersSchema.optional(),
  defaultView: appDefaultViewSchema.optional(),
});
export const recurrenceRuleSchema = z.object({
  id: z.string(),
  itemId: z.string(),
  rruleText: z.string(),
  nextOccurrenceAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export const wbsTemplateNodeSchema = z.object({
  nodeId: z.string(),
  parentNodeId: z.string().nullable(),
  type: itemTypeSchema,
  title: z.string(),
  note: z.string(),
  priority: prioritySchema,
  assigneeName: z.string(),
  tags: z.array(z.string()),
  estimateHours: z.number(),
  durationDays: z.number(),
  sortOrder: z.number(),
});
export const wbsTemplateBodySchema = z.object({
  schemaVersion: z.literal(1),
  sourceProjectId: z.string(),
  sourceRootItemId: z.string(),
  sourceRootTitle: z.string(),
  templateItems: z.array(wbsTemplateNodeSchema),
});
export const projectTemplateProjectFieldsSchema = z.object({
  name: z.string(),
  description: z.string(),
  ownerName: z.string(),
  priority: prioritySchema,
  color: z.string(),
});
export const projectTemplateBodySchema = z.object({
  schemaVersion: z.literal(1),
  sourceProjectId: z.string(),
  sourceProjectName: z.string(),
  projectFields: projectTemplateProjectFieldsSchema,
  templateItems: z.array(wbsTemplateNodeSchema),
});
const wbsTemplateRecordSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  kind: z.literal("wbs"),
  name: z.string(),
  body: wbsTemplateBodySchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
const projectTemplateRecordSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  kind: z.literal("project"),
  name: z.string(),
  body: projectTemplateBodySchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export const templateRecordSchema = z.discriminatedUnion("kind", [
  wbsTemplateRecordSchema,
  projectTemplateRecordSchema,
]);
export const upsertRecurrenceRuleInputSchema = z.object({
  itemId: z.string(),
  rruleText: z.string().trim().min(1).max(200),
  nextOccurrenceAt: z.string().nullable().optional(),
});
export const saveWbsTemplateInputSchema = z.object({
  rootItemId: z.string(),
  name: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((value) => value || undefined),
});
export const saveProjectTemplateInputSchema = z.object({
  projectId: z.string(),
  name: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((value) => value || undefined),
});
export const applyWbsTemplateInputSchema = z.object({
  templateId: z.string(),
  projectId: z.string(),
});
export const applyProjectTemplateInputSchema = z.object({
  templateId: z.string(),
});

export const projectSummarySchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  portfolioId: z.string().nullable(),
  code: z.string(),
  name: z.string(),
  description: z.string(),
  ownerName: z.string(),
  status: itemStatusSchema,
  priority: prioritySchema,
  color: z.string(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  targetDate: z.string().nullable(),
  progressCached: z.number(),
  riskLevel: z.string(),
  archived: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const itemRecordSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  projectId: z.string(),
  projectName: z.string().optional(),
  parentId: z.string().nullable(),
  wbsCode: z.string(),
  type: itemTypeSchema,
  title: z.string(),
  note: z.string(),
  status: itemStatusSchema,
  priority: prioritySchema,
  assigneeName: z.string(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  dueDate: z.string().nullable(),
  durationDays: z.number(),
  percentComplete: z.number(),
  estimateHours: z.number(),
  actualHours: z.number(),
  sortOrder: z.number(),
  isScheduled: z.boolean(),
  isRecurring: z.boolean(),
  archived: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  completedAt: z.string().nullable(),
  tags: z.array(z.string()),
});

export const projectDetailSchema = z.object({
  project: projectSummarySchema,
  items: z.array(itemRecordSchema),
});

export const createProjectInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  code: z
    .string()
    .trim()
    .max(32)
    .optional()
    .transform((value) => value || undefined),
});

export const updateProjectInputSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(1).max(120),
  code: z.string().trim().min(1).max(32),
  ownerName: z.string().trim().max(80).optional(),
});

export const createItemInputSchema = z.object({
  projectId: z.string(),
  parentId: z.string().nullable().optional(),
  title: z.string().trim().min(1).max(200),
  type: itemTypeSchema.default("task"),
});

export const updateItemInputSchema = z.object({
  id: z.string(),
  projectId: z.string().optional(),
  title: z.string().trim().min(1).max(200).optional(),
  type: itemTypeSchema.optional(),
  status: itemStatusSchema.optional(),
  priority: prioritySchema.optional(),
  percentComplete: z.number().min(0).max(100).optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  estimateHours: z.number().min(0).optional(),
  assigneeName: z.string().max(80).optional(),
  note: z.string().max(1000).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).optional(),
  rescheduleScope: rescheduleScopeSchema.optional(),
});

export const quickCaptureInputSchema = z.object({
  text: z.string().trim().min(1).max(400),
});

export const quickCaptureParseResultSchema = z.object({
  rawText: z.string(),
  title: z.string(),
  note: z.string(),
  assigneeName: z.string(),
  tags: z.array(z.string()),
  priority: prioritySchema,
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  dueDate: z.string().nullable(),
  estimateHours: z.number(),
  isScheduled: z.boolean(),
});

export const homeSummarySchema = z.object({
  inboxItems: z.array(itemRecordSchema),
  todayItems: z.array(itemRecordSchema),
  overdueItems: z.array(itemRecordSchema),
  weekMilestones: z.array(itemRecordSchema),
  recentProjects: z.array(projectSummarySchema),
});

export const portfolioProjectSummarySchema = z.object({
  id: z.string(),
  portfolioId: z.string().nullable(),
  code: z.string(),
  name: z.string(),
  ownerName: z.string(),
  status: itemStatusSchema,
  progressCached: z.number(),
  overdueCount: z.number(),
  nextMilestoneTitle: z.string().nullable(),
  nextMilestoneDate: z.string().nullable(),
  recentChangeCount7d: z.number(),
  riskLevel: z.string(),
});

export const portfolioSummarySchema = z.object({
  projects: z.array(portfolioProjectSummarySchema),
});

export const portfolioPhaseSummarySchema = z.object({
  id: z.string(),
  projectId: z.string(),
  wbsCode: z.string(),
  title: z.string(),
  status: itemStatusSchema,
  progressCached: z.number(),
  overdueCount: z.number(),
  nextMilestoneTitle: z.string().nullable(),
  nextMilestoneDate: z.string().nullable(),
  recentChangeCount7d: z.number(),
  riskLevel: z.string(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
});

export const portfolioProjectPhasesSchema = z.object({
  projectId: z.string(),
  phases: z.array(portfolioPhaseSummarySchema),
});

export const dependencyRecordSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  predecessorItemId: z.string(),
  successorItemId: z.string(),
  type: dependencyTypeSchema,
  lagDays: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const createDependencyInputSchema = z.object({
  predecessorItemId: z.string(),
  successorItemId: z.string(),
  type: dependencyTypeSchema.default("finish_to_start"),
  lagDays: z.number().int().min(-365).max(365).default(0),
});

export const bulkPostponeInputSchema = z.object({
  target: postponeTargetSchema,
});

export const hierarchyMoveInputSchema = z.object({
  itemId: z.string(),
  direction: hierarchyMoveDirectionSchema,
});
export const rowReorderInputSchema = z.object({
  itemId: z.string(),
  targetItemId: z.string(),
  placement: rowReorderPlacementSchema,
});

export const projectExportResultSchema = z.object({
  filePath: z.string().nullable(),
});

export const projectImportCommitResultSchema = z.object({
  sourcePath: z.string().nullable(),
  createdCount: z.number().int().nonnegative(),
  updatedCount: z.number().int().nonnegative(),
  skippedCount: z.number().int().nonnegative(),
});

export const importPreviewActionSchema = z.enum(["new", "update", "error"]);

export const projectImportPreviewIssueSchema = z.object({
  field: z.string(),
  message: z.string(),
});

export const projectImportPreviewWarningSchema = z.object({
  field: z.string(),
  message: z.string(),
});

export const projectImportPreviewChangeSchema = z.object({
  field: z.string(),
  before: z.string(),
  after: z.string(),
});

export const projectImportPreviewRowSchema = z.object({
  rowNumber: z.number().int().nonnegative(),
  action: importPreviewActionSchema,
  recordId: z.string(),
  projectCode: z.string(),
  projectName: z.string(),
  title: z.string(),
  message: z.string(),
  issues: z.array(projectImportPreviewIssueSchema),
  warnings: z.array(projectImportPreviewWarningSchema),
  changes: z.array(projectImportPreviewChangeSchema),
});

export const projectImportPreviewSchema = z.object({
  sourcePath: z.string().nullable(),
  supportsDependencyImport: z.boolean(),
  newCount: z.number().int().nonnegative(),
  updateCount: z.number().int().nonnegative(),
  errorCount: z.number().int().nonnegative(),
  rows: z.array(projectImportPreviewRowSchema),
});

export const backupEntrySchema = z.object({
  filePath: z.string().nullable(),
  fileName: z.string(),
  createdAt: z.string(),
  sizeBytes: z.number().int().nonnegative(),
});

export const backupPreviewSchema = backupEntrySchema.extend({
  projectCount: z.number().int().nonnegative(),
  itemCount: z.number().int().nonnegative(),
  latestUpdatedAt: z.string().nullable(),
});

export const backupRestoreResultSchema = z.object({
  restoredBackup: backupEntrySchema,
  safetyBackup: backupEntrySchema,
});

export const backupAutoResultSchema = z.object({
  createdBackup: backupEntrySchema.nullable(),
  prunedFileNames: z.array(z.string()),
  retentionLimit: z.number().int().positive(),
});

export const textBackupResultSchema = z.object({
  directoryPath: z.string(),
  createdAt: z.string(),
  fileNames: z.array(z.string()),
  gitAvailable: z.boolean(),
  gitCommitted: z.boolean(),
  commitSha: z.string().nullable(),
  warning: z.string().nullable(),
});

export const startupContextSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("normal"),
  }),
  z.object({
    mode: z.literal("recovery"),
    errorMessage: z.string(),
    recentBackups: z.array(backupEntrySchema),
  }),
]);

export type ItemType = z.infer<typeof itemTypeSchema>;
export type ItemStatus = z.infer<typeof itemStatusSchema>;
export type Priority = z.infer<typeof prioritySchema>;
export type PostponeTarget = z.infer<typeof postponeTargetSchema>;
export type HierarchyMoveDirection = z.infer<typeof hierarchyMoveDirectionSchema>;
export type RowReorderPlacement = z.infer<typeof rowReorderPlacementSchema>;
export type DependencyType = z.infer<typeof dependencyTypeSchema>;
export type RescheduleScope = z.infer<typeof rescheduleScopeSchema>;
export type TemplateKind = z.infer<typeof templateKindSchema>;
export type AppLanguage = z.infer<typeof appLanguageSchema>;
export type AppTheme = z.infer<typeof appThemeSchema>;
export type WeekStartsOn = z.infer<typeof weekStartsOnSchema>;
export type AppDefaultView = z.infer<typeof appDefaultViewSchema>;
export type WorkingDayNumber = z.infer<typeof workingDayNumberSchema>;
export type AppSettings = z.infer<typeof appSettingsSchema>;
export type UpdateAppSettingsInput = z.infer<typeof updateAppSettingsInputSchema>;
export type RecurrenceRule = z.infer<typeof recurrenceRuleSchema>;
export type WbsTemplateNode = z.infer<typeof wbsTemplateNodeSchema>;
export type WbsTemplateBody = z.infer<typeof wbsTemplateBodySchema>;
export type ProjectTemplateProjectFields = z.infer<typeof projectTemplateProjectFieldsSchema>;
export type ProjectTemplateBody = z.infer<typeof projectTemplateBodySchema>;
export type TemplateRecord = z.infer<typeof templateRecordSchema>;
export type UpsertRecurrenceRuleInput = z.infer<typeof upsertRecurrenceRuleInputSchema>;
export type SaveWbsTemplateInput = z.infer<typeof saveWbsTemplateInputSchema>;
export type SaveProjectTemplateInput = z.infer<typeof saveProjectTemplateInputSchema>;
export type ApplyWbsTemplateInput = z.infer<typeof applyWbsTemplateInputSchema>;
export type ApplyProjectTemplateInput = z.infer<typeof applyProjectTemplateInputSchema>;
export type ProjectSummary = z.infer<typeof projectSummarySchema>;
export type ItemRecord = z.infer<typeof itemRecordSchema>;
export type ProjectDetail = z.infer<typeof projectDetailSchema>;
export type CreateProjectInput = z.infer<typeof createProjectInputSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectInputSchema>;
export type CreateItemInput = z.infer<typeof createItemInputSchema>;
export type UpdateItemInput = z.infer<typeof updateItemInputSchema>;
export type QuickCaptureInput = z.infer<typeof quickCaptureInputSchema>;
export type QuickCaptureParseResult = z.infer<typeof quickCaptureParseResultSchema>;
export type HomeSummary = z.infer<typeof homeSummarySchema>;
export type PortfolioProjectSummary = z.infer<typeof portfolioProjectSummarySchema>;
export type PortfolioSummary = z.infer<typeof portfolioSummarySchema>;
export type PortfolioPhaseSummary = z.infer<typeof portfolioPhaseSummarySchema>;
export type PortfolioProjectPhases = z.infer<typeof portfolioProjectPhasesSchema>;
export type DependencyRecord = z.infer<typeof dependencyRecordSchema>;
export type CreateDependencyInput = z.infer<typeof createDependencyInputSchema>;
export type BulkPostponeInput = z.infer<typeof bulkPostponeInputSchema>;
export type HierarchyMoveInput = z.infer<typeof hierarchyMoveInputSchema>;
export type RowReorderInput = z.infer<typeof rowReorderInputSchema>;
export type ProjectExportResult = z.infer<typeof projectExportResultSchema>;
export type ProjectImportCommitResult = z.infer<typeof projectImportCommitResultSchema>;
export type ImportPreviewAction = z.infer<typeof importPreviewActionSchema>;
export type ProjectImportPreviewIssue = z.infer<typeof projectImportPreviewIssueSchema>;
export type ProjectImportPreviewWarning = z.infer<typeof projectImportPreviewWarningSchema>;
export type ProjectImportPreviewChange = z.infer<typeof projectImportPreviewChangeSchema>;
export type ProjectImportPreviewRow = z.infer<typeof projectImportPreviewRowSchema>;
export type ProjectImportPreview = z.infer<typeof projectImportPreviewSchema>;
export type BackupEntry = z.infer<typeof backupEntrySchema>;
export type BackupPreview = z.infer<typeof backupPreviewSchema>;
export type BackupRestoreResult = z.infer<typeof backupRestoreResultSchema>;
export type BackupAutoResult = z.infer<typeof backupAutoResultSchema>;
export type TextBackupResult = z.infer<typeof textBackupResultSchema>;
export type StartupContext = z.infer<typeof startupContextSchema>;

export interface RendererApi {
  settings: {
    get: () => Promise<AppSettings>;
    update: (input: UpdateAppSettingsInput) => Promise<AppSettings>;
  };
  home: {
    getSummary: () => Promise<HomeSummary>;
  };
  system: {
    getStartupContext: () => Promise<StartupContext>;
  };
  backups: {
    list: () => Promise<BackupEntry[]>;
    create: () => Promise<BackupEntry>;
    createText: () => Promise<TextBackupResult>;
    ensureAuto: () => Promise<BackupAutoResult>;
    preview: (entry: BackupEntry) => Promise<BackupPreview>;
    restore: (entry: BackupEntry) => Promise<BackupRestoreResult>;
  };
  portfolio: {
    getSummary: () => Promise<PortfolioSummary>;
    getProjectPhases: (projectId: string) => Promise<PortfolioProjectPhases>;
  };
  dependencies: {
    listByProject: (projectId: string) => Promise<DependencyRecord[]>;
    create: (input: CreateDependencyInput) => Promise<DependencyRecord>;
    delete: (dependencyId: string) => Promise<void>;
  };
  templates: {
    list: () => Promise<TemplateRecord[]>;
    saveWbs: (input: SaveWbsTemplateInput) => Promise<TemplateRecord>;
    saveProject: (input: SaveProjectTemplateInput) => Promise<TemplateRecord>;
    applyWbs: (input: ApplyWbsTemplateInput) => Promise<ItemRecord[]>;
    applyProject: (input: ApplyProjectTemplateInput) => Promise<ProjectDetail>;
  };
  recurrenceRules: {
    getByItem: (itemId: string) => Promise<RecurrenceRule | null>;
    upsert: (input: UpsertRecurrenceRuleInput) => Promise<RecurrenceRule>;
    deleteByItem: (itemId: string) => Promise<void>;
  };
  projects: {
    list: () => Promise<ProjectSummary[]>;
    create: (input: CreateProjectInput) => Promise<ProjectSummary>;
    update: (input: UpdateProjectInput) => Promise<ProjectSummary>;
    get: (projectId: string) => Promise<ProjectDetail>;
    exportWorkbook: (projectId: string) => Promise<ProjectExportResult>;
    previewImport: (projectId: string) => Promise<ProjectImportPreview | null>;
    commitImport: (
      projectId: string,
      sourcePath: string
    ) => Promise<ProjectImportCommitResult>;
  };
  items: {
    create: (input: CreateItemInput) => Promise<ItemRecord>;
    update: (input: UpdateItemInput) => Promise<ItemRecord>;
    archive: (itemId: string) => Promise<void>;
    bulkPostponeOverdue: (input: BulkPostponeInput) => Promise<ItemRecord[]>;
    moveHierarchy: (input: HierarchyMoveInput) => Promise<ItemRecord>;
    reorderRow: (input: RowReorderInput) => Promise<ItemRecord>;
  };
  quickCapture: {
    create: (input: QuickCaptureInput) => Promise<ItemRecord>;
  };
}
