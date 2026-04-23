import type { ItemRecord, WbsTemplateBody, WbsTemplateNode } from "../shared/contracts";

export function buildWbsTemplateBody(input: {
  items: ItemRecord[];
  rootItemId: string;
  sourceProjectId: string;
}): WbsTemplateBody {
  const rootItem = input.items.find((item) => item.id === input.rootItemId);
  if (!rootItem) {
    throw new Error(`Template root item not found: ${input.rootItemId}`);
  }

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

  visit(rootItem, null);

  return {
    schemaVersion: 1,
    sourceProjectId: input.sourceProjectId,
    sourceRootItemId: rootItem.id,
    sourceRootTitle: rootItem.title,
    templateItems,
  };
}

export function buildWbsTemplateApplyNodes(body: WbsTemplateBody): WbsTemplateNode[] {
  return buildTemplateApplyNodes(body.templateItems);
}

export function buildTemplateApplyNodes(templateItems: WbsTemplateNode[]): WbsTemplateNode[] {
  const nodesByParent = new Map<string | null, WbsTemplateNode[]>();
  for (const node of templateItems) {
    const siblings = nodesByParent.get(node.parentNodeId) ?? [];
    siblings.push(node);
    nodesByParent.set(node.parentNodeId, siblings);
  }

  const sortNodes = (nodes: WbsTemplateNode[]) =>
    [...nodes].sort((left, right) => left.sortOrder - right.sortOrder || left.nodeId.localeCompare(right.nodeId));

  const ordered: WbsTemplateNode[] = [];
  const visit = (parentNodeId: string | null): void => {
    for (const node of sortNodes(nodesByParent.get(parentNodeId) ?? [])) {
      ordered.push(node);
      visit(node.nodeId);
    }
  };

  visit(null);
  return ordered;
}
