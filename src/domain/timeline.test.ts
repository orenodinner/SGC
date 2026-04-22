import { describe, expect, it } from "vitest";
import type { ItemRecord } from "../shared/contracts";
import {
  applyTimelineInteraction,
  buildTimelineColumns,
  buildTimelineLayout,
  type TimelineScale,
} from "./timeline";

function makeItem(overrides: Partial<ItemRecord>): ItemRecord {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    workspaceId: "ws-default",
    projectId: "prj-1",
    projectName: "Project",
    parentId: overrides.parentId ?? null,
    wbsCode: overrides.wbsCode ?? "",
    type: overrides.type ?? "task",
    title: overrides.title ?? "Task",
    note: "",
    status: overrides.status ?? "not_started",
    priority: overrides.priority ?? "medium",
    assigneeName: overrides.assigneeName ?? "",
    startDate: overrides.startDate ?? null,
    endDate: overrides.endDate ?? null,
    dueDate: overrides.dueDate ?? null,
    durationDays: overrides.durationDays ?? 1,
    percentComplete: overrides.percentComplete ?? 0,
    estimateHours: 0,
    actualHours: 0,
    sortOrder: overrides.sortOrder ?? 1,
    isScheduled: overrides.isScheduled ?? false,
    isRecurring: false,
    archived: false,
    createdAt: "2026-04-21T00:00:00.000Z",
    updatedAt: "2026-04-21T00:00:00.000Z",
    completedAt: null,
    tags: [],
  };
}

describe("buildTimelineColumns", () => {
  it.each([
    ["day", 5],
    ["week", 2],
    ["month", 2],
  ] satisfies Array<[TimelineScale, number]>)(
    "builds %s columns from item date range",
    (scale, minColumns) => {
      const items = [
        makeItem({
          startDate: "2026-04-01",
          endDate: "2026-04-05",
        }),
        makeItem({
          startDate: "2026-05-01",
          endDate: "2026-05-03",
        }),
      ];

      const columns = buildTimelineColumns(items, scale);
      expect(columns.length).toBeGreaterThanOrEqual(minColumns);
    }
  );
});

describe("buildTimelineLayout", () => {
  it("maps milestones and tasks to column spans", () => {
    const columns = buildTimelineColumns(
      [
        makeItem({ id: "task", startDate: "2026-04-01", endDate: "2026-04-05" }),
        makeItem({
          id: "ms",
          type: "milestone",
          startDate: "2026-04-03",
          endDate: "2026-04-03",
          dueDate: "2026-04-03",
        }),
      ],
      "day"
    );

    const layout = buildTimelineLayout(
      [
        makeItem({ id: "task", startDate: "2026-04-01", endDate: "2026-04-05" }),
        makeItem({
          id: "ms",
          type: "milestone",
          startDate: "2026-04-03",
          endDate: "2026-04-03",
          dueDate: "2026-04-03",
        }),
      ],
      columns
    );

    expect(layout.get("task")).toMatchObject({
      startColumn: 0,
      endColumn: 4,
      isMilestone: false,
    });
    expect(layout.get("ms")).toMatchObject({
      startColumn: 2,
      endColumn: 2,
      isMilestone: true,
    });
  });
});

describe("applyTimelineInteraction", () => {
  it("moves a five-day task by two days without changing duration", () => {
    const result = applyTimelineInteraction(
      makeItem({
        startDate: "2026-04-10",
        endDate: "2026-04-14",
        durationDays: 5,
      }),
      "day",
      "move",
      2
    );

    expect(result).toEqual({
      startDate: "2026-04-12",
      endDate: "2026-04-16",
    });
  });

  it("extends a five-day task by three days from the right edge", () => {
    const result = applyTimelineInteraction(
      makeItem({
        startDate: "2026-04-10",
        endDate: "2026-04-14",
        durationDays: 5,
      }),
      "day",
      "resize_end",
      3
    );

    expect(result).toEqual({
      startDate: "2026-04-10",
      endDate: "2026-04-17",
    });
  });
});
