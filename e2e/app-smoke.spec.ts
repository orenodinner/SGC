import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test, expect } from "@playwright/test";
import electronPackage from "electron";
import { _electron as electron } from "playwright";

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
    await milestoneRow.locator('input[type="date"]').nth(0).fill(todayText);
    await milestoneRow.locator('input[type="date"]').nth(1).fill(todayText);
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
    await expect(page.locator(".portfolio-table-button").filter({ hasText: milestoneProjectName })).toHaveCount(0);
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
    await expect(page.locator(".roadmap-title-cell").filter({ hasText: futureTitle })).toHaveCount(0);
    await expect(page.locator(".roadmap-bar").first()).toBeVisible();
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
