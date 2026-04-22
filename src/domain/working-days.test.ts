import { describe, expect, it } from "vitest";
import { addWorkingDays, isWorkingDay, moveToWorkingDay } from "./working-days";

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
});
