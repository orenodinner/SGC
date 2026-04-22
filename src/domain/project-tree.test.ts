import { buildVisibleRows, normalizeProjectItems } from "./project-tree";
import type { ItemRecord } from "../shared/contracts";

function makeItem(overrides: Partial<ItemRecord>): ItemRecord {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    workspaceId: "ws-default",
    projectId: "prj-1",
    parentId: overrides.parentId ?? null,
    wbsCode: overrides.wbsCode ?? "",
    type: overrides.type ?? "task",
    title: overrides.title ?? "Task",
    note: "",
    status: overrides.status ?? "not_started",
    priority: "medium",
    assigneeName: "",
    startDate: overrides.startDate ?? null,
    endDate: overrides.endDate ?? null,
    dueDate: null,
    durationDays: overrides.durationDays ?? 1,
    percentComplete: overrides.percentComplete ?? 0,
    estimateHours: 0,
    actualHours: 0,
    sortOrder: overrides.sortOrder ?? 1,
    isScheduled: false,
    isRecurring: false,
    archived: false,
    createdAt: overrides.createdAt ?? "2026-04-21T00:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-04-21T00:00:00.000Z",
    completedAt: null,
    tags: overrides.tags ?? [],
  };
}

describe("normalizeProjectItems", () => {
  it("recalculates WBS code and rollup progress", () => {
    const parent = makeItem({ id: "parent", type: "group", title: "Parent", sortOrder: 1 });
    const childA = makeItem({
      id: "child-a",
      parentId: "parent",
      title: "Child A",
      sortOrder: 1,
      startDate: "2026-04-01",
      endDate: "2026-04-02",
      durationDays: 2,
      percentComplete: 50,
      status: "in_progress",
    });
    const childB = makeItem({
      id: "child-b",
      parentId: "parent",
      title: "Child B",
      sortOrder: 2,
      startDate: "2026-04-03",
      endDate: "2026-04-03",
      durationDays: 1,
      percentComplete: 100,
      status: "done",
    });

    const result = normalizeProjectItems([parent, childA, childB]);
    const normalizedParent = result.items.find((item) => item.id === "parent");

    expect(normalizedParent?.wbsCode).toBe("1");
    expect(result.items.find((item) => item.id === "child-a")?.wbsCode).toBe("1.1");
    expect(result.items.find((item) => item.id === "child-b")?.wbsCode).toBe("1.2");
    expect(normalizedParent?.percentComplete).toBeCloseTo(66.67, 1);
    expect(normalizedParent?.status).toBe("in_progress");
    expect(normalizedParent?.startDate).toBe("2026-04-01");
    expect(normalizedParent?.endDate).toBe("2026-04-03");
  });
});

describe("buildVisibleRows", () => {
  it("hides descendants when collapsed", () => {
    const parent = makeItem({ id: "parent", wbsCode: "1", type: "group" });
    const child = makeItem({ id: "child", parentId: "parent", wbsCode: "1.1" });

    expect(buildVisibleRows([parent, child], new Set<string>()).map((row) => row.item.id)).toEqual([
      "parent",
    ]);
    expect(
      buildVisibleRows([parent, child], new Set<string>(["parent"])).map((row) => row.item.id)
    ).toEqual(["parent", "child"]);
  });
});
