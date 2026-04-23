import type { ItemRecord, ProjectSummary, ProjectTemplateBody, ProjectTemplateProjectFields, WbsTemplateNode } from "../shared/contracts";

export function buildProjectTemplateBody(input: {
  project: ProjectSummary;
  items: ItemRecord[];
}): ProjectTemplateBody {
  const childrenByParent = new Map<string | null, ItemRecord[]>();
  for (const item of input.items) {
    const siblings = childrenByParent.get(item.parentId) ?? [];
    siblings.push(item);
    childrenByParent.set(item.parentId, siblings);
  }

  const sortSiblings = (items: ItemRecord[]) =>
    [...items].sort((left, right) =>
      left.sortOrder === right.sortOrder
        ? left.createdAt.localeCompare(right.createdAt)
        : left.sortOrder - right.sortOrder
    );

  const templateItems: WbsTemplateNode[] = [];
  let nodeCounter = 0;

  const visit = (item: ItemRecord, parentNodeId: string | null): void => {
    nodeCounter += 1;
    const nodeId = `node-${nodeCounter}`;
    templateItems.push({
      nodeId,
      parentNodeId,
      type: item.type,
      title: item.title,
      note: item.note,
      priority: item.priority,
      assigneeName: item.assigneeName,
      tags: [...item.tags],
      estimateHours: item.estimateHours,
      durationDays: item.durationDays,
      sortOrder: item.sortOrder,
    });

    for (const child of sortSiblings(childrenByParent.get(item.id) ?? [])) {
      visit(child, nodeId);
    }
  };

  for (const rootItem of sortSiblings(childrenByParent.get(null) ?? [])) {
    visit(rootItem, null);
  }

  return {
    schemaVersion: 1,
    sourceProjectId: input.project.id,
    sourceProjectName: input.project.name,
    projectFields: buildProjectTemplateProjectFields(input.project),
    templateItems,
  };
}

function buildProjectTemplateProjectFields(project: ProjectSummary): ProjectTemplateProjectFields {
  return {
    name: project.name,
    description: project.description,
    ownerName: project.ownerName,
    priority: project.priority,
    color: project.color,
  };
}
