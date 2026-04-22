import { addMonths, endOfMonth, format, parseISO, startOfMonth } from "date-fns";
import type { ItemRecord } from "../shared/contracts";

export type RoadmapScale = "year" | "fy";

export interface RoadmapBucket {
  key: string;
  label: string;
  shortLabel: string;
  start: Date;
  end: Date;
}

export interface RoadmapLayout {
  itemId: string;
  startColumn: number;
  endColumn: number;
  isMilestone: boolean;
}

export interface RoadmapQuarterHeader {
  key: string;
  label: string;
  startColumn: number;
  endColumn: number;
}

export interface BuildRoadmapBucketsInput {
  scale: RoadmapScale;
  anchorYear: number;
  fiscalYearStartMonth?: number;
}

export function buildRoadmapBuckets(input: BuildRoadmapBucketsInput): RoadmapBucket[] {
  const fiscalYearStartMonth = clampMonth(input.fiscalYearStartMonth ?? 4);
  const startMonthIndex = input.scale === "year" ? 0 : fiscalYearStartMonth - 1;
  const startYear = input.scale === "year" ? input.anchorYear : input.anchorYear;
  const start = new Date(Date.UTC(startYear, startMonthIndex, 1));

  return Array.from({ length: 12 }, (_, index) => {
    const date = addMonths(start, index);
    return {
      key: `${input.scale}-${format(date, "yyyy-MM")}`,
      label: format(date, "yyyy/M"),
      shortLabel: format(date, "M"),
      start: startOfMonth(date),
      end: endOfMonth(date),
    };
  });
}

export function buildRoadmapLayout(
  items: ItemRecord[],
  buckets: RoadmapBucket[]
): Map<string, RoadmapLayout> {
  const layouts = new Map<string, RoadmapLayout>();

  for (const item of items) {
    const range = getRoadmapRange(item);
    if (!range || buckets.length === 0) {
      continue;
    }

    const overlappingColumns = buckets
      .map((bucket, index) => (rangesOverlap(range.start, range.end, bucket.start, bucket.end) ? index : -1))
      .filter((index) => index >= 0);

    if (overlappingColumns.length === 0) {
      continue;
    }

    layouts.set(item.id, {
      itemId: item.id,
      startColumn: overlappingColumns[0],
      endColumn: overlappingColumns[overlappingColumns.length - 1],
      isMilestone: item.type === "milestone",
    });
  }

  return layouts;
}

export function buildRoadmapQuarterHeaders(
  buckets: RoadmapBucket[]
): RoadmapQuarterHeader[] {
  return Array.from({ length: Math.ceil(buckets.length / 3) }, (_, index) => {
    const startColumn = index * 3;
    const endColumn = Math.min(startColumn + 2, buckets.length - 1);
    const startBucket = buckets[startColumn];

    return {
      key: `quarter-${startBucket?.key ?? index}`,
      label: `Q${index + 1}`,
      startColumn,
      endColumn,
    };
  }).filter((header) => header.startColumn <= header.endColumn);
}

function getRoadmapRange(item: ItemRecord): { start: Date; end: Date } | null {
  const startText = item.startDate ?? item.dueDate ?? item.endDate;
  const endText = item.endDate ?? item.startDate ?? item.dueDate;
  if (!startText || !endText) {
    return null;
  }

  return {
    start: parseISO(startText),
    end: parseISO(endText),
  };
}

function rangesOverlap(
  rangeStart: Date,
  rangeEnd: Date,
  bucketStart: Date,
  bucketEnd: Date
): boolean {
  return rangeStart <= bucketEnd && rangeEnd >= bucketStart;
}

function clampMonth(month: number): number {
  return Math.min(Math.max(month, 1), 12);
}
