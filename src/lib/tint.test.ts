import { beforeEach, describe, expect, it } from "vitest";
import { TINTS, getStoredTint, isTint, storeTint } from "./tint";

describe("getStoredTint", () => {
  beforeEach(() => localStorage.clear());

  it("falls back to bone when nothing is stored", () => {
    expect(getStoredTint()).toBe("bone");
  });

  it("restores a stored tint", () => {
    localStorage.setItem("monocle:pageTint", "sage");
    expect(getStoredTint()).toBe("sage");
  });

  it("ignores a value that is not a tint", () => {
    localStorage.setItem("monocle:pageTint", "periwinkle");
    expect(getStoredTint()).toBe("bone");
  });

  it("round-trips through storeTint for every tint", () => {
    for (const spec of TINTS) {
      storeTint(spec.id);
      expect(getStoredTint()).toBe(spec.id);
    }
  });
});

describe("TINTS", () => {
  it("carries a light and a dark value for each tint", () => {
    for (const spec of TINTS) {
      expect(spec.light).toMatch(/^#[0-9a-f]{6}$/);
      expect(spec.dark).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("has unique ids", () => {
    expect(new Set(TINTS.map((spec) => spec.id)).size).toBe(TINTS.length);
  });
});

describe("isTint", () => {
  it("accepts a tint and rejects anything else", () => {
    expect(isTint("fog")).toBe(true);
    expect(isTint("bone ")).toBe(false);
    expect(isTint(null)).toBe(false);
  });
});
