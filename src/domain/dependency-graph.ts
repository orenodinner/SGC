export interface DependencyEdge {
  predecessorItemId: string;
  successorItemId: string;
}

export function wouldCreateDependencyCycle(
  dependencies: ReadonlyArray<DependencyEdge>,
  predecessorItemId: string,
  successorItemId: string
): boolean {
  const adjacency = new Map<string, string[]>();
  for (const dependency of dependencies) {
    const successors = adjacency.get(dependency.predecessorItemId) ?? [];
    successors.push(dependency.successorItemId);
    adjacency.set(dependency.predecessorItemId, successors);
  }

  const queue = [successorItemId];
  const visited = new Set<string>();
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current)) {
      continue;
    }
    if (current === predecessorItemId) {
      return true;
    }

    visited.add(current);
    for (const next of adjacency.get(current) ?? []) {
      if (!visited.has(next)) {
        queue.push(next);
      }
    }
  }

  return false;
}
