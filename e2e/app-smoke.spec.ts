import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import electronPackage from "electron";
import { _electron as electron } from "playwright";
import { DatabaseManager } from "../src/infra/db/database";
import { WorkspaceService } from "../src/main/services/workspace-service";
import { buildRoundTripWorkbookFixture } from "../src/test/excel-roundtrip-fixtures";

const electronExecutable = electronPackage as unknown as string;

test("desktop shell renders portfolio expand and roadmap month bar", async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "sgc-roadmap-workload-e2e-"));
  const app = await electron.launch({
    executablePath: electronExecutable,
    args: [path.join(process.cwd(), "."), `--user-data-dir=${userDataDir}`],
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
    const milestoneDateText = todayText;
    const overdueStart = addDays(today, -5);
    const overdueEnd = addDays(today, -4);
    const futureEnd = addDays(today, 20);

    await expect(page.getByRole("heading", { name: "Simple Gantt Chart" })).toBeVisible();
    await page.getByLabel("プロジェクト名").fill(overdueProjectName);
    await page.getByRole("button", { name: "プロジェクト作成" }).click();

    await expect(page.getByRole("button", { name: "Project Detail" })).toBeEnabled();
    await expect(page.locator(`input[value="${overdueProjectName}"]`).first()).toBeVisible();
    await page.getByLabel("メイン担当").fill("佐藤");
    await page.getByLabel("メイン担当").press("Tab");
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
    await page.evaluate(async ({ targetProjectName, targetTaskTitle }) => {
      if (!window.sgc) {
        throw new Error("Renderer API unavailable");
      }
      const project = (await window.sgc.projects.list()).find((entry) => entry.name === targetProjectName);
      if (!project) {
        throw new Error("Project not found");
      }
      const detail = await window.sgc.projects.get(project.id);
      const task = detail.items.find((entry) => entry.title === targetTaskTitle);
      if (!task) {
        throw new Error("Task not found");
      }
      await window.sgc.items.update({
        id: task.id,
        assigneeName: "田中",
      });
    }, { targetProjectName: overdueProjectName, targetTaskTitle: overdueTaskTitle });
    await page.locator(".project-card").filter({ hasText: overdueProjectName }).click();
    await expect(page.getByText("担当者別の状況")).toBeVisible();
    await expect(page.locator(".assignee-summary-chip").filter({ hasText: "佐藤" }).first()).toBeVisible();
    await expect(page.locator(".assignee-summary-chip").filter({ hasText: "田中" }).first()).toBeVisible();

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
    await expect(page.getByText("担当者別タスク状況")).toBeVisible();
    await expect(page.locator(".assignee-board .assignee-summary-chip").filter({ hasText: "田中" }).first()).toBeVisible();
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
    await expect(page.getByRole("heading", { name: "長期計画を月単位で俯瞰" })).toHaveCount(0);
    await expect(page.getByText("project と主要 row を month bucket")).toHaveCount(0);
    await expect(page.getByText("年間の月別負荷")).toHaveCount(0);
    await expect(page.locator(".roadmap-workload-row")).toHaveCount(0);
    await expect(page.locator(".roadmap-toolbar")).toHaveCSS("max-height", "34px");
    await expect(page.locator(".roadmap-overview")).toHaveCSS("padding-top", "4px");
    await expect(page.locator(".roadmap-overview")).toHaveCSS("padding-bottom", "4px");
    await expect(page.locator(".roadmap-overview")).toHaveCSS("max-height", "44px");
    await expect(page.locator(".roadmap-overview")).toHaveCSS("gap", "0px");
    await expect(page.locator(".roadmap-stack")).toHaveCSS("gap", "0px");
    await expect(page.locator(".roadmap-stack")).toHaveCSS("grid-template-rows", /44px/);
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const overview = document.querySelector(".roadmap-overview")?.getBoundingClientRect();
          const panel = document.querySelector(".roadmap-panel")?.getBoundingClientRect();
          return overview && panel ? panel.top - overview.bottom : null;
        })
      )
      .toBe(0);
    await expect(page.locator(".roadmap-panel")).toHaveCSS("padding-top", "8px");
    await expect(page.locator(".roadmap-panel")).toHaveCSS("padding-bottom", "12px");
    await expect(page.locator(".roadmap-year-cell").filter({ hasText: String(today.getFullYear()) }).first()).toBeVisible();
    await expect(page.locator(".roadmap-quarter-cell").filter({ hasText: "Q4" }).first()).toBeVisible();
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
    await page.getByRole("button", { name: "全件" }).click();
    await page.locator(".roadmap-year-span-slider input").press("ArrowRight");
    await expect(page.locator(".roadmap-header-cell")).toHaveCount(24);
    await expect(page.getByText(`${today.getFullYear()}年 - ${today.getFullYear() + 1}年`)).toBeVisible();
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.getByRole("checkbox", { name: "年次FY画面に月別負荷を表示" }).check();
    await page.getByRole("button", { name: "設定を保存" }).click();
    await expect(page.locator(".notice-banner")).toContainText("Settings saved");
    await page.getByRole("button", { name: "Year / FY" }).click();
    await expect(page.getByText("年間の月別負荷")).toHaveCount(0);
    await expect(page.locator(".roadmap-workload-cell").first()).toBeVisible();
    expect(
      await page.evaluate(() => {
        const workloadRow = document.querySelector(".roadmap-workload-row");
        return workloadRow?.nextElementSibling?.classList.contains("roadmap-year-header") ?? false;
      })
    ).toBe(true);
  } finally {
    await app.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
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

test("project detail row context menu opens and triggers row actions", async () => {
  const app = await electron.launch({
    executablePath: electronExecutable,
    args: [path.join(process.cwd(), ".")],
  });

  try {
    const page = await app.firstWindow();
    const timestamp = Date.now();
    const projectName = `E2E Context Menu ${timestamp}`;
    const firstTitle = `Context Root A ${timestamp}`;
    const secondTitle = `Context Root B ${timestamp}`;

    await expect(page.getByRole("heading", { name: "Simple Gantt Chart" })).toBeVisible();
    await page.getByLabel("プロジェクト名").fill(projectName);
    await page.getByRole("button", { name: "プロジェクト作成" }).click();
    await expect(page.locator(`input[value="${projectName}"]`).first()).toBeVisible();

    await page.getByRole("button", { name: "ルート行を追加" }).click();
    const firstRow = page.locator(".table-body .table-row").first();
    await firstRow.locator('input[value="新しいタスク"]').first().fill(firstTitle);
    await firstRow.locator('input[value="新しいタスク"]').first().press("Tab");

    await page.getByRole("button", { name: "ルート行を追加" }).click();
    const secondRow = page.locator(".table-body .table-row").last();
    await secondRow.locator('input[value="新しいタスク"]').first().fill(secondTitle);
    await secondRow.locator('input[value="新しいタスク"]').first().press("Tab");

    const targetRow = page.locator(".table-body .table-row").filter({
      has: page.locator(`input[value="${secondTitle}"]`),
    }).first();

    await targetRow.click({ button: "right" });
    const contextMenu = page.getByRole("menu", { name: "Project Detail Context Menu" });
    await expect(contextMenu).toBeVisible();
    await expect(contextMenu).toContainText(secondTitle);
    await contextMenu.getByRole("menuitem", { name: "詳細" }).click();
    await expect(contextMenu).toHaveCount(0);
    await expect(page.locator(".detail-drawer")).toContainText(secondTitle);

    const rowCountBeforeChild = await page.locator(".table-body .table-row").count();
    await targetRow.click({ button: "right" });
    await expect(contextMenu).toBeVisible();
    await contextMenu.getByRole("menuitem", { name: "子追加" }).click();
    await expect(contextMenu).toHaveCount(0);
    await expect(page.locator(".table-body .table-row")).toHaveCount(rowCountBeforeChild + 1);
  } finally {
    await app.close();
  }
});

test("project detail row drag reorder moves sibling subtree", async () => {
  const app = await electron.launch({
    executablePath: electronExecutable,
    args: [path.join(process.cwd(), ".")],
  });

  try {
    const page = await app.firstWindow();
    const timestamp = Date.now();
    const projectName = `E2E Row Reorder ${timestamp}`;
    const rootATitle = `Reorder Root A ${timestamp}`;
    const rootBTitle = `Reorder Root B ${timestamp}`;
    const childBTitle = `Reorder Child B-1 ${timestamp}`;
    const rootCTitle = `Reorder Root C ${timestamp}`;

    await expect(page.getByRole("heading", { name: "Simple Gantt Chart" })).toBeVisible();
    await page.getByLabel("プロジェクト名").fill(projectName);
    await page.getByRole("button", { name: "プロジェクト作成" }).click();
    await expect(page.locator(`input[value="${projectName}"]`).first()).toBeVisible();

    await page.getByRole("button", { name: "ルート行を追加" }).click();
    const firstRow = page.locator(".table-body .table-row").first();
    await firstRow.locator('input[value="新しいタスク"]').first().fill(rootATitle);
    await firstRow.locator('input[value="新しいタスク"]').first().press("Tab");

    await page.getByRole("button", { name: "ルート行を追加" }).click();
    const secondRow = page.locator(".table-body .table-row").last();
    await secondRow.locator('input[value="新しいタスク"]').first().fill(rootBTitle);
    await secondRow.locator('input[value="新しいタスク"]').first().press("Tab");

    const rootBRow = page.locator(".table-body .table-row").filter({
      has: page.locator(`input[value="${rootBTitle}"]`),
    }).first();
    const rowCountBeforeChild = await page.locator(".table-body .table-row").count();
    await rootBRow.click({ button: "right" });
    const contextMenu = page.getByRole("menu", { name: "Project Detail Context Menu" });
    await contextMenu.getByRole("menuitem", { name: "子追加" }).click();
    await expect(page.locator(".table-body .table-row")).toHaveCount(rowCountBeforeChild + 1);
    const childTitleInput = page.locator(".table-body .table-row").last().locator("input").first();
    await childTitleInput.fill(childBTitle);
    await childTitleInput.press("Tab");

    const rowCountBeforeRootC = await page.locator(".table-body .table-row").count();
    await page.getByRole("button", { name: "ルート行を追加" }).click();
    await expect(page.locator(".table-body .table-row")).toHaveCount(rowCountBeforeRootC + 1);
    const rootCTitleInput = page.locator(".table-body .table-row").last().locator("input").first();
    await rootCTitleInput.fill(rootCTitle);
    await rootCTitleInput.press("Tab");

    const rootARow = page.locator(".table-body .table-row").filter({
      has: page.locator(`input[value="${rootATitle}"]`),
    }).first();

    const reorderHandle = rootBRow.getByRole("button", { name: "並び替え" });
    const targetBounds = await rootARow.boundingBox();
    if (!targetBounds) {
      throw new Error("Target row bounds unavailable");
    }
    const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
    await reorderHandle.dispatchEvent("dragstart", { dataTransfer });
    await rootARow.dispatchEvent("dragover", {
      dataTransfer,
      clientY: targetBounds.y + 4,
    });
    await rootARow.dispatchEvent("drop", {
      dataTransfer,
      clientY: targetBounds.y + 4,
    });
    await reorderHandle.dispatchEvent("dragend", { dataTransfer });

    await expect
      .poll(async () =>
        page
          .locator(".table-body .table-row .title-cell input")
          .evaluateAll((inputs) =>
            inputs.map((input) => (input instanceof HTMLInputElement ? input.value : ""))
          )
      )
      .toEqual([rootBTitle, childBTitle, rootATitle, rootCTitle]);
  } finally {
    await app.close();
  }
});

test("project detail search filter preserves ancestor path and shared row window", async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "sgc-project-filter-e2e-"));
  const dbPath = path.join(userDataDir, "data", "sgc.sqlite");
  const bootstrapManager = new DatabaseManager(dbPath);
  await bootstrapManager.initialize();
  const bootstrapService = new WorkspaceService(bootstrapManager);
  const timestamp = Date.now();
  const projectName = `Project Filter ${timestamp}`;
  const parentTitle = `Filter Parent ${timestamp}`;
  const matchingChildTitle = `Matched Child ${timestamp}`;
  const siblingTitle = `Sibling Hidden ${timestamp}`;
  const project = bootstrapService.createProject({
    name: projectName,
    code: `FLT-${timestamp}`,
  });
  const parent = bootstrapService.createItem({
    projectId: project.id,
    title: parentTitle,
    type: "group",
  });
  bootstrapService.createItem({
    projectId: project.id,
    parentId: parent.id,
    title: matchingChildTitle,
    type: "task",
  });
  bootstrapService.createItem({
    projectId: project.id,
    parentId: parent.id,
    title: siblingTitle,
    type: "task",
  });

  const app = await electron.launch({
    executablePath: electronExecutable,
    args: [path.join(process.cwd(), ".")],
    env: {
      ...process.env,
      SGC_USER_DATA_DIR: userDataDir,
    },
  });

  try {
    const page = await app.firstWindow();
    await expect(page.getByRole("heading", { name: "Simple Gantt Chart" })).toBeVisible();
    const projectCard = page.locator(".project-card").filter({ hasText: projectName }).first();
    await expect(projectCard).toBeVisible();
    await projectCard.click();
    await expect(page.locator(`input[value="${projectName}"]`).first()).toBeVisible();

    await page.getByRole("button", { name: "Search / Filter" }).click();
    const drawer = page.getByRole("dialog", { name: "current view を絞り込みます" });
    await drawer.getByLabel("全文").fill("Matched Child");
    await drawer.getByRole("button", { name: "閉じる" }).click();

    await expect(page.locator(`.table-body input[value="${parentTitle}"]`).first()).toBeVisible();
    await expect(page.locator(`.table-body input[value="${matchingChildTitle}"]`).first()).toBeVisible();
    await expect(page.locator(`.table-body input[value="${siblingTitle}"]`)).toHaveCount(0);
    await expect(page.locator(".search-filter-chip").filter({ hasText: "全文: Matched Child" })).toBeVisible();
    await expect(page.locator(".table-body .table-row")).toHaveCount(2);
    await expect(page.locator(".timeline-body .timeline-row")).toHaveCount(2);

    await page.getByRole("button", { name: "Clear" }).click();
    await expect(page.locator(`.table-body input[value="${siblingTitle}"]`).first()).toBeVisible();
  } finally {
    await app.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
});

