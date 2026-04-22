import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test, expect } from "@playwright/test";
import electronPackage from "electron";
import { _electron as electron } from "playwright";
import { buildRoundTripWorkbookFixture } from "../src/test/excel-roundtrip-fixtures";

const electronExecutable = electronPackage as unknown as string;

test("desktop shell renders portfolio expand and roadmap month bar", async () => {
  const app = await electron.launch({
    executablePath: electronExecutable,
    args: [path.join(process.cwd(), ".")],
  });

  try {
    const page = await app.firstWindow();
    const exportPath = path.join(os.tmpdir(), `sgc-export-${Date.now()}.xlsx`);
    const timestamp = Date.now();
    const overdueProjectName = `E2E Overdue ${timestamp}`;
    const milestoneProjectName = `E2E Milestone ${timestamp}`;
    const overdueTitle = `Overdue Row ${timestamp}`;
    const overdueTaskTitle = `Overdue Task ${timestamp}`;
    const milestoneTitle = `Milestone Row ${timestamp}`;
    const futureTitle = `Future Row ${timestamp}`;
    const today = new Date();
    const todayText = formatDateInput(today);
    const milestoneDateText = formatDateInput(addDays(today, 1));
    const overdueStart = addDays(today, -5);
    const overdueEnd = addDays(today, -4);
    const futureEnd = addDays(today, 20);

    await expect(page.getByRole("heading", { name: "Simple Gantt Chart" })).toBeVisible();
    await page.getByLabel("プロジェクト名").fill(overdueProjectName);
    await page.getByRole("button", { name: "プロジェクト作成" }).click();

    await expect(page.getByRole("button", { name: "Project Detail" })).toBeEnabled();
    await expect(page.locator(`input[value="${overdueProjectName}"]`).first()).toBeVisible();
    await page.getByRole("button", { name: "ルート行を追加" }).click();
    const firstDataRow = page.locator(".table-body .table-row").first();
    const titleInput = firstDataRow.locator('input[value="新しいタスク"]').first();
    await titleInput.fill(overdueTitle);
    await titleInput.press("Tab");
    await firstDataRow.locator("select").first().selectOption("group");
    await firstDataRow.locator('input[type="date"]').nth(0).fill(formatDateInput(overdueStart));
    await firstDataRow.locator('input[type="date"]').nth(1).fill(formatDateInput(overdueEnd));
    await firstDataRow.locator('input[type="date"]').nth(1).press("Tab");
    const overdueRows = page.locator(".table-body .table-row");
    await firstDataRow.getByRole("button", { name: "子追加" }).click();
    await expect(overdueRows).toHaveCount(2);
    const overdueTaskRow = overdueRows.last();
    const overdueTaskInput = overdueTaskRow.locator("input").first();
    await overdueTaskInput.fill(overdueTaskTitle);
    await overdueTaskInput.press("Tab");
    await overdueTaskRow.locator("select").first().selectOption("task");
    await overdueTaskRow.locator('input[type="date"]').nth(0).fill(formatDateInput(overdueStart));
    await overdueTaskRow.locator('input[type="date"]').nth(1).fill(formatDateInput(overdueEnd));
    await overdueTaskRow.locator('input[type="date"]').nth(1).press("Tab");

    await page.getByLabel("プロジェクト名").fill(milestoneProjectName);
    await page.getByRole("button", { name: "プロジェクト作成" }).click();
    await expect(page.locator(`input[value="${milestoneProjectName}"]`).first()).toBeVisible();
    await page.getByRole("button", { name: "ルート行を追加" }).click();
    const milestoneRow = page.locator(".table-body .table-row").first();
    const milestoneTitleInput = milestoneRow.locator('input[value="新しいタスク"]').first();
    await milestoneTitleInput.fill(milestoneTitle);
    await milestoneTitleInput.press("Tab");
    await milestoneRow.locator("select").first().selectOption("milestone");
    await milestoneRow.locator('input[type="date"]').nth(0).fill(milestoneDateText);
    await milestoneRow.locator('input[type="date"]').nth(1).fill(milestoneDateText);
    await milestoneRow.locator('input[type="date"]').nth(1).press("Tab");
    await page.getByRole("button", { name: "ルート行を追加" }).click();
    const futureRow = page.locator(".table-body .table-row").last();
    const futureTitleInput = futureRow.locator('input[value="新しいタスク"]').first();
    await futureTitleInput.fill(futureTitle);
    await futureTitleInput.press("Tab");
    await futureRow.locator("select").first().selectOption("task");
    await futureRow.locator('input[type="date"]').nth(0).fill(todayText);
    await futureRow.locator('input[type="date"]').nth(1).fill(formatDateInput(futureEnd));
    await futureRow.locator('input[type="date"]').nth(1).press("Tab");

    await app.evaluate(
      async ({ dialog }, filePath) => {
        dialog.showSaveDialog = async () => ({
          canceled: false,
          filePath,
        });
      },
      exportPath
    );
    await page.getByRole("button", { name: "Excel Export" }).click();
    await expect(page.locator(".notice-banner")).toContainText("Excel export:");
    await expect.poll(() => fs.existsSync(exportPath)).toBe(true);
    expect(fs.readFileSync(exportPath).subarray(0, 2)).toEqual(Buffer.from([0x50, 0x4b]));
    await app.evaluate(
      async ({ dialog }, filePath) => {
        dialog.showOpenDialog = async () => ({
          canceled: false,
          filePaths: [filePath],
        });
      },
      exportPath
    );
    await page.getByRole("button", { name: "Excel Import" }).click();
    await expect(page.getByText("Excel Import Preview")).toBeVisible();
    await expect(page.locator(".import-action-pill.update").first()).toBeVisible();
    await expect(page.locator(".import-preview-row").filter({ hasText: milestoneTitle }).first()).toBeVisible();
    await page.getByRole("button", { name: "適用" }).click();
    await expect(page.locator(".notice-banner")).toContainText("Excel import applied:");

    await page.getByRole("button", { name: "Portfolio" }).click();
    await expect(page.locator(".portfolio-table-button").filter({ hasText: overdueProjectName }).first()).toBeVisible();
    await expect(page.locator(".portfolio-table-button").filter({ hasText: milestoneProjectName }).first()).toBeVisible();
    await page.getByRole("button", { name: "遅延中" }).click();
    await expect(page.locator(".portfolio-table-button").filter({ hasText: overdueProjectName }).first()).toBeVisible();
    await page.getByRole("button", { name: "今週マイルストーン" }).click();
    await expect(page.locator(".portfolio-table-button").filter({ hasText: milestoneProjectName }).first()).toBeVisible();
    await expect(page.locator(".portfolio-table-button").filter({ hasText: overdueProjectName })).toHaveCount(0);
    await page.getByRole("button", { name: "全案件" }).click();
    await page.getByRole("button", { name: `${overdueProjectName} の phase を展開する` }).click();
    await expect(page.locator(".portfolio-phase-row").filter({ hasText: overdueTitle }).first()).toBeVisible();
    await page.getByRole("button", { name: "Year / FY" }).click();
    await expect(page.getByRole("heading", { name: "長期計画を月単位で俯瞰" })).toBeVisible();
    await expect(page.locator(".roadmap-quarter-cell").filter({ hasText: "Q1" }).first()).toBeVisible();
    await expect(page.locator(".roadmap-header-cell").filter({ hasText: "4" }).first()).toBeVisible();
    await expect(page.locator(".roadmap-title-cell").filter({ hasText: overdueTitle }).first()).toBeVisible();
    await expect(page.locator(".roadmap-title-cell").filter({ hasText: milestoneTitle }).first()).toBeVisible();
    await expect(page.locator(".roadmap-title-cell").filter({ hasText: futureTitle }).first()).toBeVisible();
    await page.getByRole("button", { name: `${overdueTitle} を展開する` }).click();
    await expect(page.locator(".roadmap-title-cell").filter({ hasText: overdueTaskTitle }).first()).toBeVisible();
    await page.getByRole("button", { name: "期限超過" }).click();
    await expect(page.locator(".roadmap-title-cell").filter({ hasText: overdueTitle }).first()).toBeVisible();
    await expect(page.locator(".roadmap-title-cell").filter({ hasText: overdueTaskTitle }).first()).toBeVisible();
    await expect(page.locator(".roadmap-bar").first()).toBeVisible();
  } finally {
    await app.close();
  }
});

