import { differenceInCalendarDays, parseISO } from "date-fns";
import type { ItemRecord, ItemStatus, RowReorderPlacement } from "../shared/contracts";

export interface TreeRow {
  item: ItemRecord;
  depth: number;
  hasChildren: boolean;
}

interface LeafContribution {
  weight: number;
  completedWeight: number;
}

interface VisitResult {
  leaves: LeafContribution[];
  startDate: string | null;
  endDate: string | null;
}

export interface ProjectRollup {
  items: ItemRecord[];
  projectStartDate: string | null;
  projectEndDate: string | null;
  projectProgress: number;
}

export interface SiblingReorderPatch {
  id: string;
  sortOrder: number;
}

export function normalizeProjectItems(items: ItemRecord[]): ProjectRollup {
  const normalized = items
    .filter((item) => !item.archived)
    .map((item) => ({
      ...item,
      percentComplete: clampPercent(item.percentComplete),
    }));

  const childrenByParent = buildChildrenMap(normalized);
  const roots = sortItems(childrenByParent.get(null) ?? []);

  const visit = (item: ItemRecord, path: number[]): VisitResult => {
    item.wbsCode = path.join(".");
    const children = sortItems(childrenByParent.get(item.id) ?? []);

    if (children.length === 0) {
      normalizeLeaf(item);
      return {
        leaves: [
          {
            weight: Math.max(item.durationDays, 1),
            completedWeight: (Math.max(item.durationDays, 1) * item.percentComplete) / 100,
          },
        ],
        startDate: item.startDate,
        endDate: item.endDate,
      };
    }

    const visitedChildren = children.map((child, index) => visit(child, [...path, index + 1]));
    const leafContributions = visitedChildren.flatMap((result) => result.leaves);
    const totalWeight = leafContributions.reduce((sum, value) => sum + value.weight, 0);
    const completedWeight = leafContributions.reduce(
      (sum, value) => sum + value.completedWeight,
      0
    );

    item.percentComplete = totalWeight === 0 ? 0 : round2((completedWeight / totalWeight) * 100);
    item.startDate = minDate(visitedChildren.map((result) => result.startDate));
    item.endDate = maxDate(visitedChildren.map((result) => result.endDate));
    item.durationDays = inferDurationDays(item.startDate, item.endDate, item.durationDays);
    item.status = deriveParentStatus(children);

    return {
      leaves: leafContributions,
      startDate: item.startDate,
      endDate: item.endDate,
    };
  };

  const rootResults = roots.map((root, index) => visit(root, [index + 1]));
  const allLeaves = rootResults.flatMap((result) => result.leaves);
  const totalWeight = allLeaves.reduce((sum, value) => sum + value.weight, 0);

  return {
    items: normalized,
    projectStartDate: minDate(rootResults.map((result) => result.startDate)),
    projectEndDate: maxDate(rootResults.map((result) => result.endDate)),
    projectProgress:
      totalWeight === 0
        ? 0
        : round2(
            (allLeaves.reduce((sum, value) => sum + value.completedWeight, 0) / totalWeight) * 100
          ),
  };
}

export function buildVisibleRows(items: ItemRecord[], expandedIds: ReadonlySet<string>): TreeRow[] {
  const childrenByParent = buildChildrenMap(items.filter((item) => !item.archived));
  const roots = sortItems(childrenByParent.get(null) ?? []);
  const rows: TreeRow[] = [];

  const pushRows = (item: ItemRecord, depth: number): void => {
    const children = sortItems(childrenByParent.get(item.id) ?? []);
    rows.push({
      item,
      depth,
      hasChildren: children.length > 0,
    });

    if (children.length > 0 && expandedIds.has(item.id)) {
      for (const child of children) {
        pushRows(child, depth + 1);
      }
    }
  };

  for (const root of roots) {
    pushRows(root, 0);
  }

  return rows;
}

