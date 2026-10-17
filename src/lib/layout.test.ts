import { beforeEach, describe, expect, it } from "vitest";
import {
  CONTENT,
  SIDEBAR,
  clampWidth,
  columnEdgeLeft,
  readWidth,
  storeWidth,
  widthFromDrag,
} from "./layout";

describe("clampWidth", () => {
  it("keeps a value inside the bounds", () => {
    expect(clampWidth(700, 560, 1200)).toBe(700);
  });
  it("clamps to the minimum", () => {
    expect(clampWidth(100, 560, 1200)).toBe(560);
  });
  it("clamps to the maximum", () => {
    expect(clampWidth(5000, 560, 1200)).toBe(1200);
  });
});

describe("readWidth", () => {
  beforeEach(() => localStorage.clear());

  it("falls back to the default when nothing is stored", () => {
    expect(readWidth(CONTENT, localStorage)).toBe(CONTENT.default);
  });

  it("restores a stored width", () => {
    localStorage.setItem(CONTENT.key, "1000");
    expect(readWidth(CONTENT, localStorage)).toBe(1000);
  });

  it.each([
    ["below the minimum", "10"],
    ["above the maximum", "9999"],
    ["not a number", "wide"],
    ["empty", ""],
    ["negative", "-400"],
  ])("falls back to the default when the stored value is %s", (_label, raw) => {
    localStorage.setItem(CONTENT.key, raw);
    expect(readWidth(CONTENT, localStorage)).toBe(CONTENT.default);
  });

  it("keeps the sidebar and content widths independent", () => {
    storeWidth(CONTENT, localStorage, 1000);
    expect(readWidth(SIDEBAR, localStorage)).toBe(SIDEBAR.default);
  });
});

describe("storeWidth", () => {
  beforeEach(() => localStorage.clear());

  it("round-trips through readWidth", () => {
    storeWidth(CONTENT, localStorage, 1000);
    expect(readWidth(CONTENT, localStorage)).toBe(1000);
  });
});

describe("columnEdgeLeft", () => {
  it("puts the right edge half a width right of centre", () => {
    expect(columnEdgeLeft(800, "right")).toBe("calc(50% + 400px)");
  });

  it("puts the left edge half a width left of centre", () => {
    expect(columnEdgeLeft(800, "left")).toBe("calc(50% - 400px)");
  });

  it("keeps both edges symmetric around the centre", () => {
    expect(columnEdgeLeft(CONTENT.default, "left")).toContain(
      `- ${CONTENT.default / 2}px`,
    );
    expect(columnEdgeLeft(CONTENT.default, "right")).toContain(
      `+ ${CONTENT.default / 2}px`,
    );
  });
});

describe("widthFromDrag", () => {
  it("widens when the right edge moves right", () => {
    expect(widthFromDrag(800, 20, "right")).toBe(840);
  });

  it("narrows when the right edge moves left", () => {
    expect(widthFromDrag(800, -20, "right")).toBe(760);
  });

  it("narrows when the left edge moves right", () => {
    expect(widthFromDrag(800, 20, "left")).toBe(760);
  });

  it("widens when the left edge moves left", () => {
    expect(widthFromDrag(800, -20, "left")).toBe(840);
  });

  it("mirrors: the same outward drag grows the column equally from either edge", () => {
    expect(widthFromDrag(700, 30, "right")).toBe(widthFromDrag(700, -30, "left"));
  });

  it("is a no-op for a zero delta", () => {
    expect(widthFromDrag(800, 0, "left")).toBe(800);
    expect(widthFromDrag(800, 0, "right")).toBe(800);
  });
});

describe("defaults", () => {
  it("content column is wider than the old fixed 720px", () => {
    expect(CONTENT.default).toBeGreaterThan(720);
  });

  it("sidebar default is unchanged at 240px", () => {
    expect(SIDEBAR.default).toBe(240);
  });

  it("content min leaves room for the horizontal padding", () => {
    expect(CONTENT.min).toBeGreaterThanOrEqual(128);
  });
});