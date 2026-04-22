import { describe, expect, it } from "vitest";
import { parseQuickCapture } from "./quick-capture";

describe("parseQuickCapture", () => {
  it("parses title, day, tags, assignee, and priority", () => {
    const result = parseQuickCapture("見積提出 4/25 #営業 @自分 !高", {
      now: new Date("2026-04-21T09:00:00+09:00"),
    });

    expect(result.title).toBe("見積提出");
    expect(result.startDate).toBe("2026-04-25");
    expect(result.endDate).toBe("2026-04-25");
    expect(result.tags).toEqual(["営業"]);
    expect(result.assigneeName).toBe("自分");
    expect(result.priority).toBe("high");
    expect(result.isScheduled).toBe(true);
  });

  it("keeps unsupported recurrence text in note", () => {
    const result = parseQuickCapture("定例会 毎週月曜 10:00 30分", {
      now: new Date("2026-04-21T09:00:00+09:00"),
    });

    expect(result.title).toBe("定例会");
    expect(result.note).toBe("毎週月曜");
    expect(result.estimateHours).toBe(0.5);
  });

  it("leaves unscheduled entries without dates", () => {
    const result = parseQuickCapture("アイデア整理", {
      now: new Date("2026-04-21T09:00:00+09:00"),
    });

    expect(result.title).toBe("アイデア整理");
    expect(result.isScheduled).toBe(false);
    expect(result.startDate).toBeNull();
    expect(result.tags).toEqual([]);
  });
});
