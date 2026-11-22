import { describe, expect, it } from "vitest";
import type { TreeNode } from "../types";
import {
  ancestorsUpToHome,
  baseName,
  countFiles,
  crumbTrail,
  findNode,
  dirsToRescan,
  foldTree,
  isEmptyDir,
  isHiddenDir,
  isShown,
  placeNodes,
  placeOf,
  parentDir,
  replaceDir,
  renameFileNode,
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

describe("replaceDir", () => {
  const tree = [
    { ...dir("/r/a", [{ ...dir("/r/a/b", []), hasNotes: false }]), hasNotes: false },
    file("/r/top.md"),
  ];

  it("swaps one folder's contents and recomputes hasNotes up the trail", () => {
    const next = replaceDir(tree, "/r/a/b", [file("/r/a/b/new.md")])!;
    const a = next[0];
    expect(a.hasNotes).toBe(true);
    expect(a.children?.[0].hasNotes).toBe(true);
    expect(a.children?.[0].children?.[0].name).toBe("new.md");
    // Untouched siblings keep their identity.
    expect(next[1]).toBe(tree[1]);
  });

  it("returns null for a folder the tree doesn't have", () => {
    expect(replaceDir(tree, "/r/zzz", [])).toBeNull();
  });
});

describe("dirsToRescan", () => {
  it("rescans each changed path's parent, once, outermost only", () => {
    expect(
      dirsToRescan(["/r/a/x.md", "/r/a/y.md", "/r/a/b/z.md", "/r/c/new folder"]).sort(),
    ).toEqual(["/r/a", "/r/c"]);
  });
});

describe("isShown", () => {
  it("hides dot paths unless they are agent folders or hidden files are on", () => {
    expect(isShown("/h", "/h/notes/a.md", false)).toBe(true);
    expect(isShown("/h", "/h/.claude/CLAUDE.md", false)).toBe(true);
    expect(isShown("/h", "/h/.zsh_history", false)).toBe(false);
    expect(isShown("/h", "/h/.zsh_history", true)).toBe(true);
    expect(isShown("/h", "/elsewhere/a.md", true)).toBe(false);
  });
});

describe("folder kinds", () => {
  it("knows an empty folder from one with anything inside", () => {
    expect(isEmptyDir(dir("/r/e", []))).toBe(true);
    expect(isEmptyDir(dir("/r/f", [dir("/r/f/g", [])]))).toBe(false);
    expect(isEmptyDir(file("/r/a.md"))).toBe(false);
  });

  it("marks dot folders, and folded rows with one in the trail", () => {
    expect(isHiddenDir(dir("/r/.claude", []))).toBe(true);
    expect(isHiddenDir({ ...dir("/r/.config", []), label: [".config", "opencode"] })).toBe(true);
    expect(isHiddenDir(dir("/r/notes", []))).toBe(false);
    expect(isHiddenDir(file("/r/.hidden.md"))).toBe(false);
  });
});

describe("places", () => {
  it("finds the deepest place that holds a path", () => {
    const places = ["/h", "/h/.claude", "/w"];
    expect(placeOf(places, "/h/.claude/CLAUDE.md")).toBe("/h/.claude");
    expect(placeOf(places, "/h/notes/a.md")).toBe("/h");
    expect(placeOf(places, "/w")).toBe("/w");
    expect(placeOf(places, "/elsewhere/a.md")).toBeNull();
    expect(placeOf(places, "/hx/a.md")).toBeNull();
  });

  it("builds one header row per place, with hints for twins and missing marks", () => {
    const nodes = placeNodes(["/a/notes", "/b/notes", "/c"], [[file("/a/notes/x.md")], [], null]);
    expect(nodes.map((n) => [n.name, n.place, n.hint, n.missing, n.hasNotes])).toEqual([
      ["notes", true, "a", undefined, true],
      ["notes", true, "b", undefined, false],
      ["c", true, undefined, true, false],
    ]);
  });

  it("never folds a place into its only folder", () => {
    const [place] = placeNodes(["/p"], [[dir("/p/only", [file("/p/only/x.md")])]]);
    const [row] = foldTree([place]);
    expect(row.label).toBeUndefined();
    expect(row.children?.[0].path).toBe("/p/only");
  });

  it("replaces a folder in every place that holds it", () => {
    const tree = placeNodes(["/h", "/h/.claude"], [[dir("/h/.claude", [])], []]);
    const next = replaceDir(tree, "/h/.claude", [file("/h/.claude/CLAUDE.md")])!;
    expect(next[0].children?.[0].children?.[0].name).toBe("CLAUDE.md");
    expect(next[1].children?.[0].name).toBe("CLAUDE.md");
  });
});

describe("renameFileNode", () => {
  it("moves the file and keeps its siblings", () => {
    const tree = [dir("/r", [file("/r/a.md"), dir("/r/sub", [file("/r/sub/old.md")])])];
    const next = renameFileNode(tree, "/r/sub/old.md", "/r/sub/new.md");
    const sub = next[0].children![1];
    expect(sub.children![0]).toMatchObject({ path: "/r/sub/new.md", name: "new.md" });
    expect(next[0].children![0]).toBe(tree[0].children![0]);
  });
});