test("settings shell persists week start, FY start month, and default view", async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "sgc-settings-e2e-"));
  const dbPath = path.join(userDataDir, "data", "sgc.sqlite");
  const bootstrapManager = new DatabaseManager(dbPath);
  await bootstrapManager.initialize();
  const bootstrapService = new WorkspaceService(bootstrapManager);
  const timestamp = Date.now();
  const project = bootstrapService.createProject({
    name: `Settings Project ${timestamp}`,
    code: `SET-${String(timestamp).slice(-6)}`,
  });
  const milestoneTitle = `Sunday Milestone ${timestamp}`;
  const milestone = bootstrapService.createItem({
    projectId: project.id,
    title: milestoneTitle,
    type: "milestone",
  });
  bootstrapService.updateItem({
    id: milestone.id,
    startDate: "2026-04-19",
    endDate: "2026-04-19",
  });

  const launchApp = () =>
    electron.launch({
      executablePath: electronExecutable,
      args: [path.join(process.cwd(), ".")],
      env: {
        ...process.env,
        SGC_USER_DATA_DIR: userDataDir,
      },
    });

  const firstApp = await launchApp();

  try {
    const page = await firstApp.firstWindow();

    await expect(page.getByRole("heading", { name: "Simple Gantt Chart" })).toBeVisible();
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await expect(page.getByRole("heading", { name: "主要設定" })).toBeVisible();

    await page.getByLabel("保持件数").selectOption("3");
    await page.getByRole("checkbox", { name: "自動バックアップ" }).uncheck();
    await page.getByLabel("優先度既定値").selectOption("critical");
    await page.getByLabel("担当既定値").fill("佐藤");
    await page.getByLabel("週開始曜日").selectOption("sunday");
    await page.getByLabel("FY開始月").selectOption("7");
    await page.getByRole("checkbox", { name: "年次FY画面に月別負荷を表示" }).check();
    await page.getByRole("checkbox", { name: "金曜" }).uncheck();
    await page.getByRole("checkbox", { name: "日曜" }).check();
    await page.getByLabel("既定表示").selectOption("roadmap");
    await page.getByRole("button", { name: "設定を保存" }).click();
    await expect(page.locator(".notice-banner")).toContainText("Settings saved");
    await expect(page.getByText("自動: 無効 / manual と safety backup は保持").first()).toBeVisible();
  } finally {
    await firstApp.close();
  }

  const secondApp = await launchApp();

  try {
    const page = await secondApp.firstWindow();

    await expect(page.getByRole("heading", { name: "長期計画を月単位で俯瞰" })).toHaveCount(0);
    await page.getByRole("button", { name: "FY", exact: true }).click();
    await expect(page.locator(".roadmap-header-cell").first()).toContainText("7");
    await expect(page.locator(".roadmap-workload-cell").first()).toBeVisible();

    await page.getByRole("button", { name: "Home / Today" }).click();
    await expect(page.getByText(milestoneTitle).first()).toBeVisible();

    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await expect(page.getByRole("checkbox", { name: "自動バックアップ" })).not.toBeChecked();
    await expect(page.getByLabel("保持件数")).toHaveValue("3");
    await expect(page.getByLabel("優先度既定値")).toHaveValue("critical");
    await expect(page.getByLabel("担当既定値")).toHaveValue("佐藤");
    await expect(page.getByLabel("週開始曜日")).toHaveValue("sunday");
    await expect(page.getByLabel("FY開始月")).toHaveValue("7");
    await expect(page.getByRole("checkbox", { name: "年次FY画面に月別負荷を表示" })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: "日曜" })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: "金曜" })).not.toBeChecked();
    await expect(page.getByLabel("既定表示")).toHaveValue("roadmap");
    await expect(page.getByText("自動: 無効 / manual と safety backup は保持").first()).toBeVisible();
  } finally {
    await secondApp.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
});

