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

export interface RoadmapYearHeader {
  key: string;
  label: string;
  startColumn: number;
  endColumn: number;
}

export interface BuildRoadmapBucketsInput {
  scale: RoadmapScale;
  anchorYear: number;
  fiscalYearStartMonth?: number;
  yearSpan?: number;
}

export function buildRoadmapBuckets(input: BuildRoadmapBucketsInput): RoadmapBucket[] {
  const fiscalYearStartMonth = clampMonth(input.fiscalYearStartMonth ?? 4);
  const monthCount = clampYearSpan(input.yearSpan ?? 1) * 12;
  const startMonthIndex = input.scale === "year" ? 0 : fiscalYearStartMonth - 1;
  const startYear = input.scale === "year" ? input.anchorYear : input.anchorYear;
  const start = new Date(Date.UTC(startYear, startMonthIndex, 1));

  return Array.from({ length: monthCount }, (_, index) => {
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

export function buildRoadmapYearHeaders(buckets: RoadmapBucket[]): RoadmapYearHeader[] {
  return buildContiguousHeaders(buckets, (bucket) => String(bucket.start.getFullYear())).map(
    (header) => ({
      ...header,
      key: `year-header-${header.key}`,
      label: `${header.label}`,
    })
  );
}

export function buildRoadmapQuarterHeaders(
  buckets: RoadmapBucket[],
  fiscalYearStartMonth = 4
): RoadmapQuarterHeader[] {
  const normalizedFiscalStart = clampMonth(fiscalYearStartMonth);
  return buildContiguousHeaders(buckets, (bucket) => {
    const month = bucket.start.getMonth() + 1;
    const fiscalMonthIndex = (month - normalizedFiscalStart + 12) % 12;
    return `Q${Math.floor(fiscalMonthIndex / 3) + 1}`;
  }).map((header) => ({
    ...header,
    key: `quarter-${header.key}`,
  }));
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

function clampYearSpan(yearSpan: number): number {
  return Math.min(Math.max(Math.trunc(yearSpan), 1), 5);
}

function buildContiguousHeaders(
  buckets: RoadmapBucket[],
  getLabel: (bucket: RoadmapBucket) => string
): Array<{ key: string; label: string; startColumn: number; endColumn: number }> {
  const headers: Array<{ key: string; label: string; startColumn: number; endColumn: number }> = [];

  for (const [index, bucket] of buckets.entries()) {
    const label = getLabel(bucket);
    const previous = headers.at(-1);
    if (previous && previous.label === label) {
      previous.endColumn = index;
      continue;
    }

    headers.push({
      key: bucket.key,
      label,
      startColumn: index,
      endColumn: index,
    });
  }

  return headers;
}
