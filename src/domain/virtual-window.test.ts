import { buildVirtualWindow } from "./virtual-window";

describe("buildVirtualWindow", () => {
  it("returns overscanned window and spacer heights", () => {
    expect(
      buildVirtualWindow({
        itemCount: 200,
        scrollTop: 580,
        viewportHeight: 560,
        rowHeight: 58,
        overscan: 4,
      })
    ).toEqual({
      startIndex: 6,
      endIndexExclusive: 24,
      topSpacerHeight: 348,
      bottomSpacerHeight: 10208,
    });
  });

  it("clamps to the available range near the end", () => {
    expect(
      buildVirtualWindow({
        itemCount: 20,
        scrollTop: 980,
        viewportHeight: 560,
        rowHeight: 58,
        overscan: 6,
      })
    ).toEqual({
      startIndex: 10,
      endIndexExclusive: 20,
      topSpacerHeight: 580,
      bottomSpacerHeight: 0,
    });
  });

  it("returns an empty window when there is nothing to render", () => {
    expect(
      buildVirtualWindow({
        itemCount: 0,
        scrollTop: 0,
        viewportHeight: 560,
        rowHeight: 58,
        overscan: 6,
      })
    ).toEqual({
      startIndex: 0,
      endIndexExclusive: 0,
      topSpacerHeight: 0,
      bottomSpacerHeight: 0,
    });
  });
});