test("settings language persists and switches major UI copy to English", async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "sgc-settings-language-e2e-"));

  const launchApp = () =>
    electron.launch({
      executablePath: electronExecutable,
      args: [path.join(process.cwd(), ".")],
      env: {
        ...process.env,
        SGC_USER_DATA_DIR: userDataDir,
      },
    });

  const firstApp = await launchApp();

  try {
    const page = await firstApp.firstWindow();

    await expect(page.getByRole("heading", { name: "Simple Gantt Chart" })).toBeVisible();
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await expect(page.getByRole("heading", { name: "主要設定" })).toBeVisible();

    await page.getByLabel("表示言語").selectOption("en");
    await page.getByRole("button", { name: "設定を保存" }).click();

    await expect(page.locator(".notice-banner")).toContainText("Settings saved");
    await expect(page.getByRole("heading", { name: "Core Preferences" })).toBeVisible();
    await expect(page.locator(".nav-stack")).toContainText("Project Detail");

    await page.getByRole("button", { name: "Home / Today" }).click();
    await expect(page.getByRole("heading", { name: "Add what you need to do today in one line" })).toBeVisible();

    await page.getByRole("button", { name: "Year / FY" }).click();
    await expect(page.getByRole("heading", { name: "No Roadmap Projects" })).toBeVisible();
  } finally {
    await firstApp.close();
  }

  const secondApp = await launchApp();

  try {
    const page = await secondApp.firstWindow();

    await expect(page.getByRole("heading", { name: "Add what you need to do today in one line" })).toBeVisible();
    await expect(page.locator(".nav-stack")).toContainText("Settings");

    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Core Preferences" })).toBeVisible();
    await expect(page.getByLabel("Language")).toHaveValue("en");
    await expect(page.getByLabel("Week Starts On")).toBeVisible();
    await expect(page.getByRole("button", { name: "Save Settings" })).toBeVisible();
  } finally {
    await secondApp.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
});

test("english mode localizes search drawer, import preview, and restore preview", async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "sgc-language-overlay-e2e-"));
  const dbPath = path.join(userDataDir, "data", "sgc.sqlite");
  const bootstrapManager = new DatabaseManager(dbPath);
  await bootstrapManager.initialize();
  const bootstrapService = new WorkspaceService(bootstrapManager);
  const timestamp = Date.now();
  const projectName = `Overlay Language ${timestamp}`;
  const taskTitle = `Overlay Task ${timestamp}`;
  const project = bootstrapService.createProject({
    name: projectName,
    code: `OVR-${String(timestamp).slice(-6)}`,
  });
  const task = bootstrapService.createItem({
    projectId: project.id,
    title: taskTitle,
    type: "task",
  });
  bootstrapService.updateItem({
    id: task.id,
    startDate: "2026-05-01",
    endDate: "2026-05-03",
  });

  const app = await electron.launch({
    executablePath: electronExecutable,
    args: [path.join(process.cwd(), ".")],
    env: {
      ...process.env,
      SGC_USER_DATA_DIR: userDataDir,
    },
  });

  try {
    const page = await app.firstWindow();
    const exportPath = path.join(os.tmpdir(), `sgc-language-overlay-${Date.now()}.xlsx`);

    await expect(page.getByRole("heading", { name: "Simple Gantt Chart" })).toBeVisible();
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.getByLabel("表示言語").selectOption("en");
    await page.getByRole("button", { name: "設定を保存" }).click();
    await expect(page.getByRole("heading", { name: "Core Preferences" })).toBeVisible();

    await page.getByRole("button", { name: "Home / Today" }).click();
    await page.getByRole("button", { name: "Search / Filter" }).click();
    const drawer = page.getByRole("dialog", { name: "Filter the current view" });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByLabel("Keyword")).toBeVisible();
    await expect(drawer.getByLabel("Project")).toBeVisible();
    await drawer.getByLabel("Keyword").fill(taskTitle);
    await expect(page.locator(".search-filter-chip").filter({ hasText: `Keyword: ${taskTitle}` })).toBeVisible();
    await drawer.getByRole("button", { name: "Close" }).click();

    const projectCard = page.locator(".project-card").filter({ hasText: projectName }).first();
    await projectCard.click();
    await expect(page.locator(`input[value="${projectName}"]`).first()).toBeVisible();

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
    const importPreview = page.locator(".import-preview-panel");
    await expect(importPreview).toContainText("Excel Import Preview");
    await expect(importPreview.getByRole("button", { name: "Apply" })).toBeVisible();
    await expect(importPreview.getByRole("button", { name: "Close" })).toBeVisible();
    await importPreview.getByRole("button", { name: "Close" }).click();

    await page.getByRole("button", { name: "Backup now" }).click();
    await expect(page.locator(".notice-banner")).toContainText("Backup created:");
    const backupRow = page.locator(".backup-list-item").first();
    await backupRow.getByRole("button", { name: "Restore Preview" }).click();
    const backupPreview = page.locator(".backup-preview-card");
    await expect(backupPreview).toContainText("Restore Preview");
    await expect(backupPreview).toContainText("Review the backup snapshot only. The current database is not changed yet.");
    await expect(backupPreview.getByRole("button", { name: "Close" })).toBeVisible();
  } finally {
    await app.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
});