test("desktop shell filters import preview rows by warning and error", async () => {
  const app = await electron.launch({
    executablePath: electronExecutable,
    args: [path.join(process.cwd(), ".")],
  });

  try {
    const page = await app.firstWindow();
    const exportPath = path.join(os.tmpdir(), `sgc-import-filter-${Date.now()}.xlsx`);
    const timestamp = Date.now();
    const projectName = `E2E Import Filter ${timestamp}`;
    const taskATitle = `Cycle Source ${timestamp}`;
    const taskAUpdatedTitle = `${taskATitle} Updated`;
    const taskBTitle = `Error Target ${timestamp}`;

    await expect(page.getByRole("heading", { name: "Simple Gantt Chart" })).toBeVisible();
    await page.getByLabel("プロジェクト名").fill(projectName);
    await page.getByRole("button", { name: "プロジェクト作成" }).click();
    await expect(page.locator(`input[value="${projectName}"]`).first()).toBeVisible();

    await page.getByRole("button", { name: "ルート行を追加" }).click();
    const firstRow = page.locator(".table-body .table-row").first();
    await firstRow.locator('input[value="新しいタスク"]').first().fill(taskATitle);
    await firstRow.locator('input[value="新しいタスク"]').first().press("Tab");

    await page.getByRole("button", { name: "ルート行を追加" }).click();
    const secondRow = page.locator(".table-body .table-row").last();
    await secondRow.locator('input[value="新しいタスク"]').first().fill(taskBTitle);
    await secondRow.locator('input[value="新しいタスク"]').first().press("Tab");

    const ids = await page.evaluate(async ({ targetProjectName, targetTaskATitle, targetTaskBTitle }) => {
      if (!window.sgc) {
        throw new Error("Renderer API unavailable");
      }
      const projects = await window.sgc.projects.list();
      const project = projects.find((entry) => entry.name === targetProjectName);
      if (!project) {
        throw new Error("Project not found in renderer context");
      }
      const detail = await window.sgc.projects.get(project.id);
      const taskA = detail.items.find((item) => item.title === targetTaskATitle);
      const taskB = detail.items.find((item) => item.title === targetTaskBTitle);
      if (!taskA || !taskB) {
        throw new Error("Tasks not found in renderer context");
      }
      return { projectId: project.id, taskAId: taskA.id, taskBId: taskB.id };
    }, { targetProjectName: projectName, targetTaskATitle: taskATitle, targetTaskBTitle: taskBTitle });

    await page.evaluate(async ({ taskAId, taskBId, targetTaskATitle }) => {
      if (!window.sgc) {
        throw new Error("Renderer API unavailable");
      }
      await window.sgc.items.update({
        id: taskAId,
        title: targetTaskATitle,
        startDate: "2026-05-10",
        endDate: "2026-05-11",
      });
      await window.sgc.dependencies.create({
        predecessorItemId: taskAId,
        successorItemId: taskBId,
        type: "finish_to_start",
        lagDays: 0,
      });
    }, { ...ids, targetTaskATitle: taskATitle });

    await app.evaluate(
      async ({ dialog }, filePath) => {
        dialog.showSaveDialog = async () => ({
          canceled: false,
          filePath,
        });
      },
      exportPath
    );
    await page.getByRole("button", { name: "Excel Export" }).click();
    await expect.poll(() => fs.existsSync(exportPath)).toBe(true);

    const mutatedWorkbook = buildRoundTripWorkbookFixture({
      exportedWorkbookBytes: fs.readFileSync(exportPath),
      mutateRows: (rows) =>
        rows.map((row) => {
          if (row.RecordId === ids.taskAId) {
            return {
              ...row,
              Title: taskAUpdatedTitle,
              EndDate: "2026-05-13",
              DueDate: "2026-05-13",
              DependsOn: ids.taskBId,
            };
          }
          if (row.RecordId === ids.taskBId) {
            return {
              ...row,
              ParentRecordId: "itm-missing-parent",
            };
          }
          return row;
        }),
    });
    fs.writeFileSync(exportPath, Buffer.from(mutatedWorkbook));

    await app.evaluate(
      async ({ dialog }, filePath) => {
        dialog.showOpenDialog = async () => ({
          canceled: false,
          filePaths: [filePath],
        });
      },
      exportPath
    );
    await page.getByRole("button", { name: "Excel Import" }).click();
    await expect(page.getByText("Excel Import Preview")).toBeVisible();
    await expect(page.getByRole("button", { name: "Warning" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Error" })).toBeVisible();
    await expect(page.getByText("Warning Summary")).toBeVisible();
    await expect(page.getByText("Warning-only Table")).toBeVisible();
    await expect(
      page.locator(".import-preview-warning-summary-row").filter({ hasText: taskAUpdatedTitle }).first()
    ).toBeVisible();
    await expect(
      page
        .locator(".import-preview-warning-summary-row")
        .filter({ hasText: taskAUpdatedTitle })
        .locator(".import-preview-warning")
        .filter({ hasText: "DependsOn: would create dependency cycle on apply" })
    ).toBeVisible();
    const warningOnlyList = page.locator('[aria-label="Warning-only Table"]');
    await expect(
      warningOnlyList.locator(".import-preview-warning-table-row").filter({ hasText: taskAUpdatedTitle }).first()
    ).toBeVisible();
    await expect(
      warningOnlyList.locator(".import-preview-warning-table-row").filter({ hasText: taskBTitle })
    ).toHaveCount(0);

    await page.getByRole("button", { name: "Warning" }).click();
    const warningRow = page.locator(".import-preview-row").filter({ hasText: taskAUpdatedTitle }).first();
    await expect(warningRow).toBeVisible();
    await expect(page.locator(".import-preview-row").filter({ hasText: taskBTitle })).toHaveCount(0);
    await expect(
      warningRow.locator(".import-preview-warning").filter({ hasText: "DependsOn: would create dependency cycle on apply" })
    ).toBeVisible();
    await warningRow.getByRole("button", { name: "差分" }).click();
    const comparePanel = warningRow.locator('[aria-label="Row 2 compare"]');
    await expect(comparePanel).toBeVisible();
    await expect(comparePanel).toContainText("Title");
    await expect(comparePanel).toContainText(taskATitle);
    await expect(comparePanel).toContainText(taskAUpdatedTitle);
    await expect(comparePanel).toContainText("EndDate");
    await expect(comparePanel).toContainText("2026-05-11");
    await expect(comparePanel).toContainText("2026-05-13");

    await page.getByRole("button", { name: "Error" }).click();
    await expect(page.locator(".import-preview-row").filter({ hasText: taskBTitle }).first()).toBeVisible();
    await expect(page.locator(".import-preview-row").filter({ hasText: taskAUpdatedTitle })).toHaveCount(0);
    await expect(
      page
        .locator(".import-preview-row")
        .filter({ hasText: taskBTitle })
        .locator(".import-preview-issue")
        .filter({ hasText: "ParentRecordId: not found" })
    ).toBeVisible();
  } finally {
    await app.close();
  }
});

test("detail drawer dependency editor adds and removes predecessor links", async () => {
  const app = await electron.launch({
    executablePath: electronExecutable,
    args: [path.join(process.cwd(), ".")],
  });

  try {
    const page = await app.firstWindow();
    const timestamp = Date.now();
    const projectName = `E2E Dependency Editor ${timestamp}`;
    const predecessorTitle = `Dependency Source ${timestamp}`;
    const successorTitle = `Dependency Target ${timestamp}`;

    await expect(page.getByRole("heading", { name: "Simple Gantt Chart" })).toBeVisible();
    await page.getByLabel("プロジェクト名").fill(projectName);
    await page.getByRole("button", { name: "プロジェクト作成" }).click();
    await expect(page.locator(`input[value="${projectName}"]`).first()).toBeVisible();

    await page.getByRole("button", { name: "ルート行を追加" }).click();
    const firstRow = page.locator(".table-body .table-row").first();
    const firstTitleInput = firstRow.locator('input[value="新しいタスク"]').first();
    await firstTitleInput.fill(predecessorTitle);
    await firstTitleInput.press("Tab");

    await page.getByRole("button", { name: "ルート行を追加" }).click();
    const secondRow = page.locator(".table-body .table-row").last();
    const secondTitleInput = secondRow.locator('input[value="新しいタスク"]').first();
    await secondTitleInput.fill(successorTitle);
    await secondTitleInput.press("Tab");

    await secondRow.getByRole("button", { name: "詳細" }).click();
    await expect(page.locator(".detail-drawer")).toContainText(successorTitle);

    await page.getByLabel("先行タスク").selectOption({ index: 0 });
    await page.getByLabel("Lag Days").fill("2");
    await page.getByRole("button", { name: "先行を追加" }).click();

    const dependencyRow = page.locator(".dependency-row").filter({ hasText: predecessorTitle }).first();
    await expect(dependencyRow).toContainText(successorTitle);
    await expect(dependencyRow).toContainText("lag 2");

    await dependencyRow.getByRole("button", { name: /を削除$/ }).click();
    await expect(page.locator(".dependency-row").filter({ hasText: predecessorTitle })).toHaveCount(0);
    await expect(page.locator(".detail-placeholder").filter({ hasText: "linked dependency はありません。" })).toBeVisible();
  } finally {
    await app.close();
  }
});

test("timeline bar supports keyboard move and resize", async () => {
  const app = await electron.launch({
    executablePath: electronExecutable,
    args: [path.join(process.cwd(), ".")],
  });

  try {
    const page = await app.firstWindow();
    const timestamp = Date.now();
    const projectName = `E2E Timeline Keyboard ${timestamp}`;
    const firstTaskTitle = `Keyboard Timeline A ${timestamp}`;
    const secondTaskTitle = `Keyboard Timeline B ${timestamp}`;

    await expect(page.getByRole("heading", { name: "Simple Gantt Chart" })).toBeVisible();
    await page.getByLabel("プロジェクト名").fill(projectName);
    await page.getByRole("button", { name: "プロジェクト作成" }).click();
    await expect(page.locator(`input[value="${projectName}"]`).first()).toBeVisible();
    await page.evaluate(async ({ targetProjectName, targetFirstTaskTitle, targetSecondTaskTitle }) => {
      if (!window.sgc) {
        throw new Error("Renderer API unavailable");
      }
      const projects = await window.sgc.projects.list();
      const project = projects.find((entry) => entry.name === targetProjectName);
      if (!project) {
        throw new Error("Project not found");
      }
      const firstItem = await window.sgc.items.create({
        projectId: project.id,
        title: targetFirstTaskTitle,
        type: "task",
        parentId: null,
      });
      const secondItem = await window.sgc.items.create({
        projectId: project.id,
        title: targetSecondTaskTitle,
        type: "task",
        parentId: null,
      });
      await window.sgc.items.update({
        id: firstItem.id,
        title: targetFirstTaskTitle,
        startDate: "2026-04-10",
        endDate: "2026-04-14",
      });
      await window.sgc.items.update({
        id: secondItem.id,
        title: targetSecondTaskTitle,
        startDate: "2026-04-15",
        endDate: "2026-04-17",
      });
    }, {
      targetProjectName: projectName,
      targetFirstTaskTitle: firstTaskTitle,
      targetSecondTaskTitle: secondTaskTitle,
    });

    await page.locator(".project-card").filter({ hasText: projectName }).click();
    await expect(page.locator(`input[value="${firstTaskTitle}"]`).first()).toBeVisible();
    await expect(page.locator(`input[value="${secondTaskTitle}"]`).first()).toBeVisible();
    const firstRow = page.locator(".table-body .table-row").nth(0);

    const firstTimelineBar = page.locator(".timeline-bar").nth(0);
    const secondTimelineBar = page.locator(".timeline-bar").nth(1);
    await expect(firstTimelineBar).toBeVisible();
    await expect(secondTimelineBar).toBeVisible();

    await firstTimelineBar.focus();
    await page.keyboard.press("ArrowDown");
    await expect(secondTimelineBar).toBeFocused();
    await expect(page.locator(".detail-drawer")).toContainText(secondTaskTitle);

    await page.keyboard.press("ArrowUp");
    await expect(firstTimelineBar).toBeFocused();
    await expect(page.locator(".detail-drawer")).toContainText(firstTaskTitle);

    await firstTimelineBar.focus();
    await page.keyboard.press("Alt+ArrowRight");

    await expect(firstRow.locator('input[type="date"]').nth(0)).toHaveValue("2026-04-11");
    await expect(firstRow.locator('input[type="date"]').nth(1)).toHaveValue("2026-04-15");

    await firstTimelineBar.focus();
    await page.keyboard.press("Alt+Shift+ArrowRight");

    await expect(firstRow.locator('input[type="date"]').nth(0)).toHaveValue("2026-04-11");
    await expect(firstRow.locator('input[type="date"]').nth(1)).toHaveValue("2026-04-16");
    await expect(page.locator(".detail-drawer")).toContainText(firstTaskTitle);
  } finally {
    await app.close();
  }
});

test("reschedule dialog supports keyboard cancel and scope selection", async () => {
  const app = await electron.launch({
    executablePath: electronExecutable,
    args: [path.join(process.cwd(), ".")],
  });

  try {
    const page = await app.firstWindow();
    const timestamp = Date.now();
    const projectName = `E2E Reschedule Keyboard ${timestamp}`;
    const parentTitle = `Parent Row ${timestamp}`;
    const childTitle = `Child Row ${timestamp}`;

    await expect(page.getByRole("heading", { name: "Simple Gantt Chart" })).toBeVisible();
    await page.getByLabel("プロジェクト名").fill(projectName);
    await page.getByRole("button", { name: "プロジェクト作成" }).click();
    await expect(page.locator(`input[value="${projectName}"]`).first()).toBeVisible();
    await page.evaluate(async ({ targetProjectName, targetParentTitle, targetChildTitle }) => {
      if (!window.sgc) {
        throw new Error("Renderer API unavailable");
      }
      const projects = await window.sgc.projects.list();
      const project = projects.find((entry) => entry.name === targetProjectName);
      if (!project) {
        throw new Error("Project not found");
      }
      const parentItem = await window.sgc.items.create({
        projectId: project.id,
        title: targetParentTitle,
        type: "group",
        parentId: null,
      });
      const childItem = await window.sgc.items.create({
        projectId: project.id,
        title: targetChildTitle,
        type: "task",
        parentId: parentItem.id,
      });
      await window.sgc.items.update({
        id: parentItem.id,
        title: targetParentTitle,
        startDate: "2026-04-10",
        endDate: "2026-04-14",
      });
      await window.sgc.items.update({
        id: childItem.id,
        title: targetChildTitle,
        startDate: "2026-04-11",
        endDate: "2026-04-12",
      });
    }, {
      targetProjectName: projectName,
      targetParentTitle: parentTitle,
      targetChildTitle: childTitle,
    });

    await page.locator(".project-card").filter({ hasText: projectName }).click();
    await expect(page.locator(`input[value="${parentTitle}"]`).first()).toBeVisible();
    await expect(page.locator(`input[value="${childTitle}"]`).first()).toBeVisible();

    const parentRow = page.locator(".table-body .table-row").filter({
      has: page.locator(`input[value="${parentTitle}"]`),
    }).first();
    const childRow = page.locator(".table-body .table-row").filter({
      has: page.locator(`input[value="${childTitle}"]`),
    }).first();
    const parentTimelineBar = page.locator(".timeline-bar").nth(0);
    const initialParentStart = await parentRow.locator('input[type="date"]').nth(0).inputValue();
    const initialParentEnd = await parentRow.locator('input[type="date"]').nth(1).inputValue();
    const initialChildStart = await childRow.locator('input[type="date"]').nth(0).inputValue();
    const initialChildEnd = await childRow.locator('input[type="date"]').nth(1).inputValue();

    await parentTimelineBar.focus();
    await page.keyboard.press("Alt+ArrowRight");
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("button", { name: "子も一緒に" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(parentRow.locator('input[type="date"]').nth(0)).toHaveValue(initialParentStart);
    await expect(parentRow.locator('input[type="date"]').nth(1)).toHaveValue(initialParentEnd);
    await expect(childRow.locator('input[type="date"]').nth(0)).toHaveValue(initialChildStart);
    await expect(childRow.locator('input[type="date"]').nth(1)).toHaveValue(initialChildEnd);

    await parentTimelineBar.focus();
    await page.keyboard.press("Alt+ArrowRight");
    await expect(page.getByRole("button", { name: "子も一緒に" })).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(page.getByRole("button", { name: "このタスクだけ" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await expect(parentRow.locator('input[type="date"]').nth(0)).toHaveValue(
      formatDateInput(addDays(new Date(`${initialParentStart}T00:00:00`), 1))
    );
    await expect(parentRow.locator('input[type="date"]').nth(1)).toHaveValue(
      formatDateInput(addDays(new Date(`${initialParentEnd}T00:00:00`), 1))
    );
    await expect(childRow.locator('input[type="date"]').nth(0)).toHaveValue(initialChildStart);
    await expect(childRow.locator('input[type="date"]').nth(1)).toHaveValue(initialChildEnd);
  } finally {
    await app.close();
  }
});

function addDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function formatDateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}
