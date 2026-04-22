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
export const dependencyTypeSchema = z.enum(["finish_to_start"]);
export const rescheduleScopeSchema = z.enum(["single", "with_descendants", "with_dependents"]);

export const projectSummarySchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
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
});

export const projectImportPreviewSchema = z.object({
  sourcePath: z.string().nullable(),
  newCount: z.number().int().nonnegative(),
  updateCount: z.number().int().nonnegative(),
  errorCount: z.number().int().nonnegative(),
  rows: z.array(projectImportPreviewRowSchema),
});

export type ItemType = z.infer<typeof itemTypeSchema>;
export type ItemStatus = z.infer<typeof itemStatusSchema>;
export type Priority = z.infer<typeof prioritySchema>;
export type PostponeTarget = z.infer<typeof postponeTargetSchema>;
export type HierarchyMoveDirection = z.infer<typeof hierarchyMoveDirectionSchema>;
export type DependencyType = z.infer<typeof dependencyTypeSchema>;
export type RescheduleScope = z.infer<typeof rescheduleScopeSchema>;
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
export type ProjectExportResult = z.infer<typeof projectExportResultSchema>;
export type ProjectImportCommitResult = z.infer<typeof projectImportCommitResultSchema>;
export type ImportPreviewAction = z.infer<typeof importPreviewActionSchema>;
export type ProjectImportPreviewIssue = z.infer<typeof projectImportPreviewIssueSchema>;
export type ProjectImportPreviewWarning = z.infer<typeof projectImportPreviewWarningSchema>;
export type ProjectImportPreviewRow = z.infer<typeof projectImportPreviewRowSchema>;
export type ProjectImportPreview = z.infer<typeof projectImportPreviewSchema>;

export interface RendererApi {
  home: {
    getSummary: () => Promise<HomeSummary>;
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
  };
  quickCapture: {
    create: (input: QuickCaptureInput) => Promise<ItemRecord>;
  };
}