test("settings theme persists and switches major shell palette", async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "sgc-settings-theme-e2e-"));

  const launchApp = () =>
    electron.launch({
      executablePath: electronExecutable,
      args: [path.join(process.cwd(), ".")],
      env: {
        ...process.env,
        SGC_USER_DATA_DIR: userDataDir,
      },
    });

  const firstApp = await launchApp();

  try {
    const page = await firstApp.firstWindow();

    await expect(page.getByRole("heading", { name: "Simple Gantt Chart" })).toBeVisible();
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await expect(page.getByRole("heading", { name: "主要設定" })).toBeVisible();

    await page.getByLabel("テーマ").selectOption("dark");
    await page.getByRole("button", { name: "設定を保存" }).click();

    await expect(page.locator(".shell")).toHaveAttribute("data-theme", "dark");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.getByLabel("テーマ")).toHaveValue("dark");
    await expect(page.locator(".sidebar")).toHaveCSS("background-color", "rgba(34, 28, 24, 0.9)");
    await expect(page.getByRole("button", { name: "設定を保存" })).toHaveCSS(
      "background-color",
      "rgb(137, 169, 141)"
    );
    await expectCssVariable(page, "--status-done-bg", "#36593fdb");
    await expectCssVariable(page, "--row-header-bg", "#42362df5");
    await expectCssVariable(page, "--chart-marker-bg", "#d18b7d");
  } finally {
    await firstApp.close();
  }

  const secondApp = await launchApp();

  try {
    const page = await secondApp.firstWindow();

    await expect(page.locator(".shell")).toHaveAttribute("data-theme", "dark");
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await expect(page.getByLabel("テーマ")).toHaveValue("dark");

    await page.getByLabel("テーマ").selectOption("light");
    await page.getByRole("button", { name: "設定を保存" }).click();

    await expect(page.locator(".shell")).toHaveAttribute("data-theme", "light");
    await expect(page.getByLabel("テーマ")).toHaveValue("light");
    await expect(page.locator(".sidebar")).toHaveCSS("background-color", "rgba(250, 244, 234, 0.84)");
    await expectCssVariable(page, "--status-done-bg", "#d8ead7");
  } finally {
    await secondApp.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
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
    await expect(page.locator(".timeline-scale-switch")).toContainText("日付単位ガント");
    await expect(page.locator(".timeline-scale-switch")).toContainText("1日単位");
    await expect(page.locator(".timeline-scale-switch").getByRole("button", { name: "週" })).toHaveCount(0);
    await expect(page.locator(".timeline-scale-switch").getByRole("button", { name: "月" })).toHaveCount(0);
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
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "後続もずらす" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "キャンセル" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "このタスクだけ" })).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(page.getByRole("button", { name: "キャンセル" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(parentTimelineBar).toBeFocused();
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
    await expect(parentTimelineBar).toBeFocused();

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

test("sidebar backup action creates a local backup file", async () => {
  const app = await electron.launch({
    executablePath: electronExecutable,
    args: [path.join(process.cwd(), ".")],
  });

  try {
    const page = await app.firstWindow();
    const timestamp = Date.now();
    const projectName = `E2E Backup ${timestamp}`;

    await expect(page.getByRole("heading", { name: "Simple Gantt Chart" })).toBeVisible();
    await page.getByLabel("プロジェクト名").fill(projectName);
    await page.getByRole("button", { name: "プロジェクト作成" }).click();
    await expect(page.locator(`input[value="${projectName}"]`).first()).toBeVisible();

    await page.getByRole("button", { name: "Backup now" }).click();
    const notice = page.locator(".notice-banner");
    await expect(notice).toContainText("Backup created:");
    const noticeText = (await notice.textContent()) ?? "";
    const backupPath = noticeText.replace(/^Backup created:\s*/u, "").trim();
    const backupRow = page
      .locator(".backup-list-item")
      .filter({ hasText: path.basename(backupPath) })
      .first();

    await expect.poll(() => fs.existsSync(backupPath)).toBe(true);
    await expect(backupRow).toBeVisible();

    await page.getByRole("button", { name: "Text Git backup" }).click();
    await expect(notice).toContainText("Text backup created:");
    const textBackupNotice = (await notice.textContent()) ?? "";
    const textBackupDirectory = textBackupNotice
      .replace(/^Text backup created:\s*/u, "")
      .split(" / ")[0]
      .trim();
    await expect.poll(() => fs.existsSync(path.join(textBackupDirectory, "manifest.json"))).toBe(
      true
    );
    await expect
      .poll(() =>
        fs.existsSync(path.join(textBackupDirectory, "projects")) &&
        fs
          .readdirSync(path.join(textBackupDirectory, "projects"))
          .some((fileName) =>
            fs
              .readFileSync(path.join(textBackupDirectory, "projects", fileName), "utf8")
              .includes(projectName)
          )
      )
      .toBe(true);
    expect(fs.readFileSync(path.join(textBackupDirectory, "projects.json"), "utf8")).toContain(
      projectName
    );

    await backupRow.getByRole("button", { name: "Restore Preview" }).click();
    const restorePreview = page.locator('[aria-label="Restore Preview"]');
    await expect(restorePreview).toBeVisible();
    await expect(restorePreview).toContainText("Projects");
    await expect(restorePreview).toContainText("Items");
    await expect(restorePreview).toContainText(path.basename(backupPath));
    await expect(page.locator(`input[value="${projectName}"]`).first()).toBeVisible();

    const afterProjectName = `E2E After Restore ${timestamp}`;
    await page.getByLabel("プロジェクト名").fill(afterProjectName);
    await page.getByRole("button", { name: "プロジェクト作成" }).click();
    await expect(page.locator(`input[value="${afterProjectName}"]`).first()).toBeVisible();

    await backupRow.getByRole("button", { name: "Restore Preview" }).click();
    await expect(restorePreview).toBeVisible();
    await restorePreview.getByRole("button", { name: "Restore" }).click();
    await expect(restorePreview).toContainText("safety backup");
    await restorePreview.getByRole("button", { name: "Restore" }).last().click();
    await expect(page.locator(".notice-banner")).toContainText("Backup restored:");
    const restoreNoticeText = (await page.locator(".notice-banner").textContent()) ?? "";
    const safetyFileName = restoreNoticeText.split("/ safety:").at(1)?.trim();
    expect(safetyFileName).toBeTruthy();
    const safetyBackupPath = path.join(path.dirname(backupPath), safetyFileName!);
    await expect.poll(() => fs.existsSync(safetyBackupPath)).toBe(true);
    await expect(
      page.locator(".backup-list-item").filter({ hasText: safetyFileName! }).first()
    ).toBeVisible();
    await expect
      .poll(async () => {
        const projects = await page.evaluate(async () => {
          const api = window.sgc;
          if (!api) {
            throw new Error("Renderer API is unavailable");
          }
          return api.projects.list();
        });
        return projects.map((project) => project.name);
      })
      .toContain(projectName);
    await expect
      .poll(async () => {
        const projects = await page.evaluate(async () => {
          const api = window.sgc;
          if (!api) {
            throw new Error("Renderer API is unavailable");
          }
          return api.projects.list();
        });
        return projects.map((project) => project.name);
      })
      .not.toContain(afterProjectName);
  } finally {
    await app.close();
  }
});

test("desktop regression journey preserves project, settings, backup, and export", async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "sgc-regression-journey-e2e-"));
  const exportPath = path.join(os.tmpdir(), `sgc-regression-export-${Date.now()}.xlsx`);
  const timestamp = Date.now();
  const projectName = `E2E Regression ${timestamp}`;

  const launchApp = () =>
    electron.launch({
      executablePath: electronExecutable,
      args: [path.join(process.cwd(), ".")],
      env: {
        ...process.env,
        SGC_USER_DATA_DIR: userDataDir,
      },
    });

  const firstApp = await launchApp();
  let backupFileName = "";
  try {
    const page = await firstApp.firstWindow();
    await expect(page.getByRole("heading", { name: "Simple Gantt Chart" })).toBeVisible();
    await page.getByLabel("プロジェクト名").fill(projectName);
    await page.getByRole("button", { name: "プロジェクト作成" }).click();
    await expect(page.locator(`input[value="${projectName}"]`).first()).toBeVisible();

    await firstApp.evaluate(
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

    await page.getByRole("button", { name: "Backup now" }).click();
    const notice = page.locator(".notice-banner");
    await expect(notice).toContainText("Backup created:");
    const backupPath = ((await notice.textContent()) ?? "").replace(/^Backup created:\s*/u, "").trim();
    backupFileName = path.basename(backupPath);
    await expect.poll(() => fs.existsSync(backupPath)).toBe(true);
    await expect(page.locator(".backup-list-item").filter({ hasText: backupFileName }).first()).toBeVisible();

    await page.getByRole("button", { name: "Settings" }).click();
    await page.getByLabel("テーマ").selectOption("dark");
    await page.getByLabel("表示言語").selectOption("en");
    await page.getByRole("button", { name: "設定を保存" }).click();
    await expect(page.locator(".notice-banner")).toContainText("Settings saved");
    await expect(page.locator(".shell")).toHaveAttribute("data-theme", "dark");
    await expect(page.getByRole("button", { name: "Home" })).toBeVisible();
  } finally {
    await firstApp.close();
  }

  const secondApp = await launchApp();
  try {
    const page = await secondApp.firstWindow();
    await expect(page.getByRole("heading", { name: "Simple Gantt Chart" })).toBeVisible();
    await expect(page.locator(".shell")).toHaveAttribute("data-theme", "dark");
    await expect(page.getByRole("button", { name: "Settings" })).toBeVisible();
    await expect(page.locator(".project-card").filter({ hasText: projectName }).first()).toBeVisible();
    const backupRow = page.locator(".backup-list-item").filter({ hasText: backupFileName }).first();
    await expect(backupRow).toBeVisible();
    await backupRow.getByRole("button", { name: "Restore Preview" }).click();
    await expect(page.locator('[aria-label="Restore Preview"]')).toContainText(backupFileName);
  } finally {
    await secondApp.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
    fs.rmSync(exportPath, { force: true });
  }
});

test("sidebar project list stays compact and quick-add creates a task under the project", async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "sgc-sidebar-usability-e2e-"));
  const dbPath = path.join(userDataDir, "data", "sgc.sqlite");
  const bootstrapManager = new DatabaseManager(dbPath);
  await bootstrapManager.initialize();
  const bootstrapService = new WorkspaceService(bootstrapManager);
  const timestamp = Date.now();
  const targetName = `Compact Target ${timestamp}`;

  for (let index = 1; index <= 28; index += 1) {
    bootstrapService.createProject({
      name: index === 17 ? targetName : `Compact Project ${String(index).padStart(2, "0")} ${timestamp}`,
      code: `CMP-${String(index).padStart(2, "0")}`,
    });
  }

  const app = await electron.launch({
    executablePath: electronExecutable,
    args: [path.join(process.cwd(), ".")],
    env: {
      ...process.env,
      SGC_USER_DATA_DIR: userDataDir,
    },
  });

  try {
    const page = await app.firstWindow();
    await expect(page.getByRole("heading", { name: "Simple Gantt Chart" })).toBeVisible();
    await expect(page.locator(".sidebar-projects")).toContainText(/28\s*\/\s*28\s*件/u);

    const projectListBox = await page.locator(".project-list").boundingBox();
    expect(projectListBox).not.toBeNull();
    expect(projectListBox?.height ?? 0).toBeLessThanOrEqual(270);

    await page.getByLabel("プロジェクト検索").fill("Target");
    await expect(page.locator(".sidebar-projects")).toContainText(/1\s*\/\s*28\s*件/u);
    await page.locator(".project-card").filter({ hasText: targetName }).click();
    await expect(page.locator(`input[value="${targetName}"]`).first()).toBeVisible();
    await expect(page.locator(".project-workspace")).toBeVisible();

    const quickTaskTitle = `Quick Added Task ${timestamp}`;
    await page.getByLabel("プロジェクト直下にタスクを追加").fill(quickTaskTitle);
    await page.getByRole("button", { name: "タスク追加" }).click();
    await expect(page.locator(`.table-body input[value="${quickTaskTitle}"]`).first()).toBeVisible();
    await expect(page.locator(".table-body .table-row").first().locator("select").first()).toHaveValue("task");

    const bulkChildTitle = `Bulk Child 01 ${timestamp}`;
    await page.getByLabel("複数サブタスク追加").fill(`${bulkChildTitle}\nBulk Child 02 ${timestamp}\nBulk Child 03 ${timestamp}`);
    await page.getByRole("button", { name: "まとめて追加" }).click();
    await expect(page.locator(`.table-body input[value="${bulkChildTitle}"]`).first()).toBeVisible();
    await expect(page.locator(".table-body .table-row")).toHaveCount(4);

    const eventTitle = `Customer Event ${timestamp}`;
    const eventDate = "2026-09-15";
    await page.locator(".event-day-add input").nth(0).fill(eventTitle);
    await page.locator(".event-day-add input").nth(1).fill(eventDate);
    await page.getByRole("button", { name: "イベント日追加" }).click();
    const eventTitleInput = page.locator(`.table-body input[value="${eventTitle}"]`).first();
    await expect(eventTitleInput).toBeVisible();
    const eventRow = eventTitleInput.locator('xpath=ancestor::div[contains(@class, "table-row")]');
    await expect(eventRow.locator("select").first()).toHaveValue("milestone");
    await expect(eventRow.locator('input[type="date"]').first()).toHaveValue(eventDate);

    await page.getByRole("button", { name: "折りたたむ" }).click();
    await expect(page.locator(".project-list")).toHaveCount(0);
    await page.getByRole("button", { name: "表示" }).click();
    await expect(page.locator(".project-list")).toBeVisible();
  } finally {
    await app.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
});