export function buildFilteredVisibleRows(input: {
  items: ItemRecord[];
  expandedIds: ReadonlySet<string>;
  includedItemIds: ReadonlySet<string>;
}): TreeRow[] {
  const filteredItems = input.items.filter((item) => !item.archived);
  const childrenByParent = buildChildrenMap(filteredItems);
  const roots = sortItems(childrenByParent.get(null) ?? []);
  const rows: TreeRow[] = [];

  const collectRows = (item: ItemRecord, depth: number): boolean => {
    const children = sortItems(childrenByParent.get(item.id) ?? []);
    const descendantRows: TreeRow[] = [];
    let hasIncludedDescendant = false;

    for (const child of children) {
      const childIncluded = collectChildRows(child, depth + 1, descendantRows);
      if (childIncluded) {
        hasIncludedDescendant = true;
      }
    }

    const includedSelf = input.includedItemIds.has(item.id);
    if (!includedSelf && !hasIncludedDescendant) {
      return false;
    }

    rows.push({
      item,
      depth,
      hasChildren: children.length > 0,
    });

    if (children.length > 0 && (input.expandedIds.has(item.id) || hasIncludedDescendant)) {
      rows.push(...descendantRows);
    }

    return true;
  };

  const collectChildRows = (item: ItemRecord, depth: number, targetRows: TreeRow[]): boolean => {
    const children = sortItems(childrenByParent.get(item.id) ?? []);
    const descendantRows: TreeRow[] = [];
    let hasIncludedDescendant = false;

    for (const child of children) {
      const childIncluded = collectChildRows(child, depth + 1, descendantRows);
      if (childIncluded) {
        hasIncludedDescendant = true;
      }
    }

    const includedSelf = input.includedItemIds.has(item.id);
    if (!includedSelf && !hasIncludedDescendant) {
      return false;
    }

    targetRows.push({
      item,
      depth,
      hasChildren: children.length > 0,
    });

    if (children.length > 0 && (input.expandedIds.has(item.id) || hasIncludedDescendant)) {
      targetRows.push(...descendantRows);
    }

    return true;
  };

  for (const root of roots) {
    collectRows(root, 0);
  }

  return rows;
}

export function resolveSiblingReorder(input: {
  items: ItemRecord[];
  itemId: string;
  targetItemId: string;
  placement: RowReorderPlacement;
}): SiblingReorderPatch[] | null {
  const item = input.items.find((entry) => entry.id === input.itemId && !entry.archived);
  const targetItem = input.items.find((entry) => entry.id === input.targetItemId && !entry.archived);
  if (!item || !targetItem || item.id === targetItem.id || item.parentId !== targetItem.parentId) {
    return null;
  }

  const siblings = sortItems(
    input.items.filter((entry) => !entry.archived && entry.parentId === item.parentId)
  );
  const currentOrder = siblings.map((entry) => entry.id);
  const siblingsWithoutItem = siblings.filter((entry) => entry.id !== item.id);
  const targetIndex = siblingsWithoutItem.findIndex((entry) => entry.id === targetItem.id);
  if (targetIndex === -1) {
    return null;
  }

  const insertIndex = input.placement === "after" ? targetIndex + 1 : targetIndex;
  siblingsWithoutItem.splice(insertIndex, 0, item);
  const nextOrder = siblingsWithoutItem.map((entry) => entry.id);
  if (nextOrder.every((entry, index) => entry === currentOrder[index])) {
    return null;
  }

  return siblingsWithoutItem.map((entry, index) => ({
    id: entry.id,
    sortOrder: index + 1,
  }));
}

function buildChildrenMap(items: ItemRecord[]): Map<string | null, ItemRecord[]> {
  const childrenByParent = new Map<string | null, ItemRecord[]>();

  for (const item of items) {
    const key = item.parentId;
    const existing = childrenByParent.get(key);
    if (existing) {
      existing.push(item);
    } else {
      childrenByParent.set(key, [item]);
    }
  }

  return childrenByParent;
}

function sortItems(items: ItemRecord[]): ItemRecord[] {
  return [...items].sort((left, right) => {
    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder;
    }

    return left.createdAt.localeCompare(right.createdAt);
  });
}

function normalizeLeaf(item: ItemRecord): void {
  if (item.type === "milestone") {
    item.endDate = item.endDate ?? item.startDate;
    item.startDate = item.startDate ?? item.endDate;
    item.durationDays = 1;
  } else {
    item.durationDays = inferDurationDays(item.startDate, item.endDate, item.durationDays);
  }

  if (item.status === "done") {
    item.percentComplete = 100;
  } else if (item.percentComplete === 100) {
    item.status = "done";
  } else if (item.percentComplete > 0 && item.status === "not_started") {
    item.status = "in_progress";
  }
}

function inferDurationDays(
  startDate: string | null,
  endDate: string | null,
  fallback: number
): number {
  if (!startDate || !endDate) {
    return Math.max(fallback, 1);
  }

  return Math.max(differenceInCalendarDays(parseISO(endDate), parseISO(startDate)) + 1, 1);
}

function deriveParentStatus(children: ItemRecord[]): ItemStatus {
  if (children.some((item) => item.status === "blocked")) {
    return "blocked";
  }

  if (children.every((item) => item.status === "done")) {
    return "done";
  }

  if (
    children.some((item) =>
      ["in_progress", "done", "blocked"].includes(item.status)
    )
  ) {
    return "in_progress";
  }

  return "not_started";
}

function minDate(values: Array<string | null>): string | null {
  const filtered = values.filter((value): value is string => Boolean(value));
  if (filtered.length === 0) {
    return null;
  }

  return filtered.reduce((current, value) => (value < current ? value : current));
}

function maxDate(values: Array<string | null>): string | null {
  const filtered = values.filter((value): value is string => Boolean(value));
  if (filtered.length === 0) {
    return null;
  }

  return filtered.reduce((current, value) => (value > current ? value : current));
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, round2(value)));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
