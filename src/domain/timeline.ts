import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  eachMonthOfInterval,
  eachWeekOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isBefore,
  isWithinInterval,
  max as maxDate,
  min as minDate,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import type { ItemRecord } from "../shared/contracts";

export type TimelineScale = "day" | "week" | "month";
export type TimelineInteractionMode = "move" | "resize_end";

export interface TimelineColumn {
  key: string;
  label: string;
  shortLabel: string;
  start: Date;
  end: Date;
}

export interface TimelineBarLayout {
  itemId: string;
  startColumn: number;
  endColumn: number;
  isMilestone: boolean;
}

export interface TimelineEditResult {
  startDate: string;
  endDate: string;
}

export function buildTimelineColumns(items: ItemRecord[], scale: TimelineScale): TimelineColumn[] {
  const datedItems = items
    .map((item) => getTimelineRange(item))
    .filter((range): range is { start: Date; end: Date } => Boolean(range));

  const defaultCenter = startOfDay(new Date());
  const rangeStart =
    datedItems.length > 0
      ? minDate(datedItems.map((entry) => entry.start))
      : addDays(defaultCenter, -3);
  const rangeEnd =
    datedItems.length > 0
      ? maxDate(datedItems.map((entry) => entry.end))
      : addDays(defaultCenter, 10);

  if (scale === "day") {
    return eachDayOfInterval({
      start: startOfDay(rangeStart),
      end: startOfDay(rangeEnd),
    }).map((date) => ({
      key: format(date, "yyyy-MM-dd"),
      label: format(date, "M/d"),
      shortLabel: format(date, "d"),
      start: startOfDay(date),
      end: startOfDay(date),
    }));
  }

  if (scale === "week") {
    return eachWeekOfInterval(
      {
        start: startOfWeek(rangeStart, { weekStartsOn: 1 }),
        end: endOfWeek(rangeEnd, { weekStartsOn: 1 }),
      },
      { weekStartsOn: 1 }
    ).map((date) => ({
      key: format(date, "yyyy-'W'II"),
      label: `${format(date, "M/d")}週`,
      shortLabel: format(date, "M/d"),
      start: startOfWeek(date, { weekStartsOn: 1 }),
      end: endOfWeek(date, { weekStartsOn: 1 }),
    }));
  }

  return eachMonthOfInterval({
    start: startOfMonth(rangeStart),
    end: endOfMonth(rangeEnd),
  }).map((date) => ({
    key: format(date, "yyyy-MM"),
    label: format(date, "yyyy/M"),
    shortLabel: format(date, "M月"),
    start: startOfMonth(date),
    end: endOfMonth(date),
  }));
}

export function buildTimelineLayout(
  items: ItemRecord[],
  columns: TimelineColumn[]
): Map<string, TimelineBarLayout> {
  const layouts = new Map<string, TimelineBarLayout>();

  items.forEach((item) => {
    const range = getTimelineRange(item);
    if (!range || columns.length === 0) {
      return;
    }

    const startColumn = columns.findIndex((column) =>
      isWithinInterval(range.start, { start: column.start, end: column.end })
    );
    const endColumn = columns.findIndex((column) =>
      isWithinInterval(range.end, { start: column.start, end: column.end })
    );

    const normalizedStart =
      startColumn >= 0
        ? startColumn
        : isBefore(range.start, columns[0].start)
          ? 0
          : columns.length - 1;
    const normalizedEnd =
      endColumn >= 0
        ? endColumn
        : isBefore(range.end, columns[0].start)
          ? 0
          : columns.length - 1;

    layouts.set(item.id, {
      itemId: item.id,
      startColumn: Math.min(normalizedStart, normalizedEnd),
      endColumn: Math.max(normalizedStart, normalizedEnd),
      isMilestone: item.type === "milestone" || normalizedStart === normalizedEnd,
    });
  });

  return layouts;
}

export function applyTimelineInteraction(
  item: ItemRecord,
  scale: TimelineScale,
  mode: TimelineInteractionMode,
  deltaUnits: number
): TimelineEditResult | null {
  if (deltaUnits === 0 || !item.startDate || !item.endDate) {
    return null;
  }

  const start = parseISO(item.startDate);
  const end = parseISO(item.endDate);

  if (mode === "move") {
    return {
      startDate: formatDateOnly(shiftDate(start, scale, deltaUnits)),
      endDate: formatDateOnly(shiftDate(end, scale, deltaUnits)),
    };
  }

  const shiftedEnd = shiftDate(end, scale, deltaUnits);
  const nextEnd = isBefore(shiftedEnd, start) ? start : shiftedEnd;

  return {
    startDate: formatDateOnly(start),
    endDate: formatDateOnly(nextEnd),
  };
}

function getTimelineRange(item: ItemRecord): { start: Date; end: Date } | null {
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

function shiftDate(date: Date, scale: TimelineScale, deltaUnits: number): Date {
  switch (scale) {
    case "day":
      return addDays(date, deltaUnits);
    case "week":
      return addWeeks(date, deltaUnits);
    case "month":
      return addMonths(date, deltaUnits);
  }
}

function formatDateOnly(date: Date): string {
  return format(date, "yyyy-MM-dd");
}
