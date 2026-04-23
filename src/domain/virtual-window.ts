export interface VirtualWindowRange {
  startIndex: number;
  endIndexExclusive: number;
  topSpacerHeight: number;
  bottomSpacerHeight: number;
}

export interface VirtualWindowInput {
  itemCount: number;
  scrollTop: number;
  viewportHeight: number;
  rowHeight: number;
  overscan: number;
}

export function buildVirtualWindow(input: VirtualWindowInput): VirtualWindowRange {
  if (input.itemCount <= 0 || input.viewportHeight <= 0 || input.rowHeight <= 0) {
    return {
      startIndex: 0,
      endIndexExclusive: input.itemCount > 0 ? Math.min(input.itemCount, Math.max(1, input.itemCount)) : 0,
      topSpacerHeight: 0,
      bottomSpacerHeight: 0,
    };
  }

  const safeOverscan = Math.max(0, Math.floor(input.overscan));
  const clampedScrollTop = Math.max(0, input.scrollTop);
  const visibleStartIndex = Math.floor(clampedScrollTop / input.rowHeight);
  const visibleEndIndexExclusive = Math.min(
    input.itemCount,
    Math.ceil((clampedScrollTop + input.viewportHeight) / input.rowHeight)
  );
  const startIndex = Math.max(0, visibleStartIndex - safeOverscan);
  const endIndexExclusive = Math.min(
    input.itemCount,
    Math.max(startIndex + 1, visibleEndIndexExclusive + safeOverscan)
  );

  return {
    startIndex,
    endIndexExclusive,
    topSpacerHeight: startIndex * input.rowHeight,
    bottomSpacerHeight: Math.max(0, (input.itemCount - endIndexExclusive) * input.rowHeight),
  };
}
