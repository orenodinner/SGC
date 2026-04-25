import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DatabaseManager } from "../../infra/db/database";
import { EXCEL_TASKS_SHEET_COLUMNS } from "../../domain/excel-contract";
import { deriveRecurringOccurrenceEndDate } from "../../domain/recurrence";
import { exportWorkbookXlsx } from "../../infra/excel/xlsx-writer";
import { readStoredZipEntries } from "../../test/zip-test-utils";
import { buildRoundTripWorkbookFixture } from "../../test/excel-roundtrip-fixtures";
import { WorkspaceService } from "./workspace-service";

describe("WorkspaceService quick capture", () => {
  let tempDir: string;
  let dbPath: string;
  let manager: DatabaseManager;
  let service: WorkspaceService;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sgc-service-"));
    dbPath = path.join(tempDir, "data", "sgc.sqlite");
    manager = new DatabaseManager(dbPath);
    await manager.initialize();
    service = new WorkspaceService(manager);
  });

  afterEach(() => {
    vi.useRealTimers();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("creates a scheduled task with tags and assignee from quick capture", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-21T09:00:00+09:00"));

    const item = service.createQuickCapture({
      text: "見積提出 4/25 #営業 @自分",
    });

    expect(item.title).toBe("見積提出");
    expect(item.startDate).toBe("2026-04-25");
    expect(item.endDate).toBe("2026-04-25");
    expect(item.tags).toEqual(["営業"]);
    expect(item.assigneeName).toBe("自分");
    expect(item.isScheduled).toBe(true);
  });

  it("keeps undated quick capture in inbox", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-21T09:00:00+09:00"));

    const item = service.createQuickCapture({
      text: "アイデア整理",
    });
    const home = service.getHomeSummary();

    expect(item.isScheduled).toBe(false);
    expect(home.inboxItems.map((entry) => entry.title)).toContain("アイデア整理");
  });

  it("bulk postpones overdue items to today", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-21T09:00:00+09:00"));

    const project = service.createProject({
      name: "A案件",
      code: "PRJ-A",
    });

    service.createQuickCapture({ text: "A案件 見積提出 4/18" });
    service.createQuickCapture({ text: "A案件 設計レビュー 4/19" });
    service.createQuickCapture({ text: "PRJ-A 障害調査 4/20" });

    const result = service.bulkPostponeOverdue({ target: "today" });
    const home = service.getHomeSummary();

    expect(result).toHaveLength(3);
    expect(result.every((item) => item.endDate === "2026-04-21")).toBe(true);
    expect(home.overdueItems).toHaveLength(0);

    const refreshed = service.getProjectDetail(project.id);
    expect(refreshed.items.map((item) => item.endDate)).toEqual([
      "2026-04-21",
      "2026-04-21",
      "2026-04-21",
    ]);
  });

  it("indents and outdents items while preserving subtree and WBS codes", () => {
    const project = service.createProject({
      name: "階層テスト",
      code: "PRJ-H",
    });

    const rootA = service.createItem({
      projectId: project.id,
      title: "Root A",
      type: "group",
    });
    const rootB = service.createItem({
      projectId: project.id,
      title: "Root B",
      type: "group",
    });
    const childOfB = service.createItem({
      projectId: project.id,
      parentId: rootB.id,
      title: "Child B-1",
      type: "task",
    });

    const moved = service.moveItemHierarchy({
      itemId: rootB.id,
      direction: "indent",
    });
    const afterIndent = service.getProjectDetail(project.id);

    expect(moved.parentId).toBe(rootA.id);
    expect(afterIndent.items.find((item) => item.id === rootB.id)?.wbsCode).toBe("1.1");
    expect(afterIndent.items.find((item) => item.id === childOfB.id)?.wbsCode).toBe("1.1.1");

    const outdented = service.moveItemHierarchy({
      itemId: rootB.id,
      direction: "outdent",
    });
    const afterOutdent = service.getProjectDetail(project.id);

    expect(outdented.parentId).toBeNull();
    expect(afterOutdent.items.find((item) => item.id === rootA.id)?.wbsCode).toBe("1");
    expect(afterOutdent.items.find((item) => item.id === rootB.id)?.wbsCode).toBe("2");
    expect(afterOutdent.items.find((item) => item.id === childOfB.id)?.wbsCode).toBe("2.1");
  });

  it("reorders sibling rows while preserving subtree and recalculating WBS codes", () => {
    const project = service.createProject({
      name: "並び替えテスト",
      code: "PRJ-R",
    });

    const rootA = service.createItem({
      projectId: project.id,
      title: "Root A",
      type: "group",
    });
    const rootB = service.createItem({
      projectId: project.id,
      title: "Root B",
      type: "group",
    });
    const childOfB = service.createItem({
      projectId: project.id,
      parentId: rootB.id,
      title: "Child B-1",
      type: "task",
    });
    const rootC = service.createItem({
      projectId: project.id,
      title: "Root C",
      type: "task",
    });

    const reordered = service.reorderItemRow({
      itemId: rootB.id,
      targetItemId: rootA.id,
      placement: "before",
    });
    const detail = service.getProjectDetail(project.id);

    expect(reordered.wbsCode).toBe("1");
    expect(detail.items.find((item) => item.id === rootB.id)?.wbsCode).toBe("1");
    expect(detail.items.find((item) => item.id === childOfB.id)?.wbsCode).toBe("1.1");
    expect(detail.items.find((item) => item.id === rootA.id)?.wbsCode).toBe("2");
    expect(detail.items.find((item) => item.id === rootC.id)?.wbsCode).toBe("3");
  });

  it("updates note and tags for detail drawer edits", () => {
    const project = service.createProject({
      name: "詳細編集",
      code: "PRJ-D",
    });

    const item = service.createItem({
      projectId: project.id,
      title: "仕様確認",
      type: "task",
    });

    const updated = service.updateItem({
      id: item.id,
      note: "顧客向けの確認事項を整理する",
      tags: ["確認", "顧客", "確認"],
    });

    expect(updated.note).toBe("顧客向けの確認事項を整理する");
    expect([...updated.tags].sort()).toEqual(["確認", "顧客"]);

    const refreshed = service.getProjectDetail(project.id);
    expect(refreshed.items.find((entry) => entry.id === item.id)).toMatchObject({
      note: "顧客向けの確認事項を整理する",
      tags: expect.arrayContaining(["確認", "顧客"]),
    });
  });

  it("assigns an inbox item to a project", () => {
    const targetProject = service.createProject({
      name: "移動先",
      code: "PRJ-M",
    });

    const inboxItem = service.createQuickCapture({
      text: "未整理タスク",
    });

    const updated = service.updateItem({
      id: inboxItem.id,
      projectId: targetProject.id,
    });
    const home = service.getHomeSummary();
    const targetDetail = service.getProjectDetail(targetProject.id);

    expect(updated.projectId).toBe(targetProject.id);
    expect(updated.parentId).toBeNull();
    expect(home.inboxItems.find((item) => item.id === inboxItem.id)).toBeUndefined();
    expect(targetDetail.items.find((item) => item.id === inboxItem.id)?.title).toBe("未整理タスク");
  });

  it("adds a date to an inbox item and surfaces it in today", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-21T09:00:00+09:00"));

    const inboxItem = service.createQuickCapture({
      text: "当日整理タスク",
    });

    const updated = service.updateItem({
      id: inboxItem.id,
      startDate: "2026-04-21",
      endDate: "2026-04-21",
    });
    const home = service.getHomeSummary();

    expect(updated.startDate).toBe("2026-04-21");
    expect(updated.endDate).toBe("2026-04-21");
    expect(updated.isScheduled).toBe(true);
    expect(home.inboxItems.find((item) => item.id === inboxItem.id)).toBeUndefined();
    expect(home.todayItems.find((item) => item.id === inboxItem.id)?.title).toBe("当日整理タスク");
  });

  it("adds tags to an inbox item and keeps it in inbox", () => {
    const inboxItem = service.createQuickCapture({
      text: "タグ整理タスク",
    });

    const updated = service.updateItem({
      id: inboxItem.id,
      tags: ["設計", "顧客", "設計"],
    });
    const home = service.getHomeSummary();

    expect([...updated.tags].sort()).toEqual(["設計", "顧客"]);
    expect(updated.isScheduled).toBe(false);
    expect(home.inboxItems.find((item) => item.id === inboxItem.id)).toMatchObject({
      title: "タグ整理タスク",
      tags: expect.arrayContaining(["設計", "顧客"]),
    });
  });

  it("persists app settings and reloads them from storage", () => {
    const defaults = service.getAppSettings();
    expect(defaults).toMatchObject({
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
    });

    const updated = service.updateAppSettings({
      language: "en",
      theme: "dark",
      autoBackupEnabled: false,
      autoBackupRetentionLimit: 3,
      excelDefaultPriority: "high",
      excelDefaultAssignee: "田中",
      weekStartsOn: "sunday",
      fyStartMonth: 7,
      workingDayNumbers: [0, 1, 2, 3, 4],
      defaultView: "roadmap",
    });
    const reloadedService = new WorkspaceService(manager);

    expect(updated).toMatchObject({
      language: "en",
      theme: "dark",
      autoBackupEnabled: false,
      autoBackupRetentionLimit: 3,
      excelDefaultPriority: "high",
      excelDefaultAssignee: "田中",
      weekStartsOn: "sunday",
      fyStartMonth: 7,
      workingDayNumbers: [0, 1, 2, 3, 4],
      defaultView: "roadmap",
    });
    expect(reloadedService.getAppSettings()).toMatchObject({
      language: "en",
      theme: "dark",
      autoBackupEnabled: false,
      autoBackupRetentionLimit: 3,
      excelDefaultPriority: "high",
      excelDefaultAssignee: "田中",
      weekStartsOn: "sunday",
      fyStartMonth: 7,
      workingDayNumbers: [0, 1, 2, 3, 4],
      defaultView: "roadmap",
    });
  });

  it("reflects week start settings in home week milestones", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-24T09:00:00+09:00"));

    const project = service.createProject({
      name: "設定反映",
      code: "PRJ-SET",
    });
    const milestone = service.createItem({
      projectId: project.id,
      title: "週初マイルストーン",
      type: "milestone",
    });
    service.updateItem({
      id: milestone.id,
      startDate: "2026-04-19",
      endDate: "2026-04-19",
    });

    expect(service.getHomeSummary().weekMilestones).toHaveLength(0);

    service.updateAppSettings({
      weekStartsOn: "sunday",
    });

    expect(service.getHomeSummary().weekMilestones.map((item) => item.title)).toContain(
      "週初マイルストーン"
    );
  });

  it("persists a recurrence rule per task item and syncs isRecurring", () => {
    const project = service.createProject({
      name: "繰り返し案件",
      code: "PRJ-RRULE",
    });
    const task = service.createItem({
      projectId: project.id,
      title: "週次確認",
      type: "task",
    });

    const created = service.upsertRecurrenceRule({
      itemId: task.id,
      rruleText: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO",
      nextOccurrenceAt: "2026-04-27",
    });
    const fetched = service.getRecurrenceRuleByItem(task.id);
    const recurringItem = service.getProjectDetail(project.id).items.find((item) => item.id === task.id);

    expect(created).toMatchObject({
      itemId: task.id,
      rruleText: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO",
      nextOccurrenceAt: "2026-04-27",
    });
    expect(fetched).toMatchObject({
      id: created.id,
      itemId: task.id,
    });
    expect(recurringItem?.isRecurring).toBe(true);

    service.deleteRecurrenceRuleByItem(task.id);

    const afterDelete = service.getRecurrenceRuleByItem(task.id);
    const plainItem = service.getProjectDetail(project.id).items.find((item) => item.id === task.id);

    expect(afterDelete).toBeNull();
    expect(plainItem?.isRecurring).toBe(false);
  });

  it("rejects recurrence rules for group, milestone, and archived items", () => {
    const project = service.createProject({
      name: "繰り返し制約",
      code: "PRJ-RRULE-INVALID",
    });
    const group = service.createItem({
      projectId: project.id,
      title: "親グループ",
      type: "group",
    });
    const milestone = service.createItem({
      projectId: project.id,
      title: "月初締め",
      type: "milestone",
    });
    const archivedTask = service.createItem({
      projectId: project.id,
      title: "アーカイブ済み",
      type: "task",
    });
    service.archiveItem(archivedTask.id);

    expect(() =>
      service.upsertRecurrenceRule({
        itemId: group.id,
        rruleText: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO",
      })
    ).toThrow("Recurrence rules are supported for task items only");
    expect(() =>
      service.upsertRecurrenceRule({
        itemId: milestone.id,
        rruleText: "FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=1",
      })
    ).toThrow("Recurrence rules are supported for task items only");
    expect(() =>
      service.upsertRecurrenceRule({
        itemId: archivedTask.id,
        rruleText: "FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR",
      })
    ).toThrow("Recurrence rules cannot be attached to archived items");
  });

  it("generates the next recurring occurrence when a recurring task is completed", () => {
    const project = service.createProject({
      name: "繰り返し生成案件",
      code: "PRJ-RECUR-GEN",
    });
    const task = service.createItem({
      projectId: project.id,
      title: "週次レビュー",
      type: "task",
    });
    service.updateItem({
      id: task.id,
      startDate: "2026-04-20",
      endDate: "2026-04-22",
      assigneeName: "田中",
      note: "定例レビュー",
      tags: ["週次", "会議"],
    });
    service.upsertRecurrenceRule({
      itemId: task.id,
      rruleText: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO",
      nextOccurrenceAt: "2026-04-27",
    });

    const completed = service.updateItem({
      id: task.id,
      status: "done",
    });
    const detail = service.getProjectDetail(project.id);
    const generated = detail.items.find(
      (item) => item.id !== task.id && item.title === "週次レビュー"
    );
    const movedRule = generated ? service.getRecurrenceRuleByItem(generated.id) : null;

    expect(completed.status).toBe("done");
    expect(completed.isRecurring).toBe(false);
    expect(generated).toMatchObject({
      status: "not_started",
      percentComplete: 0,
      startDate: "2026-04-27",
      endDate: deriveRecurringOccurrenceEndDate("2026-04-27", completed.durationDays),
      assigneeName: "田中",
      note: "定例レビュー",
      isRecurring: true,
      completedAt: null,
      tags: expect.arrayContaining(["週次", "会議"]),
    });
    expect(service.getRecurrenceRuleByItem(task.id)).toBeNull();
    expect(movedRule).toMatchObject({
      itemId: generated?.id,
      nextOccurrenceAt: "2026-05-04",
    });
  });

  it("saves a WBS template from a root subtree and excludes unrelated or archived items", () => {
    const project = service.createProject({
      name: "Template案件",
      code: "PRJ-TPL",
    });
    const root = service.createItem({
      projectId: project.id,
      title: "実装フェーズ",
      type: "group",
    });
    const child = service.createItem({
      projectId: project.id,
      parentId: root.id,
      title: "API実装",
      type: "task",
    });
    service.updateItem({
      id: child.id,
      note: "保存対象メモ",
      assigneeName: "田中",
      tags: ["backend", "api"],
    });
    const archivedDescendant = service.createItem({
      projectId: project.id,
      parentId: root.id,
      title: "旧タスク",
      type: "task",
    });
    service.archiveItem(archivedDescendant.id);
    service.createItem({
      projectId: project.id,
      title: "無関係な sibling",
      type: "task",
    });

    const saved = service.saveWbsTemplate({
      rootItemId: root.id,
    });
    const templates = service.listTemplates();

    expect(saved).toMatchObject({
      kind: "wbs",
      name: "実装フェーズ",
    });
    expect(saved.body).toMatchObject({
      schemaVersion: 1,
      sourceProjectId: project.id,
      sourceRootItemId: root.id,
      sourceRootTitle: "実装フェーズ",
    });
    expect(saved.body.templateItems).toHaveLength(2);
    expect(saved.body.templateItems[0]).toMatchObject({
      parentNodeId: null,
      type: "group",
      title: "実装フェーズ",
    });
    expect(saved.body.templateItems[1]).toMatchObject({
      type: "task",
      title: "API実装",
      note: "保存対象メモ",
      assigneeName: "田中",
      tags: expect.arrayContaining(["backend", "api"]),
    });
    expect(saved.body.templateItems.some((node) => node.title === "旧タスク")).toBe(false);
    expect(saved.body.templateItems.some((node) => node.title === "無関係な sibling")).toBe(false);
    expect(templates.map((template) => template.id)).toContain(saved.id);
  });

  it("saves a project template with project fields and non-archived hierarchy only", () => {
    const project = service.createProject({
      name: "Project Template案件",
      code: "PRJ-PROJTPL",
    });
    service.updateProject({
      id: project.id,
      name: "Project Template案件 改",
      code: "PRJ-PROJTPL",
    });
    const root = service.createItem({
      projectId: project.id,
      title: "親タスク",
      type: "group",
    });
    const child = service.createItem({
      projectId: project.id,
      parentId: root.id,
      title: "子タスク",
      type: "task",
    });
    service.updateItem({
      id: child.id,
      note: "保存対象ノート",
      assigneeName: "中村",
      tags: ["project", "template"],
      priority: "high",
      estimateHours: 5,
      startDate: "2026-05-12",
      endDate: "2026-05-13",
    });
    const archivedRoot = service.createItem({
      projectId: project.id,
      title: "除外ルート",
      type: "task",
    });
    service.archiveItem(archivedRoot.id);

    const saved = service.saveProjectTemplate({
      projectId: project.id,
      name: "共通案件テンプレート",
    });
    const templates = service.listTemplates();

    expect(saved.kind).toBe("project");
    if (saved.kind !== "project") {
      throw new Error("Expected project template");
    }

    expect(saved.name).toBe("共通案件テンプレート");
    expect(saved.body.projectFields).toMatchObject({
      name: "Project Template案件 改",
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
      tags: expect.arrayContaining(["project", "template"]),
    });
    expect(saved.body.templateItems.some((node) => node.title === "除外ルート")).toBe(false);
    expect(JSON.stringify(saved.body)).not.toContain("\"code\"");
    expect(templates.map((template) => template.id)).toContain(saved.id);
  });

  it("applies a project template into a new project with reset schedule and progress fields", () => {
    const sourceProject = service.createProject({
      name: "Source Template案件",
      code: "PRJ-SRC-TPL",
    });
    const projectUpdatedAt = "2026-06-01T09:00:00.000Z";
    manager.run(
      `UPDATE project
       SET description = ?, owner_name = ?, priority = ?, color = ?, updated_at = ?
       WHERE id = ?`,
      ["説明あり", "山田", "high", "#336699", projectUpdatedAt, sourceProject.id]
    );
    const root = service.createItem({
      projectId: sourceProject.id,
      title: "テンプレート親",
      type: "group",
    });
    const child = service.createItem({
      projectId: sourceProject.id,
      parentId: root.id,
      title: "テンプレート子",
      type: "task",
    });
    service.updateItem({
      id: child.id,
      note: "引き継ぐノート",
      assigneeName: "佐藤",
      tags: ["template", "project"],
      priority: "critical",
      estimateHours: 13,
      startDate: "2026-06-03",
      endDate: "2026-06-05",
      status: "done",
      percentComplete: 100,
    });
    manager.run(
      `UPDATE item
       SET actual_hours = ?, is_recurring = ?, updated_at = ?
       WHERE id = ?`,
      [9, 1, "2026-06-05T18:00:00.000Z", child.id]
    );

    const saved = service.saveProjectTemplate({
      projectId: sourceProject.id,
      name: "案件テンプレート",
    });
    const applied = service.applyProjectTemplate({
      templateId: saved.id,
    });
    const projects = service.listProjects();
    const appliedRoot = applied.items.find((item) => item.title === "テンプレート親");
    const appliedChild = applied.items.find((item) => item.title === "テンプレート子");

    expect(projects).toHaveLength(2);
    expect(applied.project).toMatchObject({
      name: "Source Template案件",
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
    expect(applied.project.id).not.toBe(sourceProject.id);
    expect(applied.project.code).not.toBe("PRJ-SRC-TPL");
    expect(applied.project.code).toMatch(/^PRJ-\d{3}$/);
    expect(appliedRoot).toMatchObject({
      parentId: null,
      wbsCode: "1",
      type: "group",
      status: "not_started",
    });
    expect(appliedChild).toMatchObject({
      parentId: appliedRoot?.id,
      wbsCode: "1.1",
      type: "task",
      note: "引き継ぐノート",
      assigneeName: "佐藤",
      priority: "critical",
      estimateHours: 13,
      durationDays: 3,
      tags: expect.arrayContaining(["template", "project"]),
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

  it("exports a project workbook as xlsx bytes", () => {
    const project = service.createProject({
      name: "Excel案件",
      code: "PRJ-X",
    });
    const item = service.createItem({
      projectId: project.id,
      title: "基本設計",
      type: "task",
    });

    service.updateItem({
      id: item.id,
      startDate: "2026-04-01",
      endDate: "2026-04-10",
      assigneeName: "田中",
      percentComplete: 40,
    });

    const milestone = service.createItem({
      projectId: project.id,
      title: "レビュー完了",
      type: "milestone",
    });
    service.updateItem({
      id: milestone.id,
      startDate: "2026-04-11",
      endDate: "2026-04-11",
    });

    service.createDependency({
      predecessorItemId: item.id,
      successorItemId: milestone.id,
      lagDays: 2,
    });

    const bytes = service.exportProjectWorkbook(project.id);
    const entries = readStoredZipEntries(bytes);

    expect(Array.from(bytes.slice(0, 2))).toEqual([0x50, 0x4b]);
    expect(entries.get("xl/workbook.xml")).toContain('sheet name="Tasks"');
    expect(entries.get("xl/worksheets/sheet2.xml")).toContain("基本設計");
    expect(entries.get("xl/worksheets/sheet2.xml")).toContain("レビュー完了");
    expect(entries.get("xl/worksheets/sheet2.xml")).toContain(`${item.id}+2`);
    expect(entries.get("xl/worksheets/sheet4.xml")).toContain("Default");
    expect(entries.get("xl/worksheets/sheet4.xml")).toContain("medium");

    service.updateAppSettings({
      excelDefaultPriority: "critical",
      excelDefaultAssignee: "佐藤",
    });

    const updatedBytes = service.exportProjectWorkbook(project.id);
    const updatedEntries = readStoredZipEntries(updatedBytes);

    expect(updatedEntries.get("xl/worksheets/sheet4.xml")).toContain("critical");
    expect(updatedEntries.get("xl/worksheets/sheet4.xml")).toContain("佐藤");
  });

  it("builds import preview counts from an exported workbook", () => {
    const project = service.createProject({
      name: "Import案件",
      code: "PRJ-I",
    });
    const item = service.createItem({
      projectId: project.id,
      title: "既存タスク",
      type: "task",
    });
    service.updateItem({
      id: item.id,
      startDate: "2026-04-01",
      endDate: "2026-04-02",
    });

    const workbookBytes = service.exportProjectWorkbook(project.id);
    const preview = service.previewProjectImport({
      projectId: project.id,
      sourcePath: "C:/tmp/import.xlsx",
      workbookBytes,
    });

    expect(preview.newCount).toBe(0);
    expect(preview.updateCount).toBe(1);
    expect(preview.errorCount).toBe(0);
    expect(preview.rows[0]).toMatchObject({
      action: "update",
      title: "既存タスク",
    });
  });

  it("creates a local backup that can be opened as a standalone database", async () => {
    const project = service.createProject({
      name: "Backup案件",
      code: "PRJ-BACKUP",
    });
    service.createItem({
      projectId: project.id,
      title: "退避対象",
      type: "task",
    });

    const backup = service.createBackup();
    const backups = service.listBackups();
    const restoredManager = new DatabaseManager(backup.filePath ?? "");
    await restoredManager.initialize();
    const restoredService = new WorkspaceService(restoredManager);

    expect(backup.fileName).toMatch(/^sgc-backup-\d{8}-\d{6}-\d{3}\.sqlite$/);
    expect(fs.existsSync(backup.filePath ?? "")).toBe(true);
    expect(backups[0]?.filePath).toBe(backup.filePath);
    expect(
      restoredService.listProjects().some((entry) => entry.id === project.id && entry.name === "Backup案件")
    ).toBe(true);
    expect(
      restoredService.getProjectDetail(project.id).items.some((entry) => entry.title === "退避対象")
    ).toBe(true);
  });

  it("writes a diff-friendly text backup and commits it when git is available", () => {
    const project = service.createProject({
      name: "Text Backup案件",
      code: "PRJ-TEXT",
    });
    service.createItem({
      projectId: project.id,
      title: "テキスト退避対象",
      type: "task",
    });

    const result = service.createTextBackup({
      now: new Date("2026-04-26T10:00:00.000Z"),
    });
    const manifest = JSON.parse(
      fs.readFileSync(path.join(result.directoryPath, "manifest.json"), "utf8")
    ) as { counts: { projects: number; items: number } };
    const projectMarkdownPath = result.fileNames
      .filter((fileName) => fileName.startsWith("projects/"))
      .map((fileName) => path.join(result.directoryPath, fileName))
      .find((filePath) => fs.readFileSync(filePath, "utf8").includes("Text Backup案件"));
    expect(projectMarkdownPath).toBeTruthy();
    const projectMarkdown = fs.readFileSync(projectMarkdownPath!, "utf8");
    const gitVersionAvailable =
      spawnSync("git", ["--version"], { encoding: "utf8", windowsHide: true }).status === 0;

    expect(result.fileNames).toEqual(
      expect.arrayContaining(["manifest.json", "projects.json", "items.json"])
    );
    expect(manifest.counts.projects).toBeGreaterThanOrEqual(1);
    expect(manifest.counts.items).toBeGreaterThanOrEqual(1);
    expect(fs.readFileSync(path.join(result.directoryPath, "projects.json"), "utf8")).toContain(
      "Text Backup案件"
    );
    expect(projectMarkdown).toContain("テキスト退避対象");
    expect(result.gitAvailable).toBe(gitVersionAvailable);
    if (gitVersionAvailable) {
      expect(fs.existsSync(path.join(result.directoryPath, ".git"))).toBe(true);
      expect(result.gitCommitted).toBe(true);
      expect(result.commitSha).toMatch(/^[0-9a-f]{7,}$/);
    } else {
      expect(result.warning).toContain("git command is not available");
    }
  });

  it("builds a read-only restore preview from a local backup", async () => {
    const project = service.createProject({
      name: "Restore Preview案件",
      code: "PRJ-RESTORE-PREVIEW",
    });
    const item = service.createItem({
      projectId: project.id,
      title: "Preview対象",
      type: "task",
    });
    service.updateItem({
      id: item.id,
      startDate: "2026-04-24",
      endDate: "2026-04-25",
    });

    const backup = service.createBackup();
    const preview = await service.previewBackup(backup);
    const liveDetail = service.getProjectDetail(project.id);

    expect(preview).toMatchObject({
      filePath: backup.filePath,
      fileName: backup.fileName,
      projectCount: 1,
      itemCount: 1,
      latestUpdatedAt: expect.any(String),
    });
    expect(liveDetail.items.some((entry) => entry.title === "Preview対象")).toBe(true);
  });

  it("restores a local backup and creates a safety backup", async () => {
    const restoredProject = service.createProject({
      name: "Restore Apply案件",
      code: "PRJ-RESTORE-APPLY",
    });
    service.createItem({
      projectId: restoredProject.id,
      title: "復元したいタスク",
      type: "task",
    });
    const backup = service.createBackup();

    const afterProject = service.createProject({
      name: "後追加案件",
      code: "PRJ-AFTER-RESTORE",
    });
    service.createItem({
      projectId: afterProject.id,
      title: "消えるタスク",
      type: "task",
    });

    const result = await service.restoreBackup(backup);
    const projects = service.listProjects();

    expect(result.restoredBackup.filePath).toBe(backup.filePath);
    expect(fs.existsSync(result.safetyBackup.filePath ?? "")).toBe(true);
    expect(projects.some((entry) => entry.code === "PRJ-RESTORE-APPLY")).toBe(true);
    expect(projects.some((entry) => entry.code === "PRJ-AFTER-RESTORE")).toBe(false);
    expect(
      service
        .getProjectDetail(restoredProject.id)
        .items.some((entry) => entry.title === "復元したいタスク")
    ).toBe(true);
  });

  it("ensures one auto backup per day and keeps only the latest auto backups", async () => {
    for (let index = 0; index < 8; index += 1) {
      const autoBackup = manager.createBackup({
        kind: "auto",
        createdAt: `2026-04-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
      });
      const datedAt = new Date(`2026-04-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`);
      fs.utimesSync(autoBackup.filePath, datedAt, datedAt);
    }
    const manualBackup = service.createBackup();

    const firstRun = manager.ensureAutoBackup({
      now: new Date("2026-04-09T09:00:00+09:00"),
      retentionLimit: 7,
    });
    const secondRun = service.ensureAutoBackup({
      now: new Date("2026-04-09T18:00:00+09:00"),
    });
    const backups = service.listBackups();

    expect(firstRun.createdBackup?.fileName).toMatch(/^sgc-auto-backup-/);
    expect(secondRun.retentionLimit).toBe(7);
    expect(backups.filter((entry) => entry.fileName.startsWith("sgc-auto-backup-"))).toHaveLength(7);
    expect(backups.some((entry) => entry.fileName === manualBackup.fileName)).toBe(true);
  });

  it("skips auto backup create and prune when auto backup is disabled", () => {
    service.updateAppSettings({
      autoBackupEnabled: false,
      autoBackupRetentionLimit: 3,
    });

    const result = service.ensureAutoBackup({
      now: new Date("2026-04-09T09:00:00+09:00"),
    });

    expect(result.createdBackup).toBeNull();
    expect(result.prunedFileNames).toEqual([]);
    expect(result.retentionLimit).toBe(3);
    expect(service.listBackups()).toEqual([]);
  });

  it("uses configured retention limit for auto backups", () => {
    service.updateAppSettings({
      autoBackupEnabled: true,
      autoBackupRetentionLimit: 3,
    });

    for (let index = 0; index < 4; index += 1) {
      const autoBackup = manager.createBackup({
        kind: "auto",
        createdAt: `2026-04-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
      });
      const datedAt = new Date(`2026-04-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`);
      fs.utimesSync(autoBackup.filePath, datedAt, datedAt);
    }

    const result = service.ensureAutoBackup({
      now: new Date("2026-04-05T09:00:00+09:00"),
    });
    const backups = service.listBackups();

    expect(result.retentionLimit).toBe(3);
    expect(result.prunedFileNames).toHaveLength(2);
    expect(backups.filter((entry) => entry.fileName.startsWith("sgc-auto-backup-"))).toHaveLength(3);
  });

  it("applies import commit for update and new rows while skipping errors", () => {
    const project = service.createProject({
      name: "RoundTrip案件",
      code: "PRJ-RT",
    });
    const existing = service.createItem({
      projectId: project.id,
      title: "既存タスク",
      type: "task",
    });

    const workbookBytes = exportWorkbookXlsx({
      sheets: [
        {
          name: "Dashboard",
          columns: ["Metric", "Value"],
          rows: [],
        },
        {
          name: "Tasks",
          columns: EXCEL_TASKS_SHEET_COLUMNS,
          rows: [
            {
              RecordId: existing.id,
              WorkspaceCode: "default",
              PortfolioCode: "",
              PortfolioName: "",
              ProjectCode: project.code,
              ProjectName: project.name,
              ParentRecordId: "",
              WbsCode: "1",
              ItemType: "task",
              Title: "更新後タスク",
              Status: "in_progress",
              Priority: "high",
              Assignee: "田中",
              StartDate: "2026-04-10",
              EndDate: "2026-04-12",
              DueDate: "2026-04-12",
              DurationDays: "3",
              PercentComplete: "60",
              DependsOn: "",
              Tags: "設計,重要",
              EstimateHours: "8",
              ActualHours: "0",
              Note: "更新ノート",
              SortOrder: "1",
              IsArchived: "FALSE",
              LastModifiedAt: "2026-04-22T00:00:00.000Z",
            },
            {
              RecordId: "",
              WorkspaceCode: "default",
              PortfolioCode: "",
              PortfolioName: "",
              ProjectCode: project.code,
              ProjectName: project.name,
              ParentRecordId: "",
              WbsCode: "2",
              ItemType: "milestone",
              Title: "新規マイルストーン",
              Status: "not_started",
              Priority: "medium",
              Assignee: "",
              StartDate: "2026-04-20",
              EndDate: "2026-04-20",
              DueDate: "2026-04-20",
              DurationDays: "1",
              PercentComplete: "0",
              DependsOn: "",
              Tags: "追加",
              EstimateHours: "0",
              ActualHours: "0",
              Note: "新規ノート",
              SortOrder: "2",
              IsArchived: "FALSE",
              LastModifiedAt: "2026-04-22T00:00:00.000Z",
            },
            {
              RecordId: "itm-missing",
              WorkspaceCode: "default",
              PortfolioCode: "",
              PortfolioName: "",
              ProjectCode: project.code,
              ProjectName: project.name,
              ParentRecordId: "",
              WbsCode: "3",
              ItemType: "task",
              Title: "エラー行",
              Status: "not_started",
              Priority: "medium",
              Assignee: "",
              StartDate: "",
              EndDate: "",
              DueDate: "",
              DurationDays: "1",
              PercentComplete: "0",
              DependsOn: "",
              Tags: "",
              EstimateHours: "0",
              ActualHours: "0",
              Note: "",
              SortOrder: "3",
              IsArchived: "FALSE",
              LastModifiedAt: "2026-04-22T00:00:00.000Z",
            },
          ],
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
    });

    const result = service.commitProjectImport({
      projectId: project.id,
      sourcePath: "C:/tmp/roundtrip.xlsx",
      workbookBytes,
    });
    const detail = service.getProjectDetail(project.id);
    const updated = detail.items.find((item) => item.id === existing.id);
    const created = detail.items.find((item) => item.title === "新規マイルストーン");

    expect(result).toMatchObject({
      createdCount: 1,
      updatedCount: 1,
      skippedCount: 1,
    });
    expect(updated).toMatchObject({
      title: "更新後タスク",
      status: "in_progress",
      priority: "high",
      assigneeName: "田中",
      startDate: "2026-04-10",
      endDate: "2026-04-12",
      percentComplete: 60,
      estimateHours: 8,
      note: "更新ノート",
      tags: expect.arrayContaining(["設計", "重要"]),
    });
    expect(created).toMatchObject({
      type: "milestone",
      startDate: "2026-04-20",
      endDate: "2026-04-20",
      note: "新規ノート",
      tags: expect.arrayContaining(["追加"]),
    });
  });

  it("supports export edit preview commit through round-trip fixture helper", () => {
    const project = service.createProject({
      name: "Fixture案件",
      code: "PRJ-FX",
    });
    const phase = service.createItem({
      projectId: project.id,
      title: "要件定義",
      type: "group",
    });
    const task = service.createItem({
      projectId: project.id,
      parentId: phase.id,
      title: "既存作業",
      type: "task",
    });
    service.updateItem({
      id: task.id,
      startDate: "2026-05-01",
      endDate: "2026-05-03",
      assigneeName: "佐藤",
      tags: ["現状"],
    });

    const exportedWorkbook = service.exportProjectWorkbook(project.id);
    const fixtureWorkbook = buildRoundTripWorkbookFixture({
      exportedWorkbookBytes: exportedWorkbook,
      mutateRows: (rows) => {
        const editedRows = rows.map((row) => ({ ...row }));
        const taskRow = editedRows.find((row) => row.RecordId === task.id);
        if (!taskRow) {
          throw new Error("Task row not found in fixture");
        }
        taskRow.Title = "編集済み作業";
        taskRow.StartDate = "2026-05-06";
        taskRow.EndDate = "2026-05-08";
        taskRow.DueDate = "2026-05-08";
        taskRow.PercentComplete = "75";
        taskRow.Tags = "現状 更新";
        taskRow.Note = "fixture edit";

        editedRows.push({
          ...editedRows[0],
          RecordId: "",
          ParentRecordId: phase.id,
          WbsCode: "1.2",
          ItemType: "milestone",
          Title: "追加マイルストーン",
          Status: "not_started",
          Priority: "medium",
          Assignee: "",
          StartDate: "2026-05-09",
          EndDate: "2026-05-09",
          DueDate: "2026-05-09",
          DurationDays: "1",
          PercentComplete: "0",
          DependsOn: "",
          Tags: "fixture",
          EstimateHours: "0",
          ActualHours: "0",
          Note: "new from fixture",
          SortOrder: "3",
          IsArchived: "FALSE",
        });
        return editedRows;
      },
    });

    const preview = service.previewProjectImport({
      projectId: project.id,
      sourcePath: "C:/tmp/fixture-roundtrip.xlsx",
      workbookBytes: fixtureWorkbook,
    });
    const result = service.commitProjectImport({
      projectId: project.id,
      sourcePath: "C:/tmp/fixture-roundtrip.xlsx",
      workbookBytes: fixtureWorkbook,
    });
    const detail = service.getProjectDetail(project.id);

    expect(preview).toMatchObject({
      newCount: 1,
      updateCount: 2,
      errorCount: 0,
    });
    expect(result).toMatchObject({
      createdCount: 1,
      updatedCount: 2,
      skippedCount: 0,
    });
    expect(detail.items.find((item) => item.id === task.id)).toMatchObject({
      title: "編集済み作業",
      startDate: "2026-05-06",
      endDate: "2026-05-08",
      percentComplete: 75,
      note: "fixture edit",
      tags: expect.arrayContaining(["現状", "更新"]),
    });
    expect(detail.items.find((item) => item.title === "追加マイルストーン")).toMatchObject({
      parentId: phase.id,
      type: "milestone",
      startDate: "2026-05-09",
      endDate: "2026-05-09",
    });
  });

  it("surfaces validation errors from a round-trip fixture edit", () => {
    const project = service.createProject({
      name: "Fixture検証",
      code: "PRJ-FV",
    });
    const task = service.createItem({
      projectId: project.id,
      title: "検証対象",
      type: "task",
    });

    const exportedWorkbook = service.exportProjectWorkbook(project.id);
    const invalidFixtureWorkbook = buildRoundTripWorkbookFixture({
      exportedWorkbookBytes: exportedWorkbook,
      mutateRows: (rows) =>
        rows.map((row) =>
          row.RecordId === task.id
            ? {
                ...row,
                Title: "",
                StartDate: "2026/05/01",
                EndDate: "",
                PercentComplete: "130",
              }
            : row
        ),
    });

    const preview = service.previewProjectImport({
      projectId: project.id,
      sourcePath: "C:/tmp/fixture-invalid.xlsx",
      workbookBytes: invalidFixtureWorkbook,
    });

    expect(preview).toMatchObject({
      newCount: 0,
      updateCount: 0,
      errorCount: 1,
    });
    expect(preview.rows[0]).toMatchObject({
      action: "error",
      message: "3 validation issues",
      issues: [
        { field: "Title", message: "required" },
        { field: "StartDate/EndDate", message: "must be paired ISO dates" },
        { field: "PercentComplete", message: "must be between 0 and 100" },
      ],
    });
  });

  it("rejects fixture rows whose project target mismatches the current import project", () => {
    const project = service.createProject({
      name: "Fixture対象",
      code: "PRJ-TARGET",
    });
    const otherProject = service.createProject({
      name: "別案件",
      code: "PRJ-OTHER",
    });
    const task = service.createItem({
      projectId: project.id,
      title: "対象作業",
      type: "task",
    });

    const exportedWorkbook = service.exportProjectWorkbook(project.id);
    const mismatchFixtureWorkbook = buildRoundTripWorkbookFixture({
      exportedWorkbookBytes: exportedWorkbook,
      mutateRows: (rows) =>
        rows.map((row) =>
          row.RecordId === task.id
            ? {
                ...row,
                ProjectCode: otherProject.code,
                ProjectName: otherProject.name,
              }
            : row
        ),
    });

    const preview = service.previewProjectImport({
      projectId: project.id,
      sourcePath: "C:/tmp/fixture-project-mismatch.xlsx",
      workbookBytes: mismatchFixtureWorkbook,
    });
    const result = service.commitProjectImport({
      projectId: project.id,
      sourcePath: "C:/tmp/fixture-project-mismatch.xlsx",
      workbookBytes: mismatchFixtureWorkbook,
    });
    const detail = service.getProjectDetail(project.id);

    expect(preview).toMatchObject({
      newCount: 0,
      updateCount: 0,
      errorCount: 1,
    });
    expect(preview.rows[0]).toMatchObject({
      action: "error",
      message: "ProjectCode/ProjectName: mismatch for current import target",
      issues: [{ field: "ProjectCode/ProjectName", message: "mismatch for current import target" }],
    });
    expect(result).toMatchObject({
      createdCount: 0,
      updatedCount: 0,
      skippedCount: 1,
    });
    expect(detail.items.find((item) => item.id === task.id)?.title).toBe("対象作業");
  });

  it("rejects fixture rows whose parent record is not found", () => {
    const project = service.createProject({
      name: "Fixture親検証",
      code: "PRJ-FP",
    });
    const phase = service.createItem({
      projectId: project.id,
      title: "親フェーズ",
      type: "group",
    });

    const exportedWorkbook = service.exportProjectWorkbook(project.id);
    const invalidParentFixtureWorkbook = buildRoundTripWorkbookFixture({
      exportedWorkbookBytes: exportedWorkbook,
      mutateRows: (rows) => [
        ...rows.map((row) => ({ ...row })),
        {
          ...rows[0],
          RecordId: "",
          ParentRecordId: "itm-missing-parent",
          WbsCode: "1.1",
          ItemType: "task",
          Title: "親不明タスク",
          Status: "not_started",
          Priority: "medium",
          Assignee: "",
          StartDate: "2026-06-01",
          EndDate: "2026-06-02",
          DueDate: "2026-06-02",
          DurationDays: "2",
          PercentComplete: "0",
          DependsOn: "",
          Tags: "",
          EstimateHours: "0",
          ActualHours: "0",
          Note: "",
          SortOrder: "2",
          IsArchived: "FALSE",
        },
      ],
    });

    const preview = service.previewProjectImport({
      projectId: project.id,
      sourcePath: "C:/tmp/fixture-parent-missing.xlsx",
      workbookBytes: invalidParentFixtureWorkbook,
    });
    const result = service.commitProjectImport({
      projectId: project.id,
      sourcePath: "C:/tmp/fixture-parent-missing.xlsx",
      workbookBytes: invalidParentFixtureWorkbook,
    });
    const detail = service.getProjectDetail(project.id);

    expect(preview).toMatchObject({
      newCount: 0,
      updateCount: 1,
      errorCount: 1,
    });
    expect(preview.rows.find((row) => row.title === "親不明タスク")).toMatchObject({
      action: "error",
      message: "ParentRecordId: not found",
      issues: [{ field: "ParentRecordId", message: "not found" }],
    });
    expect(result).toMatchObject({
      createdCount: 0,
      updatedCount: 1,
      skippedCount: 1,
    });
    expect(detail.items.find((item) => item.title === "親不明タスク")).toBeUndefined();
    expect(detail.items.find((item) => item.id === phase.id)?.title).toBe("親フェーズ");
  });

  it("rejects fixture rows whose DependsOn references another project item", () => {
    const project = service.createProject({
      name: "Fixture依存検証",
      code: "PRJ-FD",
    });
    const otherProject = service.createProject({
      name: "別依存案件",
      code: "PRJ-FD-OTHER",
    });
    const task = service.createItem({
      projectId: project.id,
      title: "対象タスク",
      type: "task",
    });
    const otherTask = service.createItem({
      projectId: otherProject.id,
      title: "別案件の先行タスク",
      type: "task",
    });

    const exportedWorkbook = service.exportProjectWorkbook(project.id);
    const invalidDependencyFixtureWorkbook = buildRoundTripWorkbookFixture({
      exportedWorkbookBytes: exportedWorkbook,
      mutateRows: (rows) =>
        rows.map((row) =>
          row.RecordId === task.id
            ? {
                ...row,
                DependsOn: `${otherTask.id}+2`,
              }
            : row
        ),
    });

    const preview = service.previewProjectImport({
      projectId: project.id,
      sourcePath: "C:/tmp/fixture-dep-mismatch.xlsx",
      workbookBytes: invalidDependencyFixtureWorkbook,
    });

    expect(preview).toMatchObject({
      newCount: 0,
      updateCount: 0,
      errorCount: 1,
    });
    expect(preview.rows[0]).toMatchObject({
      action: "error",
      message: "DependsOn: must reference current project item: " + `${otherTask.id}+2`,
      issues: [{ field: "DependsOn", message: `must reference current project item: ${otherTask.id}+2` }],
      warnings: [],
    });
  });

  it("adds a LastModifiedAt warning for stale workbook update rows", () => {
    const project = service.createProject({
      name: "Fixture競合警告",
      code: "PRJ-WARN",
    });
    const task = service.createItem({
      projectId: project.id,
      title: "対象タスク",
      type: "task",
    });

    const exportedWorkbook = service.exportProjectWorkbook(project.id);
    const staleFixtureWorkbook = buildRoundTripWorkbookFixture({
      exportedWorkbookBytes: exportedWorkbook,
      mutateRows: (rows) =>
        rows.map((row) =>
          row.RecordId === task.id
            ? {
                ...row,
                LastModifiedAt: "2026-04-20T00:00:00.000Z",
              }
            : row
        ),
    });

    const preview = service.previewProjectImport({
      projectId: project.id,
      sourcePath: "C:/tmp/fixture-stale-warning.xlsx",
      workbookBytes: staleFixtureWorkbook,
    });

    expect(preview).toMatchObject({
      newCount: 0,
      updateCount: 1,
      errorCount: 0,
    });
    expect(preview.rows[0]).toMatchObject({
      action: "update",
      issues: [],
      warnings: [{ field: "LastModifiedAt", message: "workbook row is older than current item" }],
    });
  });

  it("adds a DependsOn cycle warning for preview rows that would close a loop", () => {
    const project = service.createProject({
      name: "Fixture循環警告",
      code: "PRJ-CYCLE-WARN",
    });
    const taskA = service.createItem({
      projectId: project.id,
      title: "Task A",
      type: "task",
    });
    const taskB = service.createItem({
      projectId: project.id,
      title: "Task B",
      type: "task",
    });
    service.createDependency({
      predecessorItemId: taskA.id,
      successorItemId: taskB.id,
      lagDays: 0,
    });

    const exportedWorkbook = service.exportProjectWorkbook(project.id);
    const cycleWarningWorkbook = buildRoundTripWorkbookFixture({
      exportedWorkbookBytes: exportedWorkbook,
      mutateRows: (rows) =>
        rows.map((row) =>
          row.RecordId === taskA.id
            ? {
                ...row,
                DependsOn: taskB.id,
              }
            : row
        ),
    });

    const preview = service.previewProjectImport({
      projectId: project.id,
      sourcePath: "C:/tmp/fixture-cycle-warning.xlsx",
      workbookBytes: cycleWarningWorkbook,
    });

    expect(preview).toMatchObject({
      newCount: 0,
      updateCount: 2,
      errorCount: 0,
    });
    expect(preview.rows.find((row) => row.recordId === taskA.id)).toMatchObject({
      action: "update",
      issues: [],
      warnings: [{ field: "DependsOn", message: `would create dependency cycle on apply: ${taskB.id}` }],
    });
  });

  it("applies DependsOn import commit by replacing successor dependencies", () => {
    const project = service.createProject({
      name: "Fixture依存反映",
      code: "PRJ-DEP-IMPORT",
    });
    const predecessorA = service.createItem({
      projectId: project.id,
      title: "先行A",
      type: "task",
    });
    const predecessorB = service.createItem({
      projectId: project.id,
      title: "先行B",
      type: "task",
    });
    const successor = service.createItem({
      projectId: project.id,
      title: "後続既存",
      type: "task",
    });
    service.createDependency({
      predecessorItemId: predecessorA.id,
      successorItemId: successor.id,
      lagDays: 1,
    });

    const exportedWorkbook = service.exportProjectWorkbook(project.id);
    const dependencyFixtureWorkbook = buildRoundTripWorkbookFixture({
      exportedWorkbookBytes: exportedWorkbook,
      mutateRows: (rows) => {
        const editedRows = rows.map((row) => ({ ...row }));
        const successorRow = editedRows.find((row) => row.RecordId === successor.id);
        if (!successorRow) {
          throw new Error("Successor row not found in fixture");
        }
        successorRow.DependsOn = `${predecessorB.id}+2`;

        editedRows.push({
          ...editedRows[0],
          RecordId: "",
          ParentRecordId: "",
          WbsCode: "4",
          ItemType: "task",
          Title: "新規後続",
          Status: "not_started",
          Priority: "medium",
          Assignee: "",
          StartDate: "2026-06-10",
          EndDate: "2026-06-11",
          DueDate: "2026-06-11",
          DurationDays: "2",
          PercentComplete: "0",
          DependsOn: predecessorA.id,
          Tags: "",
          EstimateHours: "0",
          ActualHours: "0",
          Note: "",
          SortOrder: "4",
          IsArchived: "FALSE",
        });

        return editedRows;
      },
    });

    const preview = service.previewProjectImport({
      projectId: project.id,
      sourcePath: "C:/tmp/fixture-dependency-commit.xlsx",
      workbookBytes: dependencyFixtureWorkbook,
    });
    const result = service.commitProjectImport({
      projectId: project.id,
      sourcePath: "C:/tmp/fixture-dependency-commit.xlsx",
      workbookBytes: dependencyFixtureWorkbook,
    });
    const dependencies = service.listDependenciesByProject(project.id);
    const newSuccessor = service
      .getProjectDetail(project.id)
      .items.find((item) => item.title === "新規後続");

    expect(preview).toMatchObject({
      newCount: 1,
      updateCount: 3,
      errorCount: 0,
    });
    expect(result).toMatchObject({
      createdCount: 1,
      updatedCount: 3,
      skippedCount: 0,
    });
    expect(dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          predecessorItemId: predecessorB.id,
          successorItemId: successor.id,
          lagDays: 2,
        }),
        expect.objectContaining({
          predecessorItemId: predecessorA.id,
          successorItemId: newSuccessor?.id,
          lagDays: 0,
        }),
      ])
    );
    expect(
      dependencies.some(
        (dependency) =>
          dependency.predecessorItemId === predecessorA.id &&
          dependency.successorItemId === successor.id
      )
    ).toBe(false);
  });

  it("applies DependsOn import commit for workbook-local temporary RecordId rows", () => {
    const project = service.createProject({
      name: "Fixture新規依存反映",
      code: "PRJ-TMP-DEP",
    });
    const templateTask = service.createItem({
      projectId: project.id,
      title: "テンプレート",
      type: "task",
    });

    const exportedWorkbook = service.exportProjectWorkbook(project.id);
    const temporaryDependencyWorkbook = buildRoundTripWorkbookFixture({
      exportedWorkbookBytes: exportedWorkbook,
      mutateRows: (rows) => [
        ...rows.filter((row) => row.RecordId !== templateTask.id),
        {
          ...rows[0],
          RecordId: "tmp_pred",
          ParentRecordId: "",
          WbsCode: "1",
          ItemType: "task",
          Title: "新規先行tmp",
          Status: "not_started",
          Priority: "medium",
          Assignee: "",
          StartDate: "2026-07-01",
          EndDate: "2026-07-02",
          DueDate: "2026-07-02",
          DurationDays: "2",
          PercentComplete: "0",
          DependsOn: "",
          Tags: "",
          EstimateHours: "0",
          ActualHours: "0",
          Note: "",
          SortOrder: "1",
          IsArchived: "FALSE",
        },
        {
          ...rows[0],
          RecordId: "tmp_succ",
          ParentRecordId: "",
          WbsCode: "2",
          ItemType: "task",
          Title: "新規後続tmp",
          Status: "not_started",
          Priority: "medium",
          Assignee: "",
          StartDate: "2026-07-03",
          EndDate: "2026-07-04",
          DueDate: "2026-07-04",
          DurationDays: "2",
          PercentComplete: "0",
          DependsOn: "tmp_pred+1",
          Tags: "",
          EstimateHours: "0",
          ActualHours: "0",
          Note: "",
          SortOrder: "2",
          IsArchived: "FALSE",
        },
      ],
    });

    const preview = service.previewProjectImport({
      projectId: project.id,
      sourcePath: "C:/tmp/fixture-temp-dependency-commit.xlsx",
      workbookBytes: temporaryDependencyWorkbook,
    });
    const result = service.commitProjectImport({
      projectId: project.id,
      sourcePath: "C:/tmp/fixture-temp-dependency-commit.xlsx",
      workbookBytes: temporaryDependencyWorkbook,
    });
    const detail = service.getProjectDetail(project.id);
    const predecessor = detail.items.find((item) => item.title === "新規先行tmp");
    const successor = detail.items.find((item) => item.title === "新規後続tmp");
    const dependencies = service.listDependenciesByProject(project.id);

    expect(preview).toMatchObject({
      newCount: 2,
      updateCount: 0,
      errorCount: 0,
    });
    expect(result).toMatchObject({
      createdCount: 2,
      updatedCount: 0,
      skippedCount: 0,
    });
    expect(predecessor).toBeTruthy();
    expect(successor).toBeTruthy();
    expect(dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          predecessorItemId: predecessor?.id,
          successorItemId: successor?.id,
          lagDays: 1,
        }),
      ])
    );
  });

  it("builds portfolio summary with overdue, next milestone, recent changes, and risk", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-21T09:00:00+09:00"));

    const projectA = service.createProject({
      name: "案件A",
      code: "PRJ-A",
    });
    const projectB = service.createProject({
      name: "案件B",
      code: "PRJ-B",
    });
    const projectC = service.createProject({
      name: "案件C",
      code: "PRJ-C",
    });

    vi.setSystemTime(new Date("2026-04-12T09:00:00+09:00"));
    const staleItem = service.createItem({
      projectId: projectA.id,
      title: "古い更新",
      type: "task",
    });
    service.updateItem({
      id: staleItem.id,
      startDate: "2026-04-30",
      endDate: "2026-04-30",
    });

    vi.setSystemTime(new Date("2026-04-21T09:00:00+09:00"));
    const overdueA = service.createItem({
      projectId: projectA.id,
      title: "期限切れA",
      type: "task",
    });
    service.updateItem({
      id: overdueA.id,
      startDate: "2026-04-18",
      endDate: "2026-04-18",
    });
    const milestoneA = service.createItem({
      projectId: projectA.id,
      title: "レビューA",
      type: "milestone",
    });
    service.updateItem({
      id: milestoneA.id,
      startDate: "2026-04-25",
      endDate: "2026-04-25",
    });

    const blockedB = service.createItem({
      projectId: projectB.id,
      title: "ブロックB",
      type: "task",
    });
    service.updateItem({
      id: blockedB.id,
      status: "blocked",
      startDate: "2026-04-22",
      endDate: "2026-04-22",
    });
    const milestoneB = service.createItem({
      projectId: projectB.id,
      title: "レビューB",
      type: "milestone",
    });
    service.updateItem({
      id: milestoneB.id,
      startDate: "2026-04-23",
      endDate: "2026-04-23",
    });

    for (const index of [0, 1, 2, 3, 4]) {
      const overdueC = service.createItem({
        projectId: projectC.id,
        title: `期限切れC-${index + 1}`,
        type: "task",
      });
      service.updateItem({
        id: overdueC.id,
        startDate: `2026-04-${String(10 + index).padStart(2, "0")}`,
        endDate: `2026-04-${String(10 + index).padStart(2, "0")}`,
      });
    }

    const summary = service.getPortfolioSummary();
    const projectASummary = summary.projects.find((project) => project.id === projectA.id);
    const projectBSummary = summary.projects.find((project) => project.id === projectB.id);
    const projectCSummary = summary.projects.find((project) => project.id === projectC.id);

    expect(summary.projects).toHaveLength(3);
    expect(projectASummary).toMatchObject({
      code: "PRJ-A",
      overdueCount: 1,
      nextMilestoneTitle: "レビューA",
      nextMilestoneDate: "2026-04-25",
      recentChangeCount7d: 3,
      riskLevel: "medium",
    });
    expect(projectBSummary).toMatchObject({
      code: "PRJ-B",
      overdueCount: 0,
      nextMilestoneTitle: "レビューB",
      nextMilestoneDate: "2026-04-23",
      recentChangeCount7d: 2,
      riskLevel: "high",
    });
    expect(projectCSummary).toMatchObject({
      code: "PRJ-C",
      overdueCount: 5,
      nextMilestoneTitle: null,
      nextMilestoneDate: null,
      recentChangeCount7d: 5,
      riskLevel: "high",
    });
  });

  it("returns root-level phase summaries for portfolio expand", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-21T09:00:00+09:00"));

    const project = service.createProject({
      name: "展開案件",
      code: "PRJ-X",
    });

    const phaseA = service.createItem({
      projectId: project.id,
      title: "Phase A",
      type: "group",
    });
    const phaseB = service.createItem({
      projectId: project.id,
      title: "Phase B",
      type: "group",
    });
    const rootTask = service.createItem({
      projectId: project.id,
      title: "Root task",
      type: "task",
    });
    service.updateItem({
      id: rootTask.id,
      startDate: "2026-04-24",
      endDate: "2026-04-24",
    });

    const overdueTask = service.createItem({
      projectId: project.id,
      parentId: phaseA.id,
      title: "Overdue child",
      type: "task",
    });
    service.updateItem({
      id: overdueTask.id,
      startDate: "2026-04-18",
      endDate: "2026-04-18",
    });
    const milestone = service.createItem({
      projectId: project.id,
      parentId: phaseA.id,
      title: "Phase A milestone",
      type: "milestone",
    });
    service.updateItem({
      id: milestone.id,
      startDate: "2026-04-25",
      endDate: "2026-04-25",
    });
    const blockedTask = service.createItem({
      projectId: project.id,
      parentId: phaseB.id,
      title: "Blocked child",
      type: "task",
    });
    service.updateItem({
      id: blockedTask.id,
      status: "blocked",
      startDate: "2026-04-23",
      endDate: "2026-04-23",
    });

    const phases = service.getPortfolioProjectPhases(project.id);

    expect(phases.projectId).toBe(project.id);
    expect(phases.phases.map((phase) => phase.title)).toEqual(["Phase A", "Phase B"]);
    expect(phases.phases[0]).toMatchObject({
      wbsCode: "1",
      title: "Phase A",
      overdueCount: 1,
      nextMilestoneTitle: "Phase A milestone",
      nextMilestoneDate: "2026-04-25",
      riskLevel: "medium",
    });
    expect(phases.phases[1]).toMatchObject({
      wbsCode: "2",
      title: "Phase B",
      overdueCount: 0,
      nextMilestoneTitle: null,
      nextMilestoneDate: null,
      riskLevel: "normal",
    });
  });

  it("creates dependency records with lagDays and lists them by project", () => {
    const project = service.createProject({
      name: "依存案件",
      code: "PRJ-DEP",
    });
    const predecessor = service.createItem({
      projectId: project.id,
      title: "Task A",
      type: "task",
    });
    const successor = service.createItem({
      projectId: project.id,
      title: "Task B",
      type: "group",
    });

    const dependency = service.createDependency({
      predecessorItemId: predecessor.id,
      successorItemId: successor.id,
      lagDays: 2,
    });
    const dependencies = service.listDependenciesByProject(project.id);

    expect(dependency).toMatchObject({
      projectId: project.id,
      predecessorItemId: predecessor.id,
      successorItemId: successor.id,
      type: "finish_to_start",
      lagDays: 2,
    });
    expect(dependencies).toEqual([dependency]);
  });

  it("rejects duplicate, self, cross-project, and archived dependency edges", () => {
    const projectA = service.createProject({
      name: "依存案件A",
      code: "PRJ-DA",
    });
    const projectB = service.createProject({
      name: "依存案件B",
      code: "PRJ-DB",
    });
    const taskA = service.createItem({
      projectId: projectA.id,
      title: "Task A",
      type: "task",
    });
    const taskB = service.createItem({
      projectId: projectA.id,
      title: "Task B",
      type: "task",
    });
    const taskC = service.createItem({
      projectId: projectB.id,
      title: "Task C",
      type: "task",
    });

    service.createDependency({
      predecessorItemId: taskA.id,
      successorItemId: taskB.id,
      lagDays: 0,
    });

    expect(() =>
      service.createDependency({
        predecessorItemId: taskA.id,
        successorItemId: taskB.id,
        lagDays: 0,
      })
    ).toThrow("Dependency already exists");
    expect(() =>
      service.createDependency({
        predecessorItemId: taskA.id,
        successorItemId: taskA.id,
        lagDays: 0,
      })
    ).toThrow("Dependency predecessor and successor must be different");
    expect(() =>
      service.createDependency({
        predecessorItemId: taskA.id,
        successorItemId: taskC.id,
        lagDays: 0,
      })
    ).toThrow("Dependency items must belong to the same project");

    service.archiveItem(taskB.id);
    expect(() =>
      service.createDependency({
        predecessorItemId: taskA.id,
        successorItemId: taskB.id,
        lagDays: 0,
      })
    ).toThrow("Archived items cannot be linked by dependency");
  });

  it("rejects direct and indirect dependency cycles", () => {
    const project = service.createProject({
      name: "循環依存案件",
      code: "PRJ-CYCLE",
    });
    const taskA = service.createItem({
      projectId: project.id,
      title: "Task A",
      type: "task",
    });
    const taskB = service.createItem({
      projectId: project.id,
      title: "Task B",
      type: "task",
    });
    const taskC = service.createItem({
      projectId: project.id,
      title: "Task C",
      type: "task",
    });

    service.createDependency({
      predecessorItemId: taskA.id,
      successorItemId: taskB.id,
      lagDays: 0,
    });
    service.createDependency({
      predecessorItemId: taskB.id,
      successorItemId: taskC.id,
      lagDays: 0,
    });

    expect(() =>
      service.createDependency({
        predecessorItemId: taskB.id,
        successorItemId: taskA.id,
        lagDays: 0,
      })
    ).toThrow("Dependency cycle is not allowed");
    expect(() =>
      service.createDependency({
        predecessorItemId: taskC.id,
        successorItemId: taskA.id,
        lagDays: 0,
      })
    ).toThrow("Dependency cycle is not allowed");
  });

  it("moves descendants by the same delta when reschedule scope is with_descendants", () => {
    const project = service.createProject({
      name: "リスケ案件",
      code: "PRJ-RS",
    });
    const parent = service.createItem({
      projectId: project.id,
      title: "Parent",
      type: "group",
    });
    const childGroup = service.createItem({
      projectId: project.id,
      parentId: parent.id,
      title: "Child Group",
      type: "group",
    });
    const deepTask = service.createItem({
      projectId: project.id,
      parentId: childGroup.id,
      title: "Deep Task",
      type: "task",
    });
    const siblingTask = service.createItem({
      projectId: project.id,
      parentId: parent.id,
      title: "Sibling Task",
      type: "task",
    });

    service.updateItem({
      id: deepTask.id,
      startDate: "2026-04-21",
      endDate: "2026-04-23",
    });
    service.updateItem({
      id: siblingTask.id,
      startDate: "2026-04-24",
      endDate: "2026-04-25",
    });

    const updatedParent = service.updateItem({
      id: parent.id,
      startDate: "2026-04-23",
      endDate: "2026-04-27",
      rescheduleScope: "with_descendants",
    });
    const detail = service.getProjectDetail(project.id);

    expect(updatedParent.startDate).toBe("2026-04-23");
    expect(updatedParent.endDate).toBe("2026-04-27");
    expect(detail.items.find((item) => item.id === childGroup.id)).toMatchObject({
      startDate: "2026-04-23",
      endDate: "2026-04-25",
    });
    expect(detail.items.find((item) => item.id === deepTask.id)).toMatchObject({
      startDate: "2026-04-23",
      endDate: "2026-04-25",
    });
    expect(detail.items.find((item) => item.id === siblingTask.id)).toMatchObject({
      startDate: "2026-04-26",
      endDate: "2026-04-27",
    });
  });

  it("shifts dependent items and their descendants for finish-to-start constraints", () => {
    const project = service.createProject({
      name: "依存シフト案件",
      code: "PRJ-SHIFT",
    });
    const predecessor = service.createItem({
      projectId: project.id,
      title: "Task A",
      type: "task",
    });
    const successor = service.createItem({
      projectId: project.id,
      title: "Task B",
      type: "task",
    });
    const successorChild = service.createItem({
      projectId: project.id,
      parentId: successor.id,
      title: "Task B child",
      type: "task",
    });

    service.updateItem({
      id: predecessor.id,
      startDate: "2026-04-21",
      endDate: "2026-04-23",
    });
    service.updateItem({
      id: successor.id,
      startDate: "2026-04-24",
      endDate: "2026-04-26",
    });
    service.updateItem({
      id: successorChild.id,
      startDate: "2026-04-25",
      endDate: "2026-04-27",
    });
    service.createDependency({
      predecessorItemId: predecessor.id,
      successorItemId: successor.id,
      lagDays: 0,
    });

    service.updateItem({
      id: predecessor.id,
      startDate: "2026-04-26",
      endDate: "2026-04-28",
      rescheduleScope: "with_dependents",
    });
    const detail = service.getProjectDetail(project.id);

    expect(detail.items.find((item) => item.id === predecessor.id)).toMatchObject({
      startDate: "2026-04-26",
      endDate: "2026-04-28",
    });
    expect(detail.items.find((item) => item.id === successor.id)).toMatchObject({
      startDate: "2026-04-29",
      endDate: "2026-05-01",
    });
    expect(detail.items.find((item) => item.id === successorChild.id)).toMatchObject({
      startDate: "2026-04-29",
      endDate: "2026-05-01",
    });
  });

  it("snaps dependent shift to the next working day when predecessor ends on friday", () => {
    const project = service.createProject({
      name: "営業日案件",
      code: "PRJ-BIZ",
    });
    const predecessor = service.createItem({
      projectId: project.id,
      title: "Task A",
      type: "task",
    });
    const successor = service.createItem({
      projectId: project.id,
      title: "Task B",
      type: "task",
    });

    service.updateItem({
      id: predecessor.id,
      startDate: "2026-04-21",
      endDate: "2026-04-23",
    });
    service.updateItem({
      id: successor.id,
      startDate: "2026-04-24",
      endDate: "2026-04-24",
    });
    service.createDependency({
      predecessorItemId: predecessor.id,
      successorItemId: successor.id,
      lagDays: 0,
    });

    service.updateItem({
      id: predecessor.id,
      startDate: "2026-04-22",
      endDate: "2026-04-24",
      rescheduleScope: "with_dependents",
    });
    const detail = service.getProjectDetail(project.id);

    expect(detail.items.find((item) => item.id === successor.id)).toMatchObject({
      startDate: "2026-04-27",
      endDate: "2026-04-27",
    });
  });

  it("uses custom working day settings for dependent shift", () => {
    const project = service.createProject({
      name: "カスタム営業日案件",
      code: "PRJ-CBIZ",
    });
    const predecessor = service.createItem({
      projectId: project.id,
      title: "Task A",
      type: "task",
    });
    const successor = service.createItem({
      projectId: project.id,
      title: "Task B",
      type: "task",
    });

    service.updateAppSettings({
      workingDayNumbers: [0, 1, 2, 3, 4],
    });
    service.updateItem({
      id: predecessor.id,
      startDate: "2026-04-20",
      endDate: "2026-04-23",
    });
    service.updateItem({
      id: successor.id,
      startDate: "2026-04-24",
      endDate: "2026-04-24",
    });
    service.createDependency({
      predecessorItemId: predecessor.id,
      successorItemId: successor.id,
      lagDays: 0,
    });

    service.updateItem({
      id: predecessor.id,
      startDate: "2026-04-21",
      endDate: "2026-04-24",
      rescheduleScope: "with_dependents",
    });
    const detail = service.getProjectDetail(project.id);

    expect(detail.items.find((item) => item.id === successor.id)).toMatchObject({
      startDate: "2026-04-26",
      endDate: "2026-04-26",
    });
  });

  it("applies a saved WBS template into the target project root and resets schedule state", () => {
    const sourceProject = service.createProject({
      name: "テンプレート元案件",
      code: "PRJ-TPL-SRC",
    });
    const root = service.createItem({
      projectId: sourceProject.id,
      title: "テンプレート親",
      type: "group",
    });
    const child = service.createItem({
      projectId: sourceProject.id,
      parentId: root.id,
      title: "テンプレート子",
      type: "task",
    });
    const grandchild = service.createItem({
      projectId: sourceProject.id,
      parentId: child.id,
      title: "テンプレート孫",
      type: "task",
    });
    service.updateItem({
      id: child.id,
      note: "テンプレート用ノート",
      tags: ["テンプレ", "適用"],
      assigneeName: "佐藤",
      priority: "high",
      estimateHours: 6,
      startDate: "2026-05-01",
      endDate: "2026-05-03",
      dueDate: "2026-05-07",
      percentComplete: 50,
      actualHours: 2,
    });
    service.upsertRecurrenceRule({
      itemId: child.id,
      rruleText: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO",
      nextOccurrenceAt: "2026-05-11",
    });
    service.updateItem({
      id: grandchild.id,
      note: "孫ノード",
      tags: ["下位"],
    });

    const template = service.saveWbsTemplate({
      rootItemId: root.id,
      name: "定例テンプレート",
    });

    const targetProject = service.createProject({
      name: "テンプレート先案件",
      code: "PRJ-TPL-DST",
    });
    const existingRoot = service.createItem({
      projectId: targetProject.id,
      title: "既存ルート",
      type: "group",
    });

    const created = service.applyWbsTemplate({
      templateId: template.id,
      projectId: targetProject.id,
    });
    const detail = service.getProjectDetail(targetProject.id);
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
      tags: expect.arrayContaining(["テンプレ", "適用"]),
      assigneeName: "佐藤",
      priority: "high",
      estimateHours: 6,
      durationDays: 3,
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
      tags: expect.arrayContaining(["下位"]),
      status: "not_started",
      startDate: null,
      endDate: null,
      dueDate: null,
    });
    expect(detail.items.find((item) => item.id === existingRoot.id)?.wbsCode).toBe("1");
    expect(service.getRecurrenceRuleByItem(appliedChild?.id ?? "")).toBeNull();
  });
});
