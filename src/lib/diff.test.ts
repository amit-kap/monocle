import { describe, expect, it } from "vitest";
import { changedHunks, diffLines, diffStats, splitLines } from "./diff";
import { timeAgo } from "./time";

describe("diffLines", () => {
  it("marks added and removed lines", () => {
    const lines = diffLines("a\nb\nc\n", "a\nB\nc\nd\n");
    expect(lines.filter((l) => l.kind === "del").map((l) => l.text)).toEqual(["b"]);
    expect(lines.filter((l) => l.kind === "add").map((l) => l.text)).toEqual(["B", "d"]);
    expect(diffStats(lines)).toEqual({ added: 2, removed: 1 });
  });

  it("is empty of changes for identical text", () => {
    expect(diffStats(diffLines("a\nb\n", "a\nb\n"))).toEqual({ added: 0, removed: 0 });
  });

  it("does not count the trailing newline as a line", () => {
    expect(splitLines("a\nb\n")).toEqual(["a", "b"]);
    expect(splitLines("")).toEqual([]);
  });

  it("shows only changed lines with a little context", () => {
    const text = Array.from({ length: 20 }, (_, i) => `line ${i}`).join("\n");
    const after = text.replace("line 10", "line ten");
    const hunks = changedHunks(diffLines(text, after), 1);
    expect(hunks.map((l) => l.text)).toEqual(["line 9", "line 10", "line ten", "line 11"]);
  });
});

describe("timeAgo", () => {
  const now = 1_000_000_000;
  it("reads naturally", () => {
    expect(timeAgo(now - 10_000, now)).toBe("just now");
    expect(timeAgo(now - 120_000, now)).toBe("2 min ago");
    expect(timeAgo(now - 3 * 3_600_000, now)).toBe("3 hr ago");
    expect(timeAgo(now - 86_400_000, now)).toBe("1 day ago");
  });
});