test("project detail virtualizes large row sets", async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "sgc-virtualization-e2e-"));
  const dbPath = path.join(userDataDir, "data", "sgc.sqlite");
  const bootstrapManager = new DatabaseManager(dbPath);
  await bootstrapManager.initialize();
  const bootstrapService = new WorkspaceService(bootstrapManager);
  const timestamp = Date.now();
  const projectName = `Virtualized Project ${timestamp}`;
  const firstTitle = `Virtual Task 001 ${timestamp}`;
  const lastTitle = `Virtual Task 080 ${timestamp}`;
  const project = bootstrapService.createProject({
    name: projectName,
    code: `VRT-${timestamp}`,
  });

  for (let index = 1; index <= 80; index += 1) {
    const item = bootstrapService.createItem({
      projectId: project.id,
      title: `Virtual Task ${String(index).padStart(3, "0")} ${timestamp}`,
      type: "task",
    });
    bootstrapService.updateItem({
      id: item.id,
      startDate: "2026-05-01",
      endDate: "2026-05-03",
    });
  }

  const app = await electron.launch({
    executablePath: electronExecutable,
    args: [path.join(process.cwd(), ".")],
    env: {
      ...process.env,
      SGC_USER_DATA_DIR: userDataDir,
    },
  });

  try {
    const page = await app.firstWindow();
    await expect(page.getByRole("heading", { name: "Simple Gantt Chart" })).toBeVisible();
    const projectCard = page.locator(".project-card").filter({ hasText: projectName }).first();
    await expect(projectCard).toBeVisible();
    await projectCard.click();
    await expect(page.locator(`input[value="${projectName}"]`).first()).toBeVisible();

    const tableRows = page.locator(".table-body .table-row");
    const timelineRows = page.locator(".timeline-body .timeline-row");
    const initialTableRowCount = await tableRows.count();
    const initialTimelineRowCount = await timelineRows.count();

    expect(initialTableRowCount).toBeGreaterThan(0);
    expect(initialTableRowCount).toBeLessThan(40);
    expect(initialTableRowCount).toBe(initialTimelineRowCount);
    await expect(page.locator(`.table-body input[value="${firstTitle}"]`).first()).toBeVisible();

    await page.locator(".table-body").evaluate((element) => {
      element.scrollTop = element.scrollHeight;
      element.dispatchEvent(new Event("scroll", { bubbles: true }));
    });

    await expect(page.locator(`.table-body input[value="${lastTitle}"]`).first()).toBeVisible();
    const scrolledTableRowCount = await tableRows.count();
    const scrolledTimelineRowCount = await timelineRows.count();
    expect(scrolledTableRowCount).toBeGreaterThan(0);
    expect(scrolledTableRowCount).toBeLessThan(40);
    expect(scrolledTableRowCount).toBe(scrolledTimelineRowCount);
  } finally {
    await app.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
});

