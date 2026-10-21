import { describe, expect, it } from "vitest";
import { menuTop } from "./placement";

// An 800px-tall window, a menu 300px tall.
const base = { height: 300, viewportBottom: 800 };

describe("menuTop", () => {
  it("opens below the anchor when the menu fits", () => {
    expect(menuTop({ ...base, anchorTop: 100 })).toBe(126);
  });

  it("flips above the anchor when below would run past the window", () => {
    expect(menuTop({ ...base, anchorTop: 600 })).toBe(296);
  });

  it("flips only once below would overlap the bottom margin", () => {
    expect(menuTop({ ...base, anchorTop: 466 })).toBe(492);
    expect(menuTop({ ...base, anchorTop: 467 })).toBe(163);
  });

  it("clamps into the window when neither side fits", () => {
    expect(menuTop({ anchorTop: 220, height: 400, viewportBottom: 500 })).toBe(92);
  });

  it("keeps the menu off the top edge once clamped", () => {
    expect(menuTop({ anchorTop: 200, height: 900, viewportBottom: 700 })).toBe(8);
  });

  it("honours a custom margin", () => {
    expect(menuTop({ ...base, anchorTop: 100, margin: 0 })).toBe(126);
    expect(menuTop({ ...base, anchorTop: 480, margin: 0 })).toBe(176);
  });
});
