import { addMinutes } from "date-fns";
import type { Priority, QuickCaptureParseResult } from "../shared/contracts";

interface ParseOptions {
  now?: Date;
}

const DATE_RANGE_PATTERN =
  /(?<startMonth>\d{1,2})\/(?<startDay>\d{1,2})\s*-\s*(?:(?<endMonth>\d{1,2})\/)?(?<endDay>\d{1,2})/;
const SINGLE_DATE_PATTERN = /(?<month>\d{1,2})\/(?<day>\d{1,2})/;
const TIME_PATTERN = /(?<hour>\d{1,2}):(?<minute>\d{2})/;
const DURATION_PATTERN = /(?<value>\d+)\s*(?<unit>分|時間|h|H|hours?|hrs?)/i;
const ASSIGNEE_PATTERN = /@(?<value>[^\s@#!]+)/g;
const TAG_PATTERN = /#(?<value>[^\s@#!]+)/g;
const PRIORITY_PATTERN = /!(?<value>緊急|critical|高|high|中|medium|低|low)/i;

export function parseQuickCapture(text: string, options: ParseOptions = {}): QuickCaptureParseResult {
  const now = options.now ?? new Date();
  let working = normalizeSpaces(text);
  let note = "";
  let startDate: string | null = null;
  let endDate: string | null = null;
  let dueDate: string | null = null;
  let estimateHours = 0;
  let assigneeName = "";
  let priority: Priority = "medium";

  const tags = collectMatches(working, TAG_PATTERN);
  working = working.replace(TAG_PATTERN, " ");

  const assignees = collectMatches(working, ASSIGNEE_PATTERN);
  assigneeName = assignees[0] ?? "";
  working = working.replace(ASSIGNEE_PATTERN, " ");

  const priorityMatch = PRIORITY_PATTERN.exec(working);
  if (priorityMatch?.groups?.value) {
    priority = mapPriority(priorityMatch.groups.value);
    working = working.replace(priorityMatch[0], " ");
  }

  const rangeMatch = DATE_RANGE_PATTERN.exec(working);
  if (rangeMatch?.groups) {
    const start = makeDateOnly(
      now,
      Number(rangeMatch.groups.startMonth),
      Number(rangeMatch.groups.startDay)
    );
    const end = makeDateOnly(
      now,
      Number(rangeMatch.groups.endMonth ?? rangeMatch.groups.startMonth),
      Number(rangeMatch.groups.endDay)
    );
    startDate = formatDate(start);
    endDate = formatDate(end);
    dueDate = endDate;
    working = working.replace(rangeMatch[0], " ");
  } else {
    const singleDateMatch = SINGLE_DATE_PATTERN.exec(working);
    if (singleDateMatch?.groups) {
      const date = makeDateOnly(
        now,
        Number(singleDateMatch.groups.month),
        Number(singleDateMatch.groups.day)
      );
      startDate = formatDate(date);
      endDate = formatDate(date);
      dueDate = formatDate(date);
      working = working.replace(singleDateMatch[0], " ");
    }
  }

  const timeMatch = TIME_PATTERN.exec(working);
  if (timeMatch?.groups) {
    if (startDate) {
      const timedStart = makeDateTime(
        startDate,
        Number(timeMatch.groups.hour),
        Number(timeMatch.groups.minute)
      );
      startDate = timedStart;
      endDate = timedStart;
      dueDate = timedStart;
    }
    working = working.replace(timeMatch[0], " ");
  }

  const durationMatch = DURATION_PATTERN.exec(working);
  if (durationMatch?.groups) {
    const minutes = parseDurationMinutes(
      Number(durationMatch.groups.value),
      durationMatch.groups.unit
    );
    estimateHours = minutes / 60;
    if (startDate) {
      const nextEnd = addMinutes(new Date(startDate), minutes);
      endDate = includesTime(startDate) ? nextEnd.toISOString().slice(0, 19) : formatDate(nextEnd);
      dueDate = endDate;
    }
    working = working.replace(durationMatch[0], " ");
  }

  const unsupportedTokens: string[] = [];
  const titleTokens: string[] = [];
  for (const token of normalizeSpaces(working).split(" ").filter(Boolean)) {
    if (isUnsupportedPlanningToken(token)) {
      unsupportedTokens.push(token);
    } else {
      titleTokens.push(token);
    }
  }

  if (unsupportedTokens.length > 0) {
    note = unsupportedTokens.join(" ");
  }

  const title = normalizeSpaces(titleTokens.join(" ")) || normalizeSpaces(text);

  return {
    rawText: text,
    title,
    note,
    assigneeName,
    tags,
    priority,
    startDate,
    endDate,
    dueDate,
    estimateHours,
    isScheduled: Boolean(startDate && endDate),
  };
}

function collectMatches(text: string, pattern: RegExp): string[] {
  const values: string[] = [];
  const matcher = new RegExp(pattern.source, pattern.flags);
  let match = matcher.exec(text);
  while (match) {
    const value = match.groups?.value?.trim();
    if (value && !values.includes(value)) {
      values.push(value);
    }
    match = matcher.exec(text);
  }
  return values;
}

function normalizeSpaces(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function makeDateOnly(base: Date, month: number, day: number): Date {
  return new Date(base.getFullYear(), month - 1, day, 0, 0, 0, 0);
}

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function makeDateTime(dateText: string, hour: number, minute: number): string {
  const date = new Date(`${dateText}T00:00:00`);
  date.setHours(hour, minute, 0, 0);
  return [
    `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`,
    `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`,
  ].join("T");
}

function includesTime(dateText: string): boolean {
  return dateText.includes("T");
}

function parseDurationMinutes(value: number, unit: string): number {
  switch (unit.toLowerCase()) {
    case "時間":
    case "h":
    case "hours":
    case "hour":
    case "hrs":
    case "hr":
      return value * 60;
    default:
      return value;
  }
}

function mapPriority(value: string): Priority {
  switch (value.toLowerCase()) {
    case "緊急":
    case "critical":
      return "critical";
    case "高":
    case "high":
      return "high";
    case "低":
    case "low":
      return "low";
    default:
      return "medium";
  }
}

function isUnsupportedPlanningToken(token: string): boolean {
  return /^(毎週|毎月|毎営業日|隔週)/.test(token);
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}
