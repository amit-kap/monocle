import { beforeEach, describe, expect, it } from "vitest";
import {
  CONTENT,
  SIDEBAR,
  clampWidth,
  readWidth,
  storeWidth,
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