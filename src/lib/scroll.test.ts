import { describe, expect, it } from "vitest";
import { scrollDelta } from "./scroll";

const container = { top: 100, bottom: 200 };

describe("scrollDelta", () => {
  it("does nothing for an item already in view", () => {
    expect(scrollDelta(container, { top: 120, bottom: 150 })).toBe(0);
  });

  it("does nothing for an item flush with either edge", () => {
    expect(scrollDelta(container, { top: 100, bottom: 150 })).toBe(0);
    expect(scrollDelta(container, { top: 150, bottom: 200 })).toBe(0);
  });

  it("scrolls down for an item past the bottom edge", () => {
    expect(scrollDelta(container, { top: 180, bottom: 230 })).toBe(30);
  });

  it("scrolls up for an item above the top edge", () => {
    expect(scrollDelta(container, { top: 60, bottom: 110 })).toBe(-40);
  });

  it("aligns a partially hidden item to the nearer edge", () => {
    expect(scrollDelta(container, { top: 95, bottom: 130 })).toBe(-5);
    expect(scrollDelta(container, { top: 170, bottom: 210 })).toBe(10);
  });

  it("scrolls the least amount for an item taller than the container", () => {
    // Can't fit either way; align the edge that is already in view.
    expect(scrollDelta(container, { top: 130, bottom: 260 })).toBe(60);
  });

  it("scrolling by the delta leaves the item in view", () => {
    const item = { top: 180, bottom: 210 };
    const delta = scrollDelta(container, item);
    const moved = { top: item.top - delta, bottom: item.bottom - delta };
    expect(moved.bottom).toBeLessThanOrEqual(container.bottom);
    expect(moved.top).toBeGreaterThanOrEqual(container.top);
  });
});