test("roadmap virtualizes large row sets while keeping headers visible", async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "sgc-roadmap-virtualization-e2e-"));
  const dbPath = path.join(userDataDir, "data", "sgc.sqlite");
  const bootstrapManager = new DatabaseManager(dbPath);
  await bootstrapManager.initialize();
  const bootstrapService = new WorkspaceService(bootstrapManager);
  const timestamp = Date.now();
  const projectName = `Roadmap Virtualized ${timestamp}`;
  const firstTitle = `Roadmap Task 001 ${timestamp}`;
  const lastTitle = `Roadmap Task 080 ${timestamp}`;
  const project = bootstrapService.createProject({
    name: projectName,
    code: `RDM-${timestamp}`,
  });

  for (let index = 1; index <= 80; index += 1) {
    const item = bootstrapService.createItem({
      projectId: project.id,
      title: `Roadmap Task ${String(index).padStart(3, "0")} ${timestamp}`,
      type: "task",
    });
    bootstrapService.updateItem({
      id: item.id,
      startDate: "2026-05-01",
      endDate: "2026-05-03",
    });
  }

  const app = await electron.launch({
    executablePath: electronExecutable,
    args: [path.join(process.cwd(), ".")],
    env: {
      ...process.env,
      SGC_USER_DATA_DIR: userDataDir,
    },
  });

  try {
    const page = await app.firstWindow();
    await expect(page.getByRole("heading", { name: "Simple Gantt Chart" })).toBeVisible();
    await page.getByRole("button", { name: /^(Year \/ FY|年次 \/ FY)$/ }).click();
    await expect(page.locator(".roadmap-quarter-cell").filter({ hasText: "Q1" }).first()).toBeVisible();

    const roadmapRows = page.locator(".roadmap-body .roadmap-row");
    const initialRowCount = await roadmapRows.count();
    expect(initialRowCount).toBeGreaterThan(0);
    expect(initialRowCount).toBeLessThan(40);
    await expect(page.locator(".roadmap-body .roadmap-title-cell").filter({ hasText: firstTitle }).first()).toBeVisible();
    await expect(page.locator(".roadmap-quarter-cell").filter({ hasText: "Q1" }).first()).toBeVisible();
    await expect(page.locator(".roadmap-header-cell").filter({ hasText: "5" }).first()).toBeVisible();

    await page.locator(".roadmap-body").evaluate((element) => {
      element.scrollTop = element.scrollHeight;
      element.dispatchEvent(new Event("scroll", { bubbles: true }));
    });

    await expect(page.locator(".roadmap-body .roadmap-title-cell").filter({ hasText: lastTitle }).first()).toBeVisible();
    const scrolledRowCount = await roadmapRows.count();
    expect(scrolledRowCount).toBeGreaterThan(0);
    expect(scrolledRowCount).toBeLessThan(40);
    await expect(page.locator(".roadmap-quarter-cell").filter({ hasText: "Q1" }).first()).toBeVisible();
    await expect(page.locator(".roadmap-header-cell").filter({ hasText: "5" }).first()).toBeVisible();
  } finally {
    await app.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
});

test("recovery screen restores a backup and returns to normal workspace", async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "sgc-recovery-e2e-"));
  const dbPath = path.join(userDataDir, "data", "sgc.sqlite");
  const bootstrapManager = new DatabaseManager(dbPath);
  await bootstrapManager.initialize();
  const bootstrapService = new WorkspaceService(bootstrapManager);
  const timestamp = Date.now();
  const projectName = `Recovery Restore ${timestamp}`;
  const project = bootstrapService.createProject({
    name: projectName,
    code: `REC-${timestamp}`,
  });
  bootstrapService.createItem({
    projectId: project.id,
    title: `Recovery Task ${timestamp}`,
    type: "task",
  });
  const backup = bootstrapService.createBackup();
  fs.writeFileSync(dbPath, Buffer.from("broken-sqlite"));

  const app = await electron.launch({
    executablePath: electronExecutable,
    args: [path.join(process.cwd(), ".")],
    env: {
      ...process.env,
      SGC_USER_DATA_DIR: userDataDir,
    },
  });

  try {
    const page = await app.firstWindow();

    await expect(page.getByRole("heading", { name: "起動に失敗したため recovery mode で開いています" })).toBeVisible();
    const backupRow = page
      .locator(".backup-list-item")
      .filter({ hasText: backup.fileName })
      .first();
    await expect(backupRow).toBeVisible();
    await backupRow.getByRole("button", { name: "Restore Preview" }).click();

    const restorePreview = page.locator('[aria-label="Restore Preview"]');
    await expect(restorePreview).toBeVisible();
    await expect(restorePreview).toContainText(backup.fileName);
    await restorePreview.getByRole("button", { name: "Restore" }).click();
    await expect(restorePreview).toContainText("safety backup");
    await restorePreview.getByRole("button", { name: "Restore" }).last().click();

    await expect(page.getByRole("heading", { name: "Simple Gantt Chart" })).toBeVisible({ timeout: 15000 });
    await expect(page.locator(".notice-banner")).toContainText("Backup restored:");
    await expect(
      page.locator(".project-card").filter({ hasText: projectName }).first()
    ).toBeVisible();
  } finally {
    await app.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
});

test("search and filter drawer narrows home, portfolio, and roadmap views", async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "sgc-search-filter-e2e-"));
  const dbPath = path.join(userDataDir, "data", "sgc.sqlite");
  const bootstrapManager = new DatabaseManager(dbPath);
  await bootstrapManager.initialize();
  const bootstrapService = new WorkspaceService(bootstrapManager);
  const timestamp = Date.now();
  const currentDateText = formatDateInput(new Date());
  const alphaProjectName = `Alpha Search ${timestamp}`;
  const betaProjectName = `Beta Search ${timestamp}`;
  const alphaTaskTitle = `Alpha Filter Task ${timestamp}`;
  const betaTaskTitle = `Beta Filter Task ${timestamp}`;
  const alphaProject = bootstrapService.createProject({
    name: alphaProjectName,
    code: `ALP-${timestamp}`,
  });
  const betaProject = bootstrapService.createProject({
    name: betaProjectName,
    code: `BET-${timestamp}`,
  });
  bootstrapManager.run("UPDATE project SET portfolio_id = ? WHERE id = ?", [
    "portfolio-alpha",
    alphaProject.id,
  ]);
  bootstrapManager.run("UPDATE project SET portfolio_id = ? WHERE id = ?", [
    "portfolio-beta",
    betaProject.id,
  ]);
  const alphaTask = bootstrapService.createItem({
    projectId: alphaProject.id,
    title: alphaTaskTitle,
    type: "task",
  });
  bootstrapService.updateItem({
    id: alphaTask.id,
    startDate: currentDateText,
    endDate: currentDateText,
  });
  const betaTask = bootstrapService.createItem({
    projectId: betaProject.id,
    title: betaTaskTitle,
    type: "task",
  });
  bootstrapService.updateItem({
    id: betaTask.id,
    startDate: currentDateText,
    endDate: currentDateText,
  });

  const app = await electron.launch({
    executablePath: electronExecutable,
    args: [path.join(process.cwd(), ".")],
    env: {
      ...process.env,
      SGC_USER_DATA_DIR: userDataDir,
    },
  });

  try {
    const page = await app.firstWindow();
    await expect(page.getByRole("heading", { name: "Simple Gantt Chart" })).toBeVisible();
    await page.getByRole("button", { name: /^(Home|Home \/ Today|ホーム \/ 今日)$/ }).click();

    await expect(page.locator(".task-card").filter({ hasText: alphaTaskTitle }).first()).toBeVisible();
    await expect(page.locator(".task-card").filter({ hasText: betaTaskTitle }).first()).toBeVisible();

    await page.getByRole("button", { name: "Search / Filter" }).click();
    const homeDrawer = page.getByRole("dialog", { name: "current view を絞り込みます" });
    await homeDrawer.getByLabel("全文").fill("Alpha Filter");
    await expect(page.locator(".search-filter-chip").filter({ hasText: "全文: Alpha Filter" })).toBeVisible();
    await homeDrawer.getByRole("button", { name: "閉じる" }).click();
    await expect(page.locator(".task-card").filter({ hasText: alphaTaskTitle }).first()).toBeVisible();
    await expect(page.locator(".task-card").filter({ hasText: betaTaskTitle })).toHaveCount(0);
    await page.getByRole("button", { name: "Clear" }).click();
    await expect(page.locator(".task-card").filter({ hasText: betaTaskTitle }).first()).toBeVisible();

    await page.getByRole("button", { name: /^(Portfolio|ポートフォリオ)$/ }).click();
    await expect(page.locator(".portfolio-table-button").filter({ hasText: alphaProjectName }).first()).toBeVisible();
    await expect(page.locator(".portfolio-table-button").filter({ hasText: betaProjectName }).first()).toBeVisible();
    await page.getByRole("button", { name: "Search / Filter" }).click();
    const portfolioDrawer = page.getByRole("dialog", { name: "current view を絞り込みます" });
    await portfolioDrawer.getByLabel("Portfolio").fill("portfolio-alpha");
    await expect(page.locator(".search-filter-chip").filter({ hasText: "Portfolio: portfolio-alpha" })).toBeVisible();
    await portfolioDrawer.getByRole("button", { name: "閉じる" }).click();
    await expect(page.locator(".portfolio-table-button").filter({ hasText: alphaProjectName }).first()).toBeVisible();
    await expect(page.locator(".portfolio-table-button").filter({ hasText: betaProjectName })).toHaveCount(0);
    await page.getByRole("button", { name: "Clear" }).click();
    await expect(page.locator(".portfolio-table-button").filter({ hasText: betaProjectName }).first()).toBeVisible();

    await page.getByRole("button", { name: /^(Year \/ FY|年次 \/ FY)$/ }).click();
    await expect(page.getByRole("button", { name: "FY", exact: true })).toBeVisible();
    await expect(page.getByText("current view に適用される条件はまだありません。")).toHaveCount(0);
    const roadmapToolbarHeightBeforeFilter = await page.locator(".search-filter-toolbar-roadmap").evaluate(
      (element) => element.getBoundingClientRect().height
    );
    await expect(page.locator(".roadmap-title-cell").filter({ hasText: alphaTaskTitle }).first()).toBeVisible();
    await expect(page.locator(".roadmap-title-cell").filter({ hasText: betaTaskTitle }).first()).toBeVisible();
    await page.getByRole("button", { name: "Search / Filter" }).click();
    const roadmapDrawer = page.getByRole("dialog", { name: "current view を絞り込みます" });
    await roadmapDrawer.getByLabel("全文").fill("Alpha Filter");
    await roadmapDrawer.getByRole("button", { name: "閉じる" }).click();
    const roadmapToolbarHeightAfterFilter = await page.locator(".search-filter-toolbar-roadmap").evaluate(
      (element) => element.getBoundingClientRect().height
    );
    expect(roadmapToolbarHeightAfterFilter).toBeLessThanOrEqual(roadmapToolbarHeightBeforeFilter + 4);
    await expect(page.locator(".search-filter-chip").filter({ hasText: "全文: Alpha Filter" })).toBeVisible();
    await expect(page.locator(".roadmap-title-cell").filter({ hasText: alphaTaskTitle }).first()).toBeVisible();
    await expect(page.locator(".roadmap-title-cell").filter({ hasText: betaTaskTitle })).toHaveCount(0);
    await page.getByRole("button", { name: "Clear" }).click();
    await expect(page.locator(".roadmap-title-cell").filter({ hasText: betaTaskTitle }).first()).toBeVisible();
  } finally {
    await app.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
});

