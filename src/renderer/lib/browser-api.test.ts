import { afterEach, describe, expect, it, vi } from "vitest";
import { exportProjectWorkbookXlsx } from "../../infra/excel/project-workbook-export";
import { buildRoundTripWorkbookFixture } from "../../test/excel-roundtrip-fixtures";
import { browserApi } from "./browser-api";

describe("browserApi import preview fallback", () => {
  afterEach(() => {
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

  it("commits a previewed workbook back into the current project", async () => {
    const project = await browserApi.projects.create({
      name: `Browser Commit ${crypto.randomUUID()}`,
    });
    const createdItem = await browserApi.items.create({
      projectId: project.id,
      title: `Existing Commit Task ${crypto.randomUUID()}`,
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
              }
            : row
        );

        return [
          ...updatedRows,
          {
            ...updatedRows[0],
            RecordId: "",
            ParentRecordId: "",
            Title: "Browser Added Task",
            Tags: "#new",
            DependsOn: "",
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

    expect(preview).not.toBeNull();
    expect(result.createdCount).toBe(1);
    expect(result.updatedCount).toBeGreaterThanOrEqual(1);
    expect(result.sourcePath).toBeNull();
    expect(after.items.some((item) => item.title === "Browser Added Task")).toBe(true);
    const updatedItem = after.items.find((item) => item.id === createdItem.id);
    expect(updatedItem?.title).toBe("Updated Browser Commit Task");
    expect(updatedItem?.tags).toEqual(["imported", "browser"]);
  });
});
