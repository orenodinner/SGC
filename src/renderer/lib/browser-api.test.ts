import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deriveRecurringOccurrenceEndDate } from "../../domain/recurrence";
import { exportProjectWorkbookXlsx } from "../../infra/excel/project-workbook-export";
import { buildRoundTripWorkbookFixture } from "../../test/excel-roundtrip-fixtures";
import { browserApi } from "./browser-api";

describe("browserApi import preview fallback", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("uses the browser file picker to build import preview", async () => {
    const project = await browserApi.projects.create({
      name: `Browser Preview ${crypto.randomUUID()}`,
    });
    const createdItem = await browserApi.items.create({
      projectId: project.id,
      title: `Existing Task ${crypto.randomUUID()}`,
      type: "task",
    });
    const detail = await browserApi.projects.get(project.id);
    const workbookBytes = exportProjectWorkbookXlsx({
      project: detail.project,
      items: detail.items,
      dependencies: [],
    });
    const showOpenFilePicker = vi.fn().mockResolvedValue([
      {
        getFile: async () =>
          new File([workbookBytes], "preview.xlsx", {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          }),
      },
    ]);
    vi.stubGlobal("window", {
      showOpenFilePicker,
    } as unknown as Window);

    const preview = await browserApi.projects.previewImport(project.id);

    expect(showOpenFilePicker).toHaveBeenCalledTimes(1);
    expect(preview).not.toBeNull();
    expect(preview?.sourcePath).toBeNull();
    expect(preview?.supportsDependencyImport).toBe(true);
    expect(preview?.updateCount).toBeGreaterThan(0);
    expect(
      preview?.rows.some((row) => row.recordId === createdItem.id && row.action === "update")
    ).toBe(true);
  });

  it("returns null when the browser file picker is canceled", async () => {
    const project = await browserApi.projects.create({
      name: `Browser Cancel ${crypto.randomUUID()}`,
    });
    const abortError = Object.assign(new Error("Canceled"), { name: "AbortError" });
    const showOpenFilePicker = vi.fn().mockRejectedValue(abortError);
    vi.stubGlobal("window", {
      showOpenFilePicker,
    } as unknown as Window);

    await expect(browserApi.projects.previewImport(project.id)).resolves.toBeNull();
    expect(showOpenFilePicker).toHaveBeenCalledTimes(1);
  });

  it("gets and updates app settings in browser fallback", async () => {
    const original = await browserApi.settings.get();

    try {
      const updated = await browserApi.settings.update({
        language: "en",
        theme: "dark",
        autoBackupEnabled: false,
        autoBackupRetentionLimit: 3,
        excelDefaultPriority: "critical",
        excelDefaultAssignee: "佐藤",
        weekStartsOn: "sunday",
        fyStartMonth: 7,
        workingDayNumbers: [0, 1, 2, 3, 4],
        defaultView: "roadmap",
      });

      expect(updated).toMatchObject({
        language: "en",
        theme: "dark",
        autoBackupEnabled: false,
        autoBackupRetentionLimit: 3,
        excelDefaultPriority: "critical",
        excelDefaultAssignee: "佐藤",
        weekStartsOn: "sunday",
        fyStartMonth: 7,
        workingDayNumbers: [0, 1, 2, 3, 4],
        defaultView: "roadmap",
      });
      await expect(browserApi.settings.get()).resolves.toMatchObject({
        language: "en",
        theme: "dark",
        autoBackupEnabled: false,
        autoBackupRetentionLimit: 3,
        excelDefaultPriority: "critical",
        excelDefaultAssignee: "佐藤",
        weekStartsOn: "sunday",
        fyStartMonth: 7,
        workingDayNumbers: [0, 1, 2, 3, 4],
        defaultView: "roadmap",
      });
    } finally {
      await browserApi.settings.update({
        language: original.language,
        theme: original.theme,
        autoBackupEnabled: original.autoBackupEnabled,
        autoBackupRetentionLimit: original.autoBackupRetentionLimit,
        excelDefaultPriority: original.excelDefaultPriority,
        excelDefaultAssignee: original.excelDefaultAssignee,
        weekStartsOn: original.weekStartsOn,
        fyStartMonth: original.fyStartMonth,
        workingDayNumbers: original.workingDayNumbers,
        defaultView: original.defaultView,
      });
    }
  });

  it("reorders sibling rows while preserving subtree in browser fallback", async () => {
    const project = await browserApi.projects.create({
      name: `Browser Reorder ${crypto.randomUUID()}`,
      code: `BRW-${crypto.randomUUID().slice(0, 6)}`,
    });
    const rootA = await browserApi.items.create({
      projectId: project.id,
      title: `Root A ${crypto.randomUUID()}`,
      type: "group",
    });
    const rootB = await browserApi.items.create({
      projectId: project.id,
      title: `Root B ${crypto.randomUUID()}`,
      type: "group",
    });
    await browserApi.items.create({
      projectId: project.id,
      parentId: rootB.id,
      title: `Child B-1 ${crypto.randomUUID()}`,
      type: "task",
    });
    const rootC = await browserApi.items.create({
      projectId: project.id,
      title: `Root C ${crypto.randomUUID()}`,
      type: "task",
    });

    await browserApi.items.reorderRow({
      itemId: rootB.id,
      targetItemId: rootA.id,
      placement: "before",
    });

    const detail = await browserApi.projects.get(project.id);
    expect(detail.items.find((item) => item.id === rootB.id)?.wbsCode).toBe("1");
    expect(detail.items.find((item) => item.id === rootA.id)?.wbsCode).toBe("2");
    expect(detail.items.find((item) => item.id === rootC.id)?.wbsCode).toBe("3");
    expect(
      detail.items.find((item) => item.parentId === rootB.id)?.wbsCode
    ).toBe("1.1");
  });

  it("builds a restore preview from a browser backup snapshot", async () => {
    vi.setSystemTime(new Date("2026-04-23T00:00:00.000Z"));
    const existingProjects = await browserApi.projects.list();
    const existingProjectDetails = await Promise.all(
      existingProjects.map((entry) => browserApi.projects.get(entry.id))
    );
    const existingItemCount = existingProjectDetails.reduce(
      (count, detail) => count + detail.items.length,
      0
    );
    const project = await browserApi.projects.create({
      name: `Browser Backup ${crypto.randomUUID()}`,
      code: `BRW-${crypto.randomUUID().slice(0, 6)}`,
    });
    const item = await browserApi.items.create({
      projectId: project.id,
      title: `Backup Task ${crypto.randomUUID()}`,
      type: "task",
    });
    await browserApi.items.update({
      id: item.id,
      startDate: "2026-04-24",
      endDate: "2026-04-25",
    });

    const createObjectURL = vi.fn().mockReturnValue("blob:backup-preview");
    const revokeObjectURL = vi.fn();
    const click = vi.fn();
    vi.stubGlobal("URL", {
      createObjectURL,
      revokeObjectURL,
    });
    vi.stubGlobal("document", {
      body: {
        appendChild: vi.fn(),
      },
      createElement: vi.fn(() => ({
        click,
      })),
    });

    const backup = await browserApi.backups.create();
    const preview = await browserApi.backups.preview(backup);

    expect(click).toHaveBeenCalledTimes(1);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:backup-preview");
    expect(preview).toMatchObject({
      fileName: backup.fileName,
      projectCount: existingProjects.length + 1,
      itemCount: existingItemCount + 1,
      latestUpdatedAt: expect.any(String),
    });
  });

  it("restores a browser backup snapshot and creates a safety backup", async () => {
    vi.setSystemTime(new Date("2026-04-23T00:30:00.000Z"));
    const project = await browserApi.projects.create({
      name: `Browser Restore ${crypto.randomUUID()}`,
      code: `BRS-${crypto.randomUUID().slice(0, 6)}`,
    });
    await browserApi.items.create({
      projectId: project.id,
      title: `Browser Restore Task ${crypto.randomUUID()}`,
      type: "task",
    });

    const createObjectURL = vi.fn().mockReturnValue("blob:restore-backup");
    const revokeObjectURL = vi.fn();
    const click = vi.fn();
    vi.stubGlobal("URL", {
      createObjectURL,
      revokeObjectURL,
    });
    vi.stubGlobal("document", {
      body: {
        appendChild: vi.fn(),
      },
      createElement: vi.fn(() => ({
        click,
      })),
    });

    const backup = await browserApi.backups.create();
    const afterProject = await browserApi.projects.create({
      name: `Browser After Restore ${crypto.randomUUID()}`,
      code: `BAR-${crypto.randomUUID().slice(0, 6)}`,
    });
    await browserApi.items.create({
      projectId: afterProject.id,
      title: `After Restore Task ${crypto.randomUUID()}`,
      type: "task",
    });

    const result = await browserApi.backups.restore(backup);
    const projects = await browserApi.projects.list();

    expect(result.restoredBackup.fileName).toBe(backup.fileName);
    expect(result.safetyBackup.fileName).toMatch(/^sgc-safety-backup-/);
    expect(projects.some((entry) => entry.id === project.id)).toBe(true);
    expect(projects.some((entry) => entry.id === afterProject.id)).toBe(false);
  });

  it("creates one auto backup per day and prunes old auto backups only", async () => {
    const original = await browserApi.settings.get();
    const initialBackups = await browserApi.backups.list();
    const initialAutoBackupCount = initialBackups.filter((entry) =>
      entry.fileName.startsWith("sgc-auto-backup-")
    ).length;
    const createObjectURL = vi.fn().mockReturnValue("blob:auto-backup");
    const revokeObjectURL = vi.fn();
    const click = vi.fn();
    vi.stubGlobal("URL", {
      createObjectURL,
      revokeObjectURL,
    });
    vi.stubGlobal("document", {
      body: {
        appendChild: vi.fn(),
      },
      createElement: vi.fn(() => ({
        click,
      })),
    });

    try {
      await browserApi.settings.update({
        autoBackupEnabled: true,
        autoBackupRetentionLimit: 3,
      });

      for (let index = 0; index < 4; index += 1) {
        vi.setSystemTime(new Date(`2026-04-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`));
        await browserApi.backups.ensureAuto();
      }

      const manualBackup = await browserApi.backups.create();
      vi.setSystemTime(new Date("2026-04-05T09:00:00+09:00"));
      const firstRun = await browserApi.backups.ensureAuto();
      vi.setSystemTime(new Date("2026-04-05T18:00:00+09:00"));
      const secondRun = await browserApi.backups.ensureAuto();
      const backups = await browserApi.backups.list();
      const autoBackupCount = backups.filter((entry) => entry.fileName.startsWith("sgc-auto-backup-")).length;

      expect(firstRun.createdBackup?.fileName).toMatch(/^sgc-auto-backup-/);
      expect(firstRun.retentionLimit).toBe(3);
      expect(secondRun.createdBackup).toBeNull();
      expect(firstRun.prunedFileNames.length).toBeGreaterThanOrEqual(1);
      expect(autoBackupCount).toBeLessThanOrEqual(Math.max(3, initialAutoBackupCount));
      expect(backups.some((entry) => entry.fileName === manualBackup.fileName)).toBe(true);
    } finally {
      await browserApi.settings.update({
        language: original.language,
        theme: original.theme,
        autoBackupEnabled: original.autoBackupEnabled,
        autoBackupRetentionLimit: original.autoBackupRetentionLimit,
        weekStartsOn: original.weekStartsOn,
        fyStartMonth: original.fyStartMonth,
        workingDayNumbers: original.workingDayNumbers,
        defaultView: original.defaultView,
      });
    }
  });

  it("skips auto backup create and prune when browser auto backup is disabled", async () => {
    const original = await browserApi.settings.get();
    const initialBackups = await browserApi.backups.list();
    const initialAutoBackupCount = initialBackups.filter((entry) =>
      entry.fileName.startsWith("sgc-auto-backup-")
    ).length;

    try {
      await browserApi.settings.update({
        autoBackupEnabled: false,
        autoBackupRetentionLimit: 3,
      });

      const result = await browserApi.backups.ensureAuto();
      const backups = await browserApi.backups.list();

      expect(result.createdBackup).toBeNull();
      expect(result.prunedFileNames).toEqual([]);
      expect(result.retentionLimit).toBe(3);
      expect(backups.filter((entry) => entry.fileName.startsWith("sgc-auto-backup-"))).toHaveLength(
        initialAutoBackupCount
      );
    } finally {
      await browserApi.settings.update({
        language: original.language,
        theme: original.theme,
        autoBackupEnabled: original.autoBackupEnabled,
        autoBackupRetentionLimit: original.autoBackupRetentionLimit,
        weekStartsOn: original.weekStartsOn,
        fyStartMonth: original.fyStartMonth,
        workingDayNumbers: original.workingDayNumbers,
        defaultView: original.defaultView,
      });
    }
  });

  it("commits a previewed workbook back into the current project", async () => {
    const project = await browserApi.projects.create({
      name: `Browser Commit ${crypto.randomUUID()}`,
    });
    const createdItem = await browserApi.items.create({
      projectId: project.id,
      title: `Existing Commit Task ${crypto.randomUUID()}`,
      type: "task",
    });
    const predecessorItem = await browserApi.items.create({
      projectId: project.id,
      title: `Existing Browser Predecessor ${crypto.randomUUID()}`,
      type: "task",
    });
    const detail = await browserApi.projects.get(project.id);
    const exportedWorkbookBytes = exportProjectWorkbookXlsx({
      project: detail.project,
      items: detail.items,
      dependencies: [],
    });
    const workbookBytes = buildRoundTripWorkbookFixture({
      exportedWorkbookBytes,
      mutateRows: (rows) => {
        const updatedRows = rows.map((row) =>
          row.RecordId === createdItem.id
            ? {
                ...row,
                Title: "Updated Browser Commit Task",
                Tags: "#imported #browser",
                DependsOn: predecessorItem.id,
              }
            : row
        );

        return [
          ...updatedRows,
          {
            ...updatedRows[0],
            RecordId: "tmp_browser_predecessor",
            ParentRecordId: "",
            Title: "Browser Added Predecessor",
            Tags: "#new",
            DependsOn: "",
          },
          {
            ...updatedRows[0],
            RecordId: "tmp_browser_successor",
            ParentRecordId: "",
            Title: "Browser Added Task",
            Tags: "#new",
            DependsOn: "tmp_browser_predecessor",
          },
        ];
      },
    });
    const showOpenFilePicker = vi.fn().mockResolvedValue([
      {
        getFile: async () =>
          new File([workbookBytes], "commit.xlsx", {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          }),
      },
    ]);
    vi.stubGlobal("window", {
      showOpenFilePicker,
    } as unknown as Window);

    const preview = await browserApi.projects.previewImport(project.id);
    const result = await browserApi.projects.commitImport(project.id, "");
    const after = await browserApi.projects.get(project.id);
    const dependencies = await browserApi.dependencies.listByProject(project.id);

    expect(preview).not.toBeNull();
    expect(result.createdCount).toBe(2);
    expect(result.updatedCount).toBeGreaterThanOrEqual(1);
    expect(result.sourcePath).toBeNull();
    expect(after.items.some((item) => item.title === "Browser Added Task")).toBe(true);
    expect(after.items.some((item) => item.title === "Browser Added Predecessor")).toBe(true);
    const updatedItem = after.items.find((item) => item.id === createdItem.id);
    const addedTask = after.items.find((item) => item.title === "Browser Added Task");
    const addedPredecessor = after.items.find((item) => item.title === "Browser Added Predecessor");
    expect(updatedItem?.title).toBe("Updated Browser Commit Task");
    expect(updatedItem?.tags).toEqual(["imported", "browser"]);
    expect(
      dependencies.some(
        (dependency) =>
          dependency.predecessorItemId === predecessorItem.id &&
          dependency.successorItemId === createdItem.id
      )
    ).toBe(true);
    expect(addedTask).toBeDefined();
    expect(addedPredecessor).toBeDefined();
    expect(
      dependencies.some(
        (dependency) =>
          dependency.predecessorItemId === addedPredecessor?.id &&
          dependency.successorItemId === addedTask?.id
      )
    ).toBe(true);
  });

  it("persists and deletes recurrence rules in browser fallback", async () => {
    const project = await browserApi.projects.create({
      name: `Browser Recurrence ${crypto.randomUUID()}`,
    });
    const task = await browserApi.items.create({
      projectId: project.id,
      title: `Recurring Task ${crypto.randomUUID()}`,
      type: "task",
    });

    const created = await browserApi.recurrenceRules.upsert({
      itemId: task.id,
      rruleText: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO",
      nextOccurrenceAt: "2026-04-27",
    });
    const fetched = await browserApi.recurrenceRules.getByItem(task.id);
    const recurringItem = (await browserApi.projects.get(project.id)).items.find((item) => item.id === task.id);

    expect(created).toMatchObject({
      itemId: task.id,
      rruleText: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO",
      nextOccurrenceAt: "2026-04-27",
    });
    expect(fetched?.id).toBe(created.id);
    expect(recurringItem?.isRecurring).toBe(true);

    await browserApi.recurrenceRules.deleteByItem(task.id);

    const afterDelete = await browserApi.recurrenceRules.getByItem(task.id);
    const plainItem = (await browserApi.projects.get(project.id)).items.find((item) => item.id === task.id);

    expect(afterDelete).toBeNull();
    expect(plainItem?.isRecurring).toBe(false);
  });

  it("generates the next recurring occurrence in browser fallback when a recurring task is completed", async () => {
    const project = await browserApi.projects.create({
      name: `Browser Recurrence Generate ${crypto.randomUUID()}`,
    });
    const task = await browserApi.items.create({
      projectId: project.id,
      title: `Browser Weekly Review ${crypto.randomUUID()}`,
      type: "task",
    });
    await browserApi.items.update({
      id: task.id,
      startDate: "2026-04-20",
      endDate: "2026-04-22",
      assigneeName: "田中",
      note: "ブラウザ定例",
      tags: ["週次", "会議"],
    });
    await browserApi.recurrenceRules.upsert({
      itemId: task.id,
      rruleText: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO",
      nextOccurrenceAt: "2026-04-27",
    });

    const completed = await browserApi.items.update({
      id: task.id,
      status: "done",
    });
    const detail = await browserApi.projects.get(project.id);
    const generated = detail.items.find(
      (item) => item.id !== task.id && item.title === detail.items.find((entry) => entry.id === task.id)?.title
    );
    const movedRule = generated ? await browserApi.recurrenceRules.getByItem(generated.id) : null;

    expect(completed.isRecurring).toBe(false);
    expect(generated).toMatchObject({
      status: "not_started",
      startDate: "2026-04-27",
      endDate: deriveRecurringOccurrenceEndDate("2026-04-27", completed.durationDays),
      assigneeName: "田中",
      note: "ブラウザ定例",
      isRecurring: true,
      tags: expect.arrayContaining(["週次", "会議"]),
    });
    expect(await browserApi.recurrenceRules.getByItem(task.id)).toBeNull();
    expect(movedRule).toMatchObject({
      itemId: generated?.id,
      nextOccurrenceAt: "2026-05-04",
    });
  });

  it("saves and lists a WBS template in browser fallback", async () => {
    const project = await browserApi.projects.create({
      name: `Browser Template ${crypto.randomUUID()}`,
    });
    const root = await browserApi.items.create({
      projectId: project.id,
      title: "テンプレート親",
      type: "group",
    });
    const child = await browserApi.items.create({
      projectId: project.id,
      parentId: root.id,
      title: "テンプレート子",
      type: "task",
    });
    await browserApi.items.update({
      id: child.id,
      note: "テンプレート用ノート",
      tags: ["browser", "template"],
      assigneeName: "佐藤",
    });
    const archivedChild = await browserApi.items.create({
      projectId: project.id,
      parentId: root.id,
      title: "除外子",
      type: "task",
    });
    await browserApi.items.archive(archivedChild.id);

    const saved = await browserApi.templates.saveWbs({
      rootItemId: root.id,
    });
    const templates = await browserApi.templates.list();

    expect(saved).toMatchObject({
      kind: "wbs",
      name: "テンプレート親",
    });
    expect(saved.body.templateItems).toHaveLength(2);
    expect(saved.body.templateItems.some((node) => node.title === "テンプレート子")).toBe(true);
    expect(saved.body.templateItems.some((node) => node.title === "除外子")).toBe(false);
    expect(templates[0]?.id).toBe(saved.id);
  });

  it("saves and lists a project template in browser fallback", async () => {
    const project = await browserApi.projects.create({
      name: `Browser Project Template ${crypto.randomUUID()}`,
      code: `BPT-${crypto.randomUUID().slice(0, 6)}`,
    });
    const root = await browserApi.items.create({
      projectId: project.id,
      title: "親タスク",
      type: "group",
    });
    const child = await browserApi.items.create({
      projectId: project.id,
      parentId: root.id,
      title: "子タスク",
      type: "task",
    });
    await browserApi.items.update({
      id: child.id,
      note: "保存対象ノート",
      tags: ["browser", "project"],
      assigneeName: "中村",
      priority: "high",
      estimateHours: 5,
      startDate: "2026-05-12",
      endDate: "2026-05-13",
    });
    const archivedRoot = await browserApi.items.create({
      projectId: project.id,
      title: "除外ルート",
      type: "task",
    });
    await browserApi.items.archive(archivedRoot.id);

    const saved = await browserApi.templates.saveProject({
      projectId: project.id,
      name: "共通案件テンプレート",
    });
    const templates = await browserApi.templates.list();

    expect(saved.kind).toBe("project");
    if (saved.kind !== "project") {
      throw new Error("Expected project template");
    }

    expect(saved.name).toBe("共通案件テンプレート");
    expect(saved.body.projectFields).toMatchObject({
      name: project.name,
      description: "",
      ownerName: "",
      priority: "medium",
      color: "",
    });
    expect(saved.body.templateItems).toHaveLength(2);
    expect(saved.body.templateItems[0]).toMatchObject({
      parentNodeId: null,
      type: "group",
      title: "親タスク",
    });
    expect(saved.body.templateItems[1]).toMatchObject({
      title: "子タスク",
      type: "task",
      note: "保存対象ノート",
      assigneeName: "中村",
      priority: "high",
      estimateHours: 5,
      tags: expect.arrayContaining(["browser", "project"]),
    });
    expect(saved.body.templateItems.some((node) => node.title === "除外ルート")).toBe(false);
    expect(JSON.stringify(saved.body)).not.toContain("\"code\"");
    expect(templates[0]?.id).toBe(saved.id);
  });

  it("applies a project template into a new project in browser fallback", async () => {
    const sourceProject = await browserApi.projects.create({
      name: `Browser Project Source ${crypto.randomUUID()}`,
      code: `BPS-${crypto.randomUUID().slice(0, 6)}`,
    });
    const sourceDetail = await browserApi.projects.get(sourceProject.id);
    sourceDetail.project.description = "説明あり";
    sourceDetail.project.ownerName = "山田";
    sourceDetail.project.priority = "high";
    sourceDetail.project.color = "#336699";

    const root = await browserApi.items.create({
      projectId: sourceProject.id,
      title: "テンプレート親",
      type: "group",
    });
    const child = await browserApi.items.create({
      projectId: sourceProject.id,
      parentId: root.id,
      title: "テンプレート子",
      type: "task",
    });
    await browserApi.items.update({
      id: child.id,
      note: "引き継ぐノート",
      assigneeName: "佐藤",
      tags: ["browser", "template"],
      priority: "critical",
      estimateHours: 13,
      startDate: "2026-06-03",
      endDate: "2026-06-05",
      status: "done",
      percentComplete: 100,
    });

    const template = await browserApi.templates.saveProject({
      projectId: sourceProject.id,
      name: "案件テンプレート",
    });
    const applied = await browserApi.templates.applyProject({
      templateId: template.id,
    });
    const appliedRoot = applied.items.find((item) => item.title === "テンプレート親");
    const appliedChild = applied.items.find((item) => item.title === "テンプレート子");

    expect(applied.project.id).not.toBe(sourceProject.id);
    expect(applied.project.code).not.toBe(sourceProject.code);
    expect(applied.project.code).toMatch(/^PRJ-\d{3}$/);
    expect(applied.project).toMatchObject({
      name: sourceProject.name,
      description: "説明あり",
      ownerName: "山田",
      priority: "high",
      color: "#336699",
      status: "not_started",
      startDate: null,
      endDate: null,
      targetDate: null,
      progressCached: 0,
      riskLevel: "normal",
    });
    expect(appliedRoot).toMatchObject({
      parentId: null,
      wbsCode: "1",
      status: "not_started",
    });
    expect(appliedChild).toMatchObject({
      parentId: appliedRoot?.id,
      wbsCode: "1.1",
      note: "引き継ぐノート",
      assigneeName: "佐藤",
      priority: "critical",
      estimateHours: 13,
      durationDays: 3,
      tags: expect.arrayContaining(["browser", "template"]),
      status: "not_started",
      percentComplete: 0,
      actualHours: 0,
      startDate: null,
      endDate: null,
      dueDate: null,
      isScheduled: false,
      isRecurring: false,
      completedAt: null,
    });
  });

  it("applies a saved WBS template in browser fallback and resets schedule state", async () => {
    const sourceProject = await browserApi.projects.create({
      name: `Browser Template Source ${crypto.randomUUID()}`,
    });
    const root = await browserApi.items.create({
      projectId: sourceProject.id,
      title: "テンプレート親",
      type: "group",
    });
    const child = await browserApi.items.create({
      projectId: sourceProject.id,
      parentId: root.id,
      title: "テンプレート子",
      type: "task",
    });
    const grandchild = await browserApi.items.create({
      projectId: sourceProject.id,
      parentId: child.id,
      title: "テンプレート孫",
      type: "task",
    });
    await browserApi.items.update({
      id: child.id,
      note: "テンプレート用ノート",
      tags: ["template", "browser"],
      assigneeName: "佐藤",
      priority: "high",
      estimateHours: 8,
      startDate: "2026-05-01",
      endDate: "2026-05-04",
      dueDate: "2026-05-07",
      percentComplete: 40,
      actualHours: 3,
    });
    await browserApi.recurrenceRules.upsert({
      itemId: child.id,
      rruleText: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO",
      nextOccurrenceAt: "2026-05-11",
    });
    await browserApi.items.update({
      id: grandchild.id,
      note: "孫ノード",
      tags: ["leaf"],
    });

    const template = await browserApi.templates.saveWbs({
      rootItemId: root.id,
      name: "定例テンプレート",
    });

    const targetProject = await browserApi.projects.create({
      name: `Browser Template Target ${crypto.randomUUID()}`,
    });
    const existingRoot = await browserApi.items.create({
      projectId: targetProject.id,
      title: "既存ルート",
      type: "group",
    });

    const created = await browserApi.templates.applyWbs({
      templateId: template.id,
      projectId: targetProject.id,
    });
    const detail = await browserApi.projects.get(targetProject.id);
    const appliedRoot = detail.items.find((item) => item.title === "テンプレート親");
    const appliedChild = detail.items.find((item) => item.title === "テンプレート子");
    const appliedGrandchild = detail.items.find((item) => item.title === "テンプレート孫");

    expect(created).toHaveLength(3);
    expect(appliedRoot).toMatchObject({
      parentId: null,
      wbsCode: "2",
      status: "not_started",
    });
    expect(appliedChild).toMatchObject({
      parentId: appliedRoot?.id,
      wbsCode: "2.1",
      note: "テンプレート用ノート",
      tags: expect.arrayContaining(["template", "browser"]),
      assigneeName: "佐藤",
      priority: "high",
      estimateHours: 8,
      durationDays: 4,
      status: "not_started",
      percentComplete: 0,
      actualHours: 0,
      startDate: null,
      endDate: null,
      dueDate: null,
      isScheduled: false,
      isRecurring: false,
      completedAt: null,
    });
    expect(appliedGrandchild).toMatchObject({
      parentId: appliedChild?.id,
      wbsCode: "2.1.1",
      note: "孫ノード",
      tags: expect.arrayContaining(["leaf"]),
      status: "not_started",
      startDate: null,
      endDate: null,
      dueDate: null,
    });
    expect(detail.items.find((item) => item.id === existingRoot.id)?.wbsCode).toBe("1");
    expect(await browserApi.recurrenceRules.getByItem(appliedChild?.id ?? "")).toBeNull();
  });
});
