import { addDays } from "date-fns";

export const DEFAULT_WORKING_DAY_NUMBERS = [1, 2, 3, 4, 5] as const;
export const ALL_WORKING_DAY_NUMBERS = [0, 1, 2, 3, 4, 5, 6] as const;

export function normalizeWorkingDayNumbers(
  workingDayNumbers: readonly number[] | null | undefined
): number[] {
  const uniqueValues = [
    ...new Set(
      (workingDayNumbers ?? []).filter((value) =>
        ALL_WORKING_DAY_NUMBERS.includes(value as 0 | 1 | 2 | 3 | 4 | 5 | 6)
      )
    ),
  ];
  const normalized = uniqueValues.sort((left, right) => left - right);
  return normalized.length > 0 ? normalized : [...DEFAULT_WORKING_DAY_NUMBERS];
}

export function serializeWorkingDayNumbers(workingDayNumbers: readonly number[]): string {
  return normalizeWorkingDayNumbers(workingDayNumbers).join(",");
}

export function parseWorkingDayNumbers(value: string | null | undefined): number[] {
  if (!value) {
    return [...DEFAULT_WORKING_DAY_NUMBERS];
  }

  return normalizeWorkingDayNumbers(
    value
      .split(",")
      .map((entry) => Number(entry.trim()))
      .filter((entry) => Number.isInteger(entry))
  );
}

export function isWorkingDay(
  date: Date,
  workingDayNumbers: readonly number[] = DEFAULT_WORKING_DAY_NUMBERS
): boolean {
  return normalizeWorkingDayNumbers(workingDayNumbers).includes(date.getDay());
}

export function moveToWorkingDay(
  date: Date,
  direction: 1 | -1 = 1,
  workingDayNumbers: readonly number[] = DEFAULT_WORKING_DAY_NUMBERS
): Date {
  const normalizedWorkingDayNumbers = normalizeWorkingDayNumbers(workingDayNumbers);
  let cursor = new Date(date);
  while (!isWorkingDay(cursor, normalizedWorkingDayNumbers)) {
    cursor = addDays(cursor, direction);
  }
  return cursor;
}

export function addWorkingDays(
  date: Date,
  amount: number,
  workingDayNumbers: readonly number[] = DEFAULT_WORKING_DAY_NUMBERS
): Date {
  const normalizedWorkingDayNumbers = normalizeWorkingDayNumbers(workingDayNumbers);
  if (amount === 0) {
    return moveToWorkingDay(date, 1, normalizedWorkingDayNumbers);
  }

  const step: 1 | -1 = amount > 0 ? 1 : -1;
  let remaining = Math.abs(amount);
  let cursor = new Date(date);

  while (remaining > 0) {
    cursor = addDays(cursor, step);
    if (isWorkingDay(cursor, normalizedWorkingDayNumbers)) {
      remaining -= 1;
    }
  }

  return moveToWorkingDay(cursor, step, normalizedWorkingDayNumbers);
}