test("template panel lists saved templates and applies WBS and project templates", async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "sgc-template-ui-e2e-"));
  const dbPath = path.join(userDataDir, "data", "sgc.sqlite");
  const bootstrapManager = new DatabaseManager(dbPath);
  await bootstrapManager.initialize();
  const bootstrapService = new WorkspaceService(bootstrapManager);
  const timestamp = Date.now();
  const currentProjectName = `Template Current ${timestamp}`;
  const currentRootTitle = `Current Root ${timestamp}`;
  const currentChildTitle = `Current Child ${timestamp}`;
  const wbsTemplateName = `WBS Template ${timestamp}`;
  const wbsRootTitle = `WBS Root ${timestamp}`;
  const wbsChildTitle = `WBS Child ${timestamp}`;
  const appliedProjectName = `Applied Project ${timestamp}`;
  const projectTemplateName = `Project Template ${timestamp}`;
  const projectTemplateRenamedSource = `Project Template Source Renamed ${timestamp}`;
  const projectTemplateRootTitle = `Project Template Root ${timestamp}`;

  const currentProject = bootstrapService.createProject({
    name: currentProjectName,
    code: `TMP-${timestamp}`,
  });
  const currentRoot = bootstrapService.createItem({
    projectId: currentProject.id,
    title: currentRootTitle,
    type: "group",
  });
  bootstrapService.createItem({
    projectId: currentProject.id,
    parentId: currentRoot.id,
    title: currentChildTitle,
    type: "task",
  });

  const wbsSourceProject = bootstrapService.createProject({
    name: `WBS Source ${timestamp}`,
    code: `WBS-${timestamp}`,
  });
  const wbsRoot = bootstrapService.createItem({
    projectId: wbsSourceProject.id,
    title: wbsRootTitle,
    type: "group",
  });
  bootstrapService.createItem({
    projectId: wbsSourceProject.id,
    parentId: wbsRoot.id,
    title: wbsChildTitle,
    type: "task",
  });
  bootstrapService.saveWbsTemplate({
    rootItemId: wbsRoot.id,
    name: wbsTemplateName,
  });

  const projectTemplateSource = bootstrapService.createProject({
    name: appliedProjectName,
    code: `PRT-${timestamp}`,
  });
  bootstrapService.createItem({
    projectId: projectTemplateSource.id,
    title: projectTemplateRootTitle,
    type: "task",
  });
  bootstrapService.saveProjectTemplate({
    projectId: projectTemplateSource.id,
    name: projectTemplateName,
  });
  bootstrapService.updateProject({
    id: projectTemplateSource.id,
    name: projectTemplateRenamedSource,
    code: projectTemplateSource.code,
  });

  const app = await electron.launch({
    executablePath: electronExecutable,
    args: [path.join(process.cwd(), ".")],
    env: {
      ...process.env,
      SGC_USER_DATA_DIR: userDataDir,
    },
  });

  try {
    const page = await app.firstWindow();
    await expect(page.getByRole("heading", { name: "Simple Gantt Chart" })).toBeVisible();
    const currentProjectCard = page.locator(".project-card").filter({ hasText: currentProjectName }).first();
    await expect(currentProjectCard).toBeVisible();
    await currentProjectCard.click();
    await expect(page.locator(`input[value="${currentProjectName}"]`).first()).toBeVisible();

    const currentChildRow = page
      .locator(".table-body .table-row")
      .filter({ has: page.locator(`input[value="${currentChildTitle}"]`).first() })
      .first();
    await currentChildRow.getByRole("button", { name: "詳細" }).evaluate((button: HTMLButtonElement) => {
      button.click();
    });
    await expect(page.locator(".detail-drawer")).toContainText(currentChildTitle);
    await page.getByRole("button", { name: "Templates" }).click();
    const templatePanel = page.locator(".template-panel");
    await expect(templatePanel).toBeVisible();
    await expect(templatePanel).toContainText("Template Library");
    await expect(templatePanel).toContainText(wbsTemplateName);
    await expect(templatePanel).toContainText(projectTemplateName);
    await expect(templatePanel.getByRole("button", { name: "selected root を保存" })).toBeDisabled();
    await expect(templatePanel).toContainText("WBS template を保存するには root row を選択して下さい。");
    await templatePanel.getByRole("button", { name: "current project を保存" }).click();
    await expect(page.locator(".notice-banner")).toContainText(`Project template saved: ${currentProjectName}`);
    await expect(templatePanel).toContainText(currentProjectName);
    await templatePanel.getByRole("button", { name: "閉じる" }).click();

    const currentRootRow = page
      .locator(".table-body .table-row")
      .filter({ has: page.locator(`input[value="${currentRootTitle}"]`).first() })
      .first();
    await currentRootRow.getByRole("button", { name: "詳細" }).evaluate((button: HTMLButtonElement) => {
      button.click();
    });
    await expect(page.locator(".detail-drawer")).toContainText(currentRootTitle);
    await page.getByRole("button", { name: "Templates" }).click();
    await expect(templatePanel.getByRole("button", { name: "selected root を保存" })).toBeEnabled();
    await templatePanel.getByRole("button", { name: "selected root を保存" }).click();
    await expect(page.locator(".notice-banner")).toContainText(`WBS template saved: ${currentRootTitle}`);
    await expect(templatePanel).toContainText(currentRootTitle);

    const wbsTemplateRow = templatePanel.locator(".template-list-item").filter({ hasText: wbsTemplateName }).first();
    await wbsTemplateRow.getByRole("button", { name: "current project へ適用" }).click();
    await expect(page.locator(".notice-banner")).toContainText("WBS template applied");
    await expect(page.locator(`.table-body input[value="${wbsRootTitle}"]`).first()).toBeVisible();
    await expect(page.locator(`.table-body input[value="${wbsChildTitle}"]`).first()).toBeVisible();

    await page.getByRole("button", { name: "Templates" }).click();
    const projectTemplateRow = page
      .locator(".template-list-item")
      .filter({ hasText: projectTemplateName })
      .first();
    await projectTemplateRow.getByRole("button", { name: "新しい project を作成" }).click();
    await expect(page.locator(".notice-banner")).toContainText("Project template created:");
    await expect(page.locator(`input[value="${appliedProjectName}"]`).first()).toBeVisible();
    await expect(page.locator(`.table-body input[value="${projectTemplateRootTitle}"]`).first()).toBeVisible();
  } finally {
    await app.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
});

