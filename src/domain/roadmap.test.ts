import { describe, expect, it } from "vitest";
import type { ItemRecord } from "../shared/contracts";
import {
  buildRoadmapBuckets,
  buildRoadmapLayout,
  buildRoadmapQuarterHeaders,
} from "./roadmap";

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

describe("buildRoadmapBuckets", () => {
  it("builds calendar-year month buckets from January to December", () => {
    const buckets = buildRoadmapBuckets({
      scale: "year",
      anchorYear: 2026,
    });

    expect(buckets).toHaveLength(12);
    expect(buckets[0]).toMatchObject({
      key: "year-2026-01",
      label: "2026/1",
      shortLabel: "1",
    });
    expect(buckets[11]).toMatchObject({
      key: "year-2026-12",
      label: "2026/12",
      shortLabel: "12",
    });
  });

  it("builds fiscal-year month buckets from the configured fiscal start month", () => {
    const buckets = buildRoadmapBuckets({
      scale: "fy",
      anchorYear: 2026,
      fiscalYearStartMonth: 4,
    });

    expect(buckets).toHaveLength(12);
    expect(buckets[0]).toMatchObject({
      key: "fy-2026-04",
      label: "2026/4",
      shortLabel: "4",
    });
    expect(buckets[11]).toMatchObject({
      key: "fy-2027-03",
      label: "2027/3",
      shortLabel: "3",
    });
  });

  it("builds multiple years of month buckets when yearSpan is provided", () => {
    const buckets = buildRoadmapBuckets({
      scale: "year",
      anchorYear: 2026,
      yearSpan: 3,
    });

    expect(buckets).toHaveLength(36);
    expect(buckets[0]).toMatchObject({
      key: "year-2026-01",
      label: "2026/1",
    });
    expect(buckets[35]).toMatchObject({
      key: "year-2028-12",
      label: "2028/12",
    });
  });
});

describe("buildRoadmapQuarterHeaders", () => {
  it("builds four calendar quarter headers for year view buckets", () => {
    const buckets = buildRoadmapBuckets({
      scale: "year",
      anchorYear: 2026,
    });

    const headers = buildRoadmapQuarterHeaders(buckets);

    expect(headers).toEqual([
      { key: "quarter-year-2026-01", label: "Q1", startColumn: 0, endColumn: 2 },
      { key: "quarter-year-2026-04", label: "Q2", startColumn: 3, endColumn: 5 },
      { key: "quarter-year-2026-07", label: "Q3", startColumn: 6, endColumn: 8 },
      { key: "quarter-year-2026-10", label: "Q4", startColumn: 9, endColumn: 11 },
    ]);
  });

  it("builds fiscal quarter headers from fiscal-year buckets", () => {
    const buckets = buildRoadmapBuckets({
      scale: "fy",
      anchorYear: 2026,
      fiscalYearStartMonth: 4,
    });

    const headers = buildRoadmapQuarterHeaders(buckets);

    expect(headers).toEqual([
      { key: "quarter-fy-2026-04", label: "Q1", startColumn: 0, endColumn: 2 },
      { key: "quarter-fy-2026-07", label: "Q2", startColumn: 3, endColumn: 5 },
      { key: "quarter-fy-2026-10", label: "Q3", startColumn: 6, endColumn: 8 },
      { key: "quarter-fy-2027-01", label: "Q4", startColumn: 9, endColumn: 11 },
    ]);
  });
});

describe("buildRoadmapLayout", () => {
  it("maps a multi-month task and milestone to month columns in year view", () => {
    const buckets = buildRoadmapBuckets({
      scale: "year",
      anchorYear: 2026,
    });

    const layout = buildRoadmapLayout(
      [
        makeItem({
          id: "task",
          startDate: "2026-02-15",
          endDate: "2026-05-10",
        }),
        makeItem({
          id: "ms",
          type: "milestone",
          startDate: "2026-11-03",
          endDate: "2026-11-03",
          dueDate: "2026-11-03",
        }),
      ],
      buckets
    );

    expect(layout.get("task")).toMatchObject({
      startColumn: 1,
      endColumn: 4,
      isMilestone: false,
    });
    expect(layout.get("ms")).toMatchObject({
      startColumn: 10,
      endColumn: 10,
      isMilestone: true,
    });
  });

  it("clips items to visible fiscal-year buckets", () => {
    const buckets = buildRoadmapBuckets({
      scale: "fy",
      anchorYear: 2026,
      fiscalYearStartMonth: 4,
    });

    const layout = buildRoadmapLayout(
      [
        makeItem({
          id: "cross-year",
          startDate: "2026-02-01",
          endDate: "2026-06-15",
        }),
        makeItem({
          id: "late-fy",
          startDate: "2027-02-10",
          endDate: "2027-02-28",
        }),
      ],
      buckets
    );

    expect(layout.get("cross-year")).toMatchObject({
      startColumn: 0,
      endColumn: 2,
      isMilestone: false,
    });
    expect(layout.get("late-fy")).toMatchObject({
      startColumn: 10,
      endColumn: 10,
      isMilestone: false,
    });
  });
});
