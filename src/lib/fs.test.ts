import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DirEntry } from "@tauri-apps/plugin-fs";

vi.mock("@tauri-apps/plugin-fs", () => ({
  readDir: vi.fn(),
  exists: vi.fn(),
  readTextFile: vi.fn(),
  remove: vi.fn(),
  rename: vi.fn(),
  writeTextFile: vi.fn(),
}));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));

const { flattenTree, readTree } = await import("./fs");
const pluginFs = await import("@tauri-apps/plugin-fs");
const readDir = vi.mocked(pluginFs.readDir);

function dir(name: string, extra: Partial<DirEntry> = {}): DirEntry {
  return { name, isDirectory: true, isFile: false, isSymlink: false, ...extra };
}

function file(name: string): DirEntry {
  return { name, isDirectory: false, isFile: true, isSymlink: false };
}

// /notes/node_modules, /notes/Library and /notes/.git hold markdown too, so a
// test that finds nothing in them proves they were skipped rather than empty.
const DISK: Record<string, DirEntry[]> = {
  "/notes": [
    file("a.md"),
    file("notes.txt"),
    file(".secret.md"),
    dir("plain"),
    dir("empty"),
    dir(".hidden"),
    dir("node_modules"),
    dir("Library"),
    dir(".git"),
    dir("linked", { isSymlink: true }),
  ],
  "/notes/plain": [file("b.md")],
  "/notes/.hidden": [file("c.md")],
  "/notes/node_modules": [file("readme.md")],
  "/notes/Library": [file("d.md")],
  "/notes/.git": [file("e.md")],
};

/** The tree's note paths, sorted so the test reads as a set, not a collation. */
function paths(nodes: Awaited<ReturnType<typeof readTree>>): string[] {
  return flattenTree(nodes)
    .map((note) => note.path)
    .sort();
}

describe("readTree", () => {
  beforeEach(() => {
    readDir.mockClear();
    readDir.mockImplementation(async (path) => DISK[String(path)] ?? []);
  });

  it("lists markdown and skips hidden names, heavy folders and symlinks", async () => {
    expect(paths(await readTree("/notes"))).toEqual([
      "/notes/a.md",
      "/notes/plain/b.md",
    ]);
  });

  it("lists dot-entries when hidden files are on", async () => {
    // .git and the heavy folders stay out even then: they are noise, not notes.
    expect(paths(await readTree("/notes", true))).toEqual([
      "/notes/.hidden/c.md",
      "/notes/.secret.md",
      "/notes/a.md",
      "/notes/plain/b.md",
    ]);
  });

  it("drops folders that hold no markdown", async () => {
    expect(paths(await readTree("/notes"))).not.toContain("/notes/empty");
  });
});