test("inbox template conversion opens project detail templates workflow", async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "sgc-inbox-template-conversion-e2e-"));

  const app = await electron.launch({
    executablePath: electronExecutable,
    args: [path.join(process.cwd(), ".")],
    env: {
      ...process.env,
      SGC_USER_DATA_DIR: userDataDir,
    },
  });

  try {
    const page = await app.firstWindow();
    const timestamp = Date.now();
    const inboxTitle = `Inbox Template ${timestamp}`;

    await expect(page.getByRole("heading", { name: "Simple Gantt Chart" })).toBeVisible();
    await page.getByPlaceholder("タスクを入力。例: 見積提出 4/25 #営業 @自分").fill(inboxTitle);
    await page.getByRole("button", { name: "追加" }).click();

    const inboxCard = page.locator(".task-card").filter({ hasText: inboxTitle }).first();
    await expect(inboxCard).toBeVisible();
    await inboxCard.getByRole("button", { name: "テンプレート変換" }).click();

    await expect(page.locator(".notice-banner")).toContainText(`Template conversion ready: ${inboxTitle}`);
    await expect(page.locator(`input[value="${inboxTitle}"]`).first()).toBeVisible();

    const templatePanel = page.locator(".template-panel");
    await expect(templatePanel).toBeVisible();
    await expect(templatePanel.getByRole("button", { name: "current project を保存" })).toBeVisible();
    await expect(templatePanel.getByRole("button", { name: "selected root を保存" })).toBeEnabled();

    await templatePanel.getByRole("button", { name: "selected root を保存" }).click();
    await expect(page.locator(".notice-banner")).toContainText(`WBS template saved: ${inboxTitle}`);
    await expect(templatePanel).toContainText(inboxTitle);
    await expect(page.locator(".task-card").filter({ hasText: inboxTitle })).toHaveCount(0);
  } finally {
    await app.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
});

test("detail drawer recurrence editor saves, replaces, and removes recurrence rules", async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "sgc-recurrence-ui-e2e-"));
  const dbPath = path.join(userDataDir, "data", "sgc.sqlite");
  const bootstrapManager = new DatabaseManager(dbPath);
  await bootstrapManager.initialize();
  const bootstrapService = new WorkspaceService(bootstrapManager);
  const timestamp = Date.now();
  const projectName = `Recurrence UI ${timestamp}`;
  const scheduledTitle = `Scheduled Recurrence ${timestamp}`;
  const unsupportedTitle = `Unsupported Recurrence ${timestamp}`;
  const unscheduledTitle = `Unscheduled Recurrence ${timestamp}`;
  const project = bootstrapService.createProject({
    name: projectName,
    code: `RUI-${timestamp}`,
  });
  const scheduledTask = bootstrapService.createItem({
    projectId: project.id,
    title: scheduledTitle,
    type: "task",
  });
  bootstrapService.updateItem({
    id: scheduledTask.id,
    startDate: "2026-05-01",
    endDate: "2026-05-03",
  });
  const unsupportedTask = bootstrapService.createItem({
    projectId: project.id,
    title: unsupportedTitle,
    type: "task",
  });
  bootstrapService.updateItem({
    id: unsupportedTask.id,
    startDate: "2026-06-01",
    endDate: "2026-06-02",
  });
  bootstrapService.upsertRecurrenceRule({
    itemId: unsupportedTask.id,
    rruleText: "FREQ=YEARLY;INTERVAL=1",
    nextOccurrenceAt: "2027-06-01",
  });
  bootstrapService.createItem({
    projectId: project.id,
    title: unscheduledTitle,
    type: "task",
  });

  const app = await electron.launch({
    executablePath: electronExecutable,
    args: [path.join(process.cwd(), ".")],
    env: {
      ...process.env,
      SGC_USER_DATA_DIR: userDataDir,
    },
  });

  try {
    const page = await app.firstWindow();
    await expect(page.getByRole("heading", { name: "Simple Gantt Chart" })).toBeVisible();
    await page.locator(".project-card").filter({ hasText: projectName }).first().click();
    await expect(page.locator(`input[value="${projectName}"]`).first()).toBeVisible();

    const detailDrawer = page.locator(".detail-drawer");

    const scheduledRow = page
      .locator(".table-body .table-row")
      .filter({ has: page.locator(`input[value="${scheduledTitle}"]`).first() })
      .first();
    await scheduledRow.getByRole("button", { name: "詳細" }).evaluate((button: HTMLButtonElement) => {
      button.click();
    });
    await expect(detailDrawer).toContainText(scheduledTitle);
    await expect(detailDrawer).toContainText("まだ recurrence rule はありません。");
    await detailDrawer.getByLabel("Next occurrence").fill("2026-05-11");
    await detailDrawer.getByRole("button", { name: "保存" }).click();
    await expect(page.locator(".notice-banner")).toContainText("Recurrence saved");
    await expect(detailDrawer).toContainText("週次(月曜)");
    await expect(detailDrawer).toContainText("2026-05-11");

    await detailDrawer.getByLabel("Recurrence preset").selectOption("weekdays");
    await detailDrawer.getByLabel("Next occurrence").fill("2026-05-12");
    await detailDrawer.getByRole("button", { name: "更新" }).click();
    await expect(page.locator(".notice-banner")).toContainText("Recurrence saved");
    await expect(detailDrawer).toContainText("平日");
    await expect(detailDrawer).toContainText("2026-05-12");

    await detailDrawer.getByRole("button", { name: "削除" }).click();
    await expect(page.locator(".notice-banner")).toContainText("Recurrence removed");
    await expect(detailDrawer).toContainText("まだ recurrence rule はありません。");

    const unsupportedRow = page
      .locator(".table-body .table-row")
      .filter({ has: page.locator(`input[value="${unsupportedTitle}"]`).first() })
      .first();
    await unsupportedRow.getByRole("button", { name: "詳細" }).evaluate((button: HTMLButtonElement) => {
      button.click();
    });
    await expect(detailDrawer).toContainText(unsupportedTitle);
    await expect(detailDrawer).toContainText("unsupported rule: FREQ=YEARLY;INTERVAL=1");
    await expect(detailDrawer).toContainText("generation 対象外");
    await detailDrawer.getByLabel("Recurrence preset").selectOption("yearly");
    await detailDrawer.getByLabel("Recurrence month", { exact: true }).fill("9");
    await detailDrawer.getByLabel("Recurrence month day").fill("15");
    await detailDrawer.getByLabel("Next occurrence").fill("2026-09-15");
    await detailDrawer.getByRole("button", { name: "更新" }).click();
    await expect(page.locator(".notice-banner")).toContainText("Recurrence saved");
    await expect(detailDrawer).toContainText("unsupported rule: FREQ=YEARLY;INTERVAL=1;BYMONTH=9;BYMONTHDAY=15");
    await expect(detailDrawer).toContainText("下の builder で再構築");

    await detailDrawer.getByLabel("Recurrence preset").selectOption("weekly_custom");
    await detailDrawer.getByLabel("Recurrence interval").fill("2");
    await detailDrawer.getByLabel("Recurrence weekday").selectOption("FR");
    await detailDrawer.getByLabel("Next occurrence").fill("2026-07-03");
    await detailDrawer.getByRole("button", { name: "更新" }).click();
    await expect(page.locator(".notice-banner")).toContainText("Recurrence saved");
    await expect(detailDrawer).toContainText("週次(金曜 / 2週ごと)");
    await expect(detailDrawer).not.toContainText("unsupported rule:");

    const unscheduledRow = page
      .locator(".table-body .table-row")
      .filter({ has: page.locator(`input[value="${unscheduledTitle}"]`).first() })
      .first();
    await unscheduledRow.getByRole("button", { name: "詳細" }).evaluate((button: HTMLButtonElement) => {
      button.click();
    });
    await expect(detailDrawer).toContainText("recurrence editor は日付が入った scheduled task で使えます。");
  } finally {
    await app.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
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

async function expectCssVariable(page: Page, name: string, expected: string): Promise<void> {
  await expect
    .poll(() =>
      page.locator(".shell").evaluate((element, variableName) => {
        return getComputedStyle(element).getPropertyValue(variableName).trim();
      }, name)
    )
    .toBe(expected);
}
