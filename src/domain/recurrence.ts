import { addDays, addMonths, addWeeks, format, parseISO } from "date-fns";
import { addWorkingDays } from "./working-days";

interface ParsedRecurrenceRule {
  freq: string;
  interval: number;
  byDay: string[];
}

export function advanceRecurrenceNextOccurrenceAt(
  rruleText: string,
  currentOccurrenceDate: string
): string | null {
  const parsed = parseRecurrenceRule(rruleText);
  if (!parsed) {
    return null;
  }

  const currentDate = parseISO(currentOccurrenceDate);
  switch (parsed.freq) {
    case "WEEKLY":
      return format(addWeeks(currentDate, parsed.interval), "yyyy-MM-dd");
    case "MONTHLY":
      return format(addMonths(currentDate, parsed.interval), "yyyy-MM-dd");
    case "DAILY":
      return isDefaultBusinessDayRule(parsed.byDay)
        ? format(addWorkingDays(currentDate, parsed.interval), "yyyy-MM-dd")
        : null;
    default:
      return null;
  }
}

export function deriveRecurringOccurrenceEndDate(
  startDate: string,
  durationDays: number
): string {
  return format(addDays(parseISO(startDate), Math.max(durationDays, 1) - 1), "yyyy-MM-dd");
}

function parseRecurrenceRule(rruleText: string): ParsedRecurrenceRule | null {
  const parts = new Map<string, string>();
  for (const token of rruleText.split(";")) {
    const [key, value] = token.split("=");
    if (!key || !value) {
      continue;
    }
    parts.set(key.trim().toUpperCase(), value.trim().toUpperCase());
  }

  const freq = parts.get("FREQ");
  if (!freq) {
    return null;
  }

  const intervalText = parts.get("INTERVAL") ?? "1";
  const interval = Number(intervalText);
  if (!Number.isInteger(interval) || interval <= 0) {
    return null;
  }

  return {
    freq,
    interval,
    byDay: (parts.get("BYDAY") ?? "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
  };
}

function isDefaultBusinessDayRule(byDay: string[]): boolean {
  return byDay.join(",") === "MO,TU,WE,TH,FR";
}
