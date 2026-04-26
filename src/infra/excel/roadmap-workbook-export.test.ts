import { describe, expect, it } from "vitest";
import { readStoredZipEntries } from "../../test/zip-test-utils";
import { exportRoadmapWorkbookXlsx } from "./roadmap-workbook-export";

describe("exportRoadmapWorkbookXlsx", () => {
  it("writes a multi-year roadmap workbook with styled month cells", () => {
    const bytes = exportRoadmapWorkbookXlsx({
      scale: "fy",
      anchorYear: 2026,
      yearSpan: 2,
      rangeLabel: "FY2026 - FY2027",
      generatedAt: "2026-04-27T00:00:00.000Z",
      buckets: Array.from({ length: 24 }, (_, index) => {
        const monthIndex = 3 + index;
        const year = 2026 + Math.floor(monthIndex / 12);
        const month = (monthIndex % 12) + 1;
        return {
          key: `fy-${year}-${month}`,
          label: `${year}/${month}`,
          yearLabel: String(year),
          quarterLabel: `Q${(Math.floor(index / 3) % 4) + 1}`,
        };
      }),
      rows: [
        {
          kind: "project",
          title: "基幹刷新",
          subtitle: "PRJ-001",
          projectCode: "PRJ-001",
          projectName: "基幹刷新",
          depth: 0,
          itemType: "group",
          status: "in_progress",
          assigneeName: "佐藤",
          startDate: "2026-04-01",
          endDate: "2027-03-31",
          percentComplete: 25,
          startColumn: 0,
          endColumn: 11,
          isMilestone: false,
        },
        {
          kind: "item",
          title: "設計",
          subtitle: "1.1",
          projectCode: "PRJ-001",
          projectName: "基幹刷新",
          depth: 1,
          itemType: "task",
          status: "in_progress",
          assigneeName: "田中",
          startDate: "2026-05-01",
          endDate: "2026-07-31",
          percentComplete: 40,
          startColumn: 1,
          endColumn: 3,
          isMilestone: false,
        },
        {
          kind: "item",
          title: "本番判定",
          subtitle: "MS",
          projectCode: "PRJ-001",
          projectName: "基幹刷新",
          depth: 1,
          itemType: "milestone",
          status: "not_started",
          assigneeName: "鈴木",
          startDate: "2027-03-15",
          endDate: "2027-03-15",
          percentComplete: 0,
          startColumn: 11,
          endColumn: 11,
          isMilestone: true,
        },
      ],
    });

    const entries = readStoredZipEntries(bytes);

    expect(Array.from(bytes.slice(0, 2))).toEqual([0x50, 0x4b]);
    expect(entries.get("xl/workbook.xml")).toContain('sheet name="Roadmap_Gantt"');
    expect(entries.get("xl/workbook.xml")).toContain('sheet name="Roadmap_Data"');

    const ganttSheet = entries.get("xl/worksheets/sheet1.xml") ?? "";
    expect(ganttSheet).toContain("2026/4");
    expect(ganttSheet).toContain("2028/3");
    expect(ganttSheet).toContain("基幹刷新");
    expect(ganttSheet).toContain("  設計");
    expect(ganttSheet).toContain("本番判定");
    expect(ganttSheet).toContain('s="2"');
    expect(ganttSheet).toContain('s="3"');
    expect(ganttSheet).toContain('s="4"');
    expect(ganttSheet).toContain("◆");
    expect(ganttSheet).toContain("<cols>");

    const dataSheet = entries.get("xl/worksheets/sheet2.xml") ?? "";
    expect(dataSheet).toContain("FY2026 - FY2027");
    expect(dataSheet).toContain("MonthCount");
    expect(dataSheet).toContain("<v>24</v>");
  });
});
