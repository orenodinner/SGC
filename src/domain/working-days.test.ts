import { describe, expect, it } from "vitest";
import {
  addWorkingDays,
  isWorkingDay,
  moveToWorkingDay,
  normalizeWorkingDayNumbers,
  parseWorkingDayNumbers,
  serializeWorkingDayNumbers,
} from "./working-days";

describe("working day utilities", () => {
  it("detects monday to friday as working days by default", () => {
    expect(isWorkingDay(new Date("2026-04-24T09:00:00+09:00"))).toBe(true);
    expect(isWorkingDay(new Date("2026-04-25T09:00:00+09:00"))).toBe(false);
    expect(isWorkingDay(new Date("2026-04-26T09:00:00+09:00"))).toBe(false);
  });

  it("moves weekends to the next working day", () => {
    expect(moveToWorkingDay(new Date("2026-04-25T09:00:00+09:00")).toISOString().slice(0, 10)).toBe(
      "2026-04-27"
    );
  });

  it("adds working days across weekends", () => {
    expect(addWorkingDays(new Date("2026-04-24T09:00:00+09:00"), 1).toISOString().slice(0, 10)).toBe(
      "2026-04-27"
    );
    expect(addWorkingDays(new Date("2026-04-24T09:00:00+09:00"), 2).toISOString().slice(0, 10)).toBe(
      "2026-04-28"
    );
  });

  it("normalizes working day numbers and falls back to monday-friday", () => {
    expect(normalizeWorkingDayNumbers([5, 1, 5, 3])).toEqual([1, 3, 5]);
    expect(normalizeWorkingDayNumbers([])).toEqual([1, 2, 3, 4, 5]);
  });

  it("serializes and parses working day numbers", () => {
    expect(serializeWorkingDayNumbers([4, 0, 1, 4])).toBe("0,1,4");
    expect(parseWorkingDayNumbers("4,0,1,4")).toEqual([0, 1, 4]);
  });
});
