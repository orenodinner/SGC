import type { ItemRecord, UpdateItemInput } from "../../shared/contracts";

const HISTORY_LIMIT = 50;

export interface ItemEditSnapshot {
  id: string;
  title: string;
  type: ItemRecord["type"];
  status: ItemRecord["status"];
  priority: ItemRecord["priority"];
  percentComplete: number;
  startDate: string | null;
  endDate: string | null;
  assigneeName: string;
  note: string;
  tags: string[];
}

export interface ItemEditHistoryEntry {
  itemId: string;
  before: ItemEditSnapshot;
  after: ItemEditSnapshot;
}

export interface ItemEditHistoryState {
  undoStack: ItemEditHistoryEntry[];
  redoStack: ItemEditHistoryEntry[];
}

export function createEmptyItemEditHistory(): ItemEditHistoryState {
  return {
    undoStack: [],
    redoStack: [],
  };
}

export function snapshotItemForHistory(item: ItemRecord): ItemEditSnapshot {
  return {
    id: item.id,
    title: item.title,
    type: item.type,
    status: item.status,
    priority: item.priority,
    percentComplete: item.percentComplete,
    startDate: item.startDate,
    endDate: item.endDate,
    assigneeName: item.assigneeName,
    note: item.note,
    tags: [...item.tags].sort(),
  };
}

export function hasItemEditDifference(left: ItemEditSnapshot, right: ItemEditSnapshot): boolean {
  return JSON.stringify(left) !== JSON.stringify(right);
}

export function pushItemEditHistory(
  state: ItemEditHistoryState,
  entry: ItemEditHistoryEntry
): ItemEditHistoryState {
  return {
    undoStack: [...state.undoStack, entry].slice(-HISTORY_LIMIT),
    redoStack: [],
  };
}

export function takeUndoHistoryEntry(state: ItemEditHistoryState): {
  entry: ItemEditHistoryEntry | null;
  nextState: ItemEditHistoryState;
} {
  const entry = state.undoStack.at(-1) ?? null;
  if (!entry) {
    return {
      entry: null,
      nextState: state,
    };
  }

  return {
    entry,
    nextState: {
      undoStack: state.undoStack.slice(0, -1),
      redoStack: [...state.redoStack, entry].slice(-HISTORY_LIMIT),
    },
  };
}

export function takeRedoHistoryEntry(state: ItemEditHistoryState): {
  entry: ItemEditHistoryEntry | null;
  nextState: ItemEditHistoryState;
} {
  const entry = state.redoStack.at(-1) ?? null;
  if (!entry) {
    return {
      entry: null,
      nextState: state,
    };
  }

  return {
    entry,
    nextState: {
      undoStack: [...state.undoStack, entry].slice(-HISTORY_LIMIT),
      redoStack: state.redoStack.slice(0, -1),
    },
  };
}

export function snapshotToUpdateItemInput(snapshot: ItemEditSnapshot): UpdateItemInput {
  return {
    id: snapshot.id,
    title: snapshot.title,
    type: snapshot.type,
    status: snapshot.status,
    priority: snapshot.priority,
    percentComplete: snapshot.percentComplete,
    startDate: snapshot.startDate,
    endDate: snapshot.endDate,
    assigneeName: snapshot.assigneeName,
    note: snapshot.note,
    tags: snapshot.tags,
  };
}
