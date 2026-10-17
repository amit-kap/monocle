import { describe, expect, it } from "vitest";
import type { TreeNode } from "../types";
import { stepRow, visibleRows } from "./treeNav";

const tree: TreeNode[] = [
  { name: "A.md", path: "/n/A.md", kind: "file" },
  {
    name: "Work",
    path: "/n/Work",
    kind: "dir",
    children: [
      { name: "B.md", path: "/n/Work/B.md", kind: "file" },
      {
        name: "Deep",
        path: "/n/Work/Deep",
        kind: "dir",
        children: [{ name: "C.md", path: "/n/Work/Deep/C.md", kind: "file" }],
      },
    ],
  },
];

describe("visibleRows", () => {
  it("lists rows in visual order, skipping folded folders", () => {
    const rows = visibleRows(tree, { expanded: new Set() });
    expect(rows.map((row) => row.path)).toEqual(["/n/A.md", "/n/Work"]);
    expect(rows[1]).toEqual({
      path: "/n/Work",
      kind: "dir",
      depth: 0,
      open: false,
    });
  });

  it("walks into an expanded folder, keeping depth", () => {
    const rows = visibleRows(tree, { expanded: new Set(["/n/Work"]) });
    expect(rows.map((row) => row.path)).toEqual([
      "/n/A.md",
      "/n/Work",
      "/n/Work/B.md",
      "/n/Work/Deep",
    ]);
    expect(rows.find((row) => row.path === "/n/Work/B.md")?.depth).toBe(1);
  });

  it("shows everything when the tree is force-expanded by a search", () => {
    const rows = visibleRows(tree, { expanded: new Set(), forceExpand: true });
    expect(rows.map((row) => row.path)).toEqual([
      "/n/A.md",
      "/n/Work",
      "/n/Work/B.md",
      "/n/Work/Deep",
      "/n/Work/Deep/C.md",
    ]);
    expect(rows.find((row) => row.path === "/n/Work/Deep")?.depth).toBe(1);
  });
});

describe("stepRow", () => {
  const rows = visibleRows(tree, { expanded: new Set(["/n/Work"]) });

  it("moves down and up, stopping at the ends", () => {
    expect(stepRow(rows, 1, "ArrowDown")).toEqual({ index: 2 });
    expect(stepRow(rows, 0, "ArrowUp")).toEqual({ index: 0 });
    expect(stepRow(rows, 3, "ArrowDown")).toEqual({ index: 3 });
  });

  it("lands on the first row when nothing is focused", () => {
    expect(stepRow(rows, -1, "ArrowDown")).toEqual({ index: 0 });
  });

  it("jumps to the ends with Home and End", () => {
    expect(stepRow(rows, 2, "Home")).toEqual({ index: 0 });
    expect(stepRow(rows, 0, "End")).toEqual({ index: 3 });
  });

  it("opens a closed folder with ArrowRight instead of leaving it", () => {
    const folded = visibleRows(tree, { expanded: new Set() });
    expect(stepRow(folded, 1, "ArrowRight")).toEqual({ index: 1, toggle: true });
  });

  it("steps into an open folder with ArrowRight", () => {
    expect(stepRow(rows, 1, "ArrowRight")).toEqual({ index: 2 });
  });

  it("closes an open folder with ArrowLeft", () => {
    expect(stepRow(rows, 1, "ArrowLeft")).toEqual({ index: 1, toggle: true });
  });

  it("walks out to the parent folder from a child or a file", () => {
    expect(stepRow(rows, 2, "ArrowLeft")).toEqual({ index: 1 });
    expect(stepRow(rows, 3, "ArrowLeft")).toEqual({ index: 1 });
  });

  it("leaves a top-level file's ArrowLeft alone", () => {
    expect(stepRow(rows, 0, "ArrowLeft")).toBeNull();
  });

  it("never toggles while searching", () => {
    const all = visibleRows(tree, { expanded: new Set(), forceExpand: true });
    // A folder that is open only because of the search: ← walks out of it
    // instead of folding it, and → steps into it.
    expect(stepRow(all, 3, "ArrowLeft", { canToggle: false })).toEqual({
      index: 1,
    });
    expect(stepRow(all, 1, "ArrowRight", { canToggle: false })).toEqual({
      index: 2,
    });
  });

  it("ignores keys that are not the tree's", () => {
    expect(stepRow(rows, 1, "Enter")).toBeNull();
    expect(stepRow(rows, 1, "a")).toBeNull();
  });

  it("does nothing with no rows", () => {
    expect(stepRow([], 0, "ArrowDown")).toBeNull();
  });
});
