import { describe, expect, it } from "vitest";
import {
  advanceRecurrenceNextOccurrenceAt,
  deriveRecurringOccurrenceEndDate,
} from "./recurrence";

describe("recurrence helpers", () => {
  it("advances weekly recurrence by interval weeks", () => {
    expect(
      advanceRecurrenceNextOccurrenceAt("FREQ=WEEKLY;INTERVAL=1;BYDAY=MO", "2026-04-27")
    ).toBe("2026-05-04");
  });

  it("advances monthly recurrence by interval months", () => {
    expect(
      advanceRecurrenceNextOccurrenceAt("FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=1", "2026-05-01")
    ).toBe("2026-06-01");
  });

  it("advances business-day recurrence with default working days", () => {
    expect(
      advanceRecurrenceNextOccurrenceAt(
        "FREQ=DAILY;INTERVAL=1;BYDAY=MO,TU,WE,TH,FR",
        "2026-04-24"
      )
    ).toBe("2026-04-27");
  });

  it("returns null for unsupported recurrence rules", () => {
    expect(
      advanceRecurrenceNextOccurrenceAt("FREQ=YEARLY;INTERVAL=1", "2026-04-24")
    ).toBeNull();
  });

  it("derives occurrence end date from start date and duration", () => {
    expect(deriveRecurringOccurrenceEndDate("2026-05-04", 3)).toBe("2026-05-06");
    expect(deriveRecurringOccurrenceEndDate("2026-05-04", 1)).toBe("2026-05-04");
  });
});
