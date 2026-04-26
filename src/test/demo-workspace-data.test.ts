import { describe, expect, it } from "vitest";
import demoWorkspace from "../../spec/demo-workspace-data.json";

describe("demo workspace data", () => {
  it("keeps the user-facing demo set small and structured", () => {
    expect(demoWorkspace.projects).toHaveLength(8);

    for (const project of demoWorkspace.projects) {
      expect(project.ownerName).toBeTruthy();
      expect(project.tasks).toHaveLength(7);

      const assignees = new Set(project.tasks.map((task) => task.assigneeName));
      expect(assignees.size).toBeGreaterThanOrEqual(2);
      expect(assignees.size).toBeLessThanOrEqual(3);
      expect(assignees.has(project.ownerName)).toBe(true);
      expect(project.tasks.at(-1)?.type).toBe("milestone");
    }
  });

  it("spreads all demo schedules inside the configured calendar year", () => {
    const yearPrefix = `${demoWorkspace.year}-`;

    for (const project of demoWorkspace.projects) {
      for (const task of project.tasks) {
        expect(task.startDate.startsWith(yearPrefix)).toBe(true);
        expect(task.endDate.startsWith(yearPrefix)).toBe(true);
        expect(task.startDate <= task.endDate).toBe(true);
      }
    }
  });
});
