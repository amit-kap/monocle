import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DirEntry } from "@tauri-apps/plugin-fs";

vi.mock("@tauri-apps/plugin-fs", () => ({
  readDir: vi.fn(),
  exists: vi.fn(),
  readTextFile: vi.fn(),
  remove: vi.fn(),
  rename: vi.fn(),
  writeTextFile: vi.fn(),
  stat: vi.fn(async () => ({ size: 1400 })),
}));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
const invokeMock = vi.hoisted(() => vi.fn(async (_cmd: string, _args?: unknown) => undefined as unknown));
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));
vi.mock("@tauri-apps/api/path", () => ({
  join: vi.fn(async (...parts: string[]) => parts.join("/")),
  dirname: vi.fn(async (p: string) => p.slice(0, p.lastIndexOf("/"))),
}));

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

describe("sortNodes", () => {
  it("puts files before folders, each A to Z", async () => {
    const { sortNodes } = await import("./fs");
    const sorted = sortNodes([
      { name: "zeta", path: "/z", kind: "dir" },
      { name: "b.md", path: "/b.md", kind: "file" },
      { name: "alpha", path: "/a", kind: "dir" },
      { name: "a.md", path: "/a.md", kind: "file" },
    ]);
    expect(sorted.map((n) => n.name)).toEqual(["a.md", "b.md", "alpha", "zeta"]);
  });
});


describe("the plan's file rules", () => {
  beforeEach(() => {
    readDir.mockClear();
    invokeMock.mockClear();
  });

  it("writes through the atomic Rust command, never a plain write", async () => {
    const { writeNote } = await import("./fs");
    await writeNote("/notes/a.md", "text\n");
    expect(invokeMock).toHaveBeenCalledWith("write_file_atomic", { path: "/notes/a.md", contents: "text\n" });
  });

  it("names new files untitled.md, then untitled 2.md", async () => {
    const { createNoteFile } = await import("./fs");
    const pluginFs = await import("@tauri-apps/plugin-fs");
    const exists = vi.mocked(pluginFs.exists);
    exists.mockResolvedValueOnce(true).mockResolvedValue(false);
    expect(await createNoteFile("/notes")).toBe("/notes/untitled 2.md");
    exists.mockReset();
    exists.mockResolvedValue(false);
    expect(await createNoteFile("/notes")).toBe("/notes/untitled.md");
  });

  it("makes new folders named untitled folder, with a number when taken", async () => {
    const { createDirectory } = await import("./fs");
    const pluginFs = await import("@tauri-apps/plugin-fs");
    const exists = vi.mocked(pluginFs.exists);
    exists.mockReset();
    exists.mockResolvedValueOnce(true).mockResolvedValue(false);
    expect(await createDirectory("/notes")).toBe("/notes/untitled folder 2");
    expect(invokeMock).toHaveBeenCalledWith("create_dir", { path: "/notes/untitled folder 2" });
  });

  it("moves to the system Trash through the Rust command", async () => {
    const { trashPath } = await import("./fs");
    await trashPath("/notes/a.md");
    expect(invokeMock).toHaveBeenCalledWith("trash_path", { path: "/notes/a.md" });
  });

  it("saves pasted images through save_asset", async () => {
    const { saveAsset } = await import("./fs");
    await saveAsset("/notes/a.md", [1, 2], "png");
    expect(invokeMock).toHaveBeenCalledWith("save_asset", { filePath: "/notes/a.md", bytes: [1, 2], ext: "png" });
  });

  it("skips build output folders as well as system and dependency folders", async () => {
    const { readTree } = await import("./fs");
    readDir.mockImplementation(async (path) =>
      String(path) === "/p"
        ? [dir("dist"), dir("build"), dir("target"), dir("docs"), file("a.md")]
        : [file("x.md")],
    );
    const nodes = await readTree("/p");
    expect(nodes.map((n) => n.name)).toEqual(["a.md", "docs"]);
  });

  it("keeps an empty folder made in the app, and prunes other empty folders", async () => {
    const { readTree } = await import("./fs");
    readDir.mockImplementation(async (path) =>
      String(path) === "/p" ? [dir("made"), dir("other"), file("a.md")] : [],
    );
    const nodes = await readTree("/p", false, new Set(["/p/made"]));
    expect(nodes.map((n) => n.name)).toEqual(["a.md", "made"]);
  });

  it("records each note's size, for the token estimate", async () => {
    const { readTree } = await import("./fs");
    readDir.mockImplementation(async () => [file("a.md")]);
    const [node] = await readTree("/p");
    expect(node.size).toBe(1400);
  });
});

describe("filterTree", () => {
  const tree = [
    {
      name: "CompLibs",
      path: "/p/CompLibs",
      kind: "dir" as const,
      children: [
        {
          name: "glaze",
          path: "/p/CompLibs/glaze",
          kind: "dir" as const,
          children: [{ name: "README.md", path: "/p/CompLibs/glaze/README.md", kind: "file" as const }],
        },
      ],
    },
    { name: "notes.md", path: "/p/notes.md", kind: "file" as const },
  ];

  it("matches a file by name", async () => {
    const { filterTree } = await import("./fs");
    expect(filterTree(tree, "notes").map((n) => n.name)).toEqual(["notes.md"]);
  });

  it("matches a folder by name and keeps everything inside it", async () => {
    const { filterTree } = await import("./fs");
    const [top] = filterTree(tree, "glaze");
    expect(top.name).toBe("CompLibs");
    expect(top.children?.[0].name).toBe("glaze");
    expect(top.children?.[0].children?.[0].name).toBe("README.md");
  });
});
