import { addDays } from "date-fns";

export const DEFAULT_WORKING_DAY_NUMBERS = [1, 2, 3, 4, 5] as const;

export function isWorkingDay(
  date: Date,
  workingDayNumbers: readonly number[] = DEFAULT_WORKING_DAY_NUMBERS
): boolean {
  return workingDayNumbers.includes(date.getDay());
}

export function moveToWorkingDay(
  date: Date,
  direction: 1 | -1 = 1,
  workingDayNumbers: readonly number[] = DEFAULT_WORKING_DAY_NUMBERS
): Date {
  let cursor = new Date(date);
  while (!isWorkingDay(cursor, workingDayNumbers)) {
    cursor = addDays(cursor, direction);
  }
  return cursor;
}

export function addWorkingDays(
  date: Date,
  amount: number,
  workingDayNumbers: readonly number[] = DEFAULT_WORKING_DAY_NUMBERS
): Date {
  if (amount === 0) {
    return moveToWorkingDay(date, 1, workingDayNumbers);
  }

  const step: 1 | -1 = amount > 0 ? 1 : -1;
  let remaining = Math.abs(amount);
  let cursor = new Date(date);

  while (remaining > 0) {
    cursor = addDays(cursor, step);
    if (isWorkingDay(cursor, workingDayNumbers)) {
      remaining -= 1;
    }
  }

  return moveToWorkingDay(cursor, step, workingDayNumbers);
}
