import { describe, expect, it } from "vitest";
import type { TreeNode } from "../types";
import {
  ancestorsUpToHome,
  baseName,
  countFiles,
  crumbTrail,
  findNode,
  foldTree,
  parentDir,
  rowLabel,
  trailTo,
} from "./treeView";

const file = (path: string): TreeNode => ({ name: baseName(path), path, kind: "file" });
const dir = (path: string, children: TreeNode[]): TreeNode => ({
  name: baseName(path),
  path,
  kind: "dir",
  children,
});

describe("foldTree", () => {
  it("merges a folder whose only child is a folder", () => {
    const tree = [dir("/r/Research", [dir("/r/Research/_feeds", [dir("/r/Research/_feeds/2026", [file("/r/Research/_feeds/2026/a.md")])])])];
    const [row] = foldTree(tree);
    expect(rowLabel(row)).toBe("Research / _feeds / 2026");
    expect(row.path).toBe("/r/Research");
    expect(row.openPath).toBe("/r/Research/_feeds/2026");
    expect(row.children?.map((c) => c.name)).toEqual(["a.md"]);
  });

  it("shows a folder holding only SKILL.md as one file row", () => {
    const tree = [dir("/r/pipeline", [file("/r/pipeline/SKILL.md")])];
    const [row] = foldTree(tree);
    expect(row.kind).toBe("file");
    expect(row.path).toBe("/r/pipeline/SKILL.md");
    expect(rowLabel(row)).toBe("pipeline / SKILL.md");
  });

  it("folds a chain that ends in SKILL.md", () => {
    const tree = [dir("/r/skills", [dir("/r/skills/pipeline", [file("/r/skills/pipeline/SKILL.md")])])];
    expect(rowLabel(foldTree(tree)[0])).toBe("skills / pipeline / SKILL.md");
  });

  it("leaves a folder with several children alone", () => {
    const tree = [dir("/r/docs", [file("/r/docs/a.md"), file("/r/docs/b.md")])];
    const [row] = foldTree(tree);
    expect(row.label).toBeUndefined();
    expect(row.children).toHaveLength(2);
  });

  it("does not fold a folder with a SKILL.md and another file", () => {
    const tree = [dir("/r/s", [file("/r/s/SKILL.md"), file("/r/s/notes.md")])];
    expect(foldTree(tree)[0].kind).toBe("dir");
  });
});

describe("paths", () => {
  const tree = [dir("/r/a", [dir("/r/a/b", [file("/r/a/b/c.md"), file("/r/a/b/d.md")])])];

  it("finds a node and counts files", () => {
    expect(findNode(tree, "/r/a/b/c.md")?.name).toBe("c.md");
    expect(countFiles(tree[0])).toBe(2);
    expect(findNode(tree, "/r/zzz")).toBeNull();
  });

  it("lists the trail from the root down", () => {
    expect(trailTo("/r", "/r/a/b/c.md")).toEqual(["/r/a", "/r/a/b", "/r/a/b/c.md"]);
  });

  it("names parents and ancestors up to home", () => {
    expect(parentDir("/h/me/proj/x.md")).toBe("/h/me/proj");
    expect(ancestorsUpToHome("/h/me/a/b", "/h/me")).toEqual(["/h/me/a", "/h/me"]);
    expect(ancestorsUpToHome("/h/me", "/h/me")).toEqual([]);
  });
});

describe("crumbTrail", () => {
  it("runs from the root to the open item", () => {
    const t = crumbTrail("/h/me/proj", "/h/me/proj/docs/a.md");
    expect(t.inside).toBe(true);
    expect(t.parts.map((p) => p.name)).toEqual(["proj", "docs", "a.md"]);
  });

  it("is just the root when the root is open", () => {
    expect(crumbTrail("/h/me/proj", "/h/me/proj").parts).toHaveLength(1);
  });

  it("shows the last three parts as plain text outside the root", () => {
    const t = crumbTrail("/h/me/proj", "/h/me/.claude/skills/x/SKILL.md");
    expect(t.inside).toBe(false);
    expect(t.parts.map((p) => p.name)).toEqual(["skills", "x", "SKILL.md"]);
    expect(t.parts.every((p) => p.path === "")).toBe(true);
  });
});
