import { describe, expect, it } from "vitest";
import type { ItemRecord } from "../../shared/contracts";
import {
  createEmptyItemEditHistory,
  hasItemEditDifference,
  pushItemEditHistory,
  snapshotItemForHistory,
  snapshotToUpdateItemInput,
  takeRedoHistoryEntry,
  takeUndoHistoryEntry,
} from "./item-edit-history";

function makeItem(overrides: Partial<ItemRecord>): ItemRecord {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    workspaceId: "ws-default",
    projectId: "prj-1",
    projectName: "Project",
    parentId: null,
    wbsCode: "1",
    type: "task",
    title: overrides.title ?? "Task",
    note: overrides.note ?? "",
    status: overrides.status ?? "not_started",
    priority: overrides.priority ?? "medium",
    assigneeName: overrides.assigneeName ?? "",
    startDate: overrides.startDate ?? null,
    endDate: overrides.endDate ?? null,
    dueDate: null,
    durationDays: 1,
    percentComplete: overrides.percentComplete ?? 0,
    estimateHours: 0,
    actualHours: 0,
    sortOrder: 1,
    isScheduled: false,
    isRecurring: false,
    archived: false,
    createdAt: "2026-04-22T00:00:00.000Z",
    updatedAt: "2026-04-22T00:00:00.000Z",
    completedAt: null,
    tags: overrides.tags ?? [],
  };
}

describe("item edit history", () => {
  it("tracks undo and redo entries in order", () => {
    const before = snapshotItemForHistory(makeItem({ title: "Before" }));
    const after = snapshotItemForHistory(makeItem({ id: before.id, title: "After" }));
    const history = pushItemEditHistory(createEmptyItemEditHistory(), {
      itemId: before.id,
      before,
      after,
    });

    const undone = takeUndoHistoryEntry(history);
    expect(undone.entry?.before.title).toBe("Before");
    expect(undone.nextState.undoStack).toHaveLength(0);
    expect(undone.nextState.redoStack).toHaveLength(1);

    const redone = takeRedoHistoryEntry(undone.nextState);
    expect(redone.entry?.after.title).toBe("After");
    expect(redone.nextState.undoStack).toHaveLength(1);
    expect(redone.nextState.redoStack).toHaveLength(0);
  });

  it("normalizes tags and converts snapshots back to update input", () => {
    const snapshot = snapshotItemForHistory(
      makeItem({
        id: "item-1",
        tags: ["b", "a"],
        note: "memo",
        startDate: "2026-04-22",
        endDate: "2026-04-23",
      })
    );

    expect(snapshot.tags).toEqual(["a", "b"]);
    expect(hasItemEditDifference(snapshot, { ...snapshot, note: "updated" })).toBe(true);
    expect(snapshotToUpdateItemInput(snapshot)).toMatchObject({
      id: "item-1",
      note: "memo",
      tags: ["a", "b"],
      startDate: "2026-04-22",
      endDate: "2026-04-23",
    });
  });
});
